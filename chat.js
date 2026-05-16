const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');

const pool = require('./src/config/db');
const authRoutes = require('./src/routes/auth');
const markerRoutes = require('./src/routes/markers');
const messageRoutes = require('./src/routes/messages');
const setupChatSocket = require('./src/sockets/chatSocket');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const sessionParser = session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
});

// 전역 상태 관리
const state = {
    markers: {},
    userMarkers: {},
    roomUserLocations: {},
    roomUsers: {},
    bannedUsers: {},
    roomUserCounts: {},
    roomMarkers: {},
    roomEmptyCheckInterval: 5 * 60 * 1000,
    
    // 헬퍼 함수들
    calculateCenter: (userLocations) => {
        if (!userLocations || userLocations.length === 0) return { latitude: 0, longitude: 0 };
        let x = 0, y = 0, z = 0;
        userLocations.forEach(user => {
            const lat = user.latitude * Math.PI / 180;
            const lon = user.longitude * Math.PI / 180;
            x += Math.cos(lat) * Math.cos(lon);
            y += Math.cos(lat) * Math.sin(lon);
            z += Math.sin(lat);
        });
        const total = userLocations.length;
        x /= total; y /= total; z /= total;
        const centralLongitude = Math.atan2(y, x);
        const centralSquareRoot = Math.sqrt(x * x + y * y);
        const centralLatitude = Math.atan2(z, centralSquareRoot);
        return {
            latitude: centralLatitude * 180 / Math.PI,
            longitude: centralLongitude * 180 / Math.PI
        };
    },
    
    getMarkerPositions: (roomId) => {
        if (state.roomMarkers[roomId]) return state.roomMarkers[roomId];
        return {
            start: { lat: 35.1152, lng: 128.9684 }, // 동아대 승학캠퍼스 기준
            end: { lat: 35.1152, lng: 128.9684 }
        };
    },

    loadMarkersFromDB: async () => {
        try {
            const [results] = await pool.query('SELECT * FROM markers');
            results.forEach(marker => {
                state.markers[marker.id] = marker;
                const userCount = state.roomUsers[marker.id] ? state.roomUsers[marker.id].length : 0;
                io.emit('newMarker', { ...marker, userCount, maxNumber: marker.max_number || 0 });
            });
            console.log(`${results.length} markers loaded from DB.`);
        } catch (err) {
            console.error('Error loading markers:', err);
        }
    }
};

// 미들웨어 설정
app.use(sessionParser);
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/images', express.static(path.join(__dirname, 'images')));

io.use((socket, next) => {
    sessionParser(socket.request, {}, next);
});

// 라우터 등록
app.use(authRoutes);
app.use(markerRoutes);
app.use(messageRoutes);

// 실시간 상태 업데이트 전용 API
app.get('/getUserCounts', (req, res) => {
    const userCounts = {};
    for (const roomId in state.roomUsers) {
        userCounts[roomId] = {
            userCount: state.roomUsers[roomId].length,
            maxNumber: state.markers[roomId] ? state.markers[roomId].max_number : 0
        };
    }
    res.json(userCounts);
});

// 소켓 설정
setupChatSocket(io, state);

// 정적 파일 라우팅 (간소화)
['/intro.html','/login.js', '/login.css', '/index.html', '/register.html','/main.js', '/script.js', '/gps_set.js', '/style.css', '/map.html'].forEach(file => {
    app.get(file, (req, res) => {
        res.sendFile(path.join(__dirname, file));
    });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'intro.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/index.html', (req, res) => {
    if (req.session.loggedin) {
        const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
        const safeUsername = JSON.stringify(req.session.username);
        res.send(indexHtml.replace('<!--USERNAME-->', `<script>var username = ${safeUsername};</script>`));
    } else {
        res.redirect('/login.html');
    }
});

// 방 자동 삭제 로직
async function checkAndRemoveEmptyRooms() {
    for (const roomId in state.roomUsers) {
        if (state.roomUsers[roomId].length === 0) {
            try {
                await pool.query('DELETE FROM markers WHERE id = ?', [roomId]);
                delete state.markers[roomId];
                delete state.roomUsers[roomId];
                io.emit('removeMarker', { id: roomId });
                console.log(`Removing empty room: ${roomId}`);
            } catch (err) { console.error(err); }
        }
    }
}

const PORT = Number(process.env.PORT || 8080);

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`Server is listening on http://localhost:${PORT}`);
        state.loadMarkersFromDB();
        setInterval(checkAndRemoveEmptyRooms, state.roomEmptyCheckInterval);
    });
}

module.exports = { app, pool };
