const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
const session = require('express-session');

const sessionParser = session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'chat_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

let markers = {}; // 마커 정보를 저장할 객체
let userMarkers = {}; // 사용자별 마커 ID 저장
let roomUserLocations = {}; // 방별로 사용자 위치를 저장하는 객체
let roomUsers = {}; // 방별 사용자 목록

app.use(sessionParser);
app.use('/images', express.static(path.join(__dirname, 'images')));

function calculateCenter(locations) {
    let latSum = 0;
    let lngSum = 0;
    locations.forEach(loc => {
        latSum += loc.latitude;
        lngSum += loc.longitude;
    });
    return {
        latitude: latSum / locations.length,
        longitude: lngSum / locations.length
    };
}

function loadMarkersFromDB() {
    pool.query('SELECT * FROM markers', (err, results) => {
        if (err) {
            console.error('Error loading markers from MySQL:', err);
            return;
        }
        results.forEach(marker => {
            markers[marker.id] = marker;
            io.emit('newMarker', marker);
        });
    });
}

io.use((socket, next) => {
    sessionParser(socket.request, {}, next);
});

io.on('connection', (socket) => {
    const req = socket.request;
    if (req.session.username) {
        socket.username = req.session.username;
        console.log(`Session user: ${req.session.username}`);
    }

    // 기존 마커 정보를 클라이언트에 전송
    Object.values(markers).forEach(marker => {
        socket.emit('newMarker', marker);
        // 사용자가 이미 마커를 생성한 경우 삭제 버튼을 표시하기 위해 이벤트를 전송
        if (marker.created_by === socket.username) {
            socket.emit('markerExists', { success: true, markerId: marker.id });
        }
    });

    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        socket.room = roomId;
        console.log(`${socket.username} joined room ${roomId}`);

        // 방별 사용자 위치 초기화
        if (!roomUserLocations[roomId]) {
            roomUserLocations[roomId] = [];
        }
        if (!roomUsers[roomId]) {
            roomUsers[roomId] = [];
        }

        // 사용자 목록에 추가
        if (!roomUsers[roomId].includes(socket.username)) {
            roomUsers[roomId].push(socket.username);
        }

        // 사용자 목록 업데이트
        io.to(roomId).emit('updateUserLocations', {
            userLocations: roomUserLocations[roomId],
            center: calculateCenter(roomUserLocations[roomId]),
            users: roomUsers[roomId]
        });
    });

    socket.on('updateLocation', (data) => {
        const { latitude, longitude, roomId } = data;
        const username = socket.username;

        const userLocation = { username, latitude, longitude };
        let userLocations = roomUserLocations[roomId] || [];

        const index = userLocations.findIndex(loc => loc.username === username);
        if (index !== -1) {
            userLocations[index] = userLocation;
        } else {
            userLocations.push(userLocation);
        }

        roomUserLocations[roomId] = userLocations;

        const center = calculateCenter(userLocations);

        io.to(roomId).emit('updateUserLocations', {
            userLocations: userLocations,
            center: center,
            users: roomUsers[roomId]
        });
    });

    socket.on('createMarker', (markerData) => {
        if (userMarkers[socket.username]) {
            // 이미 마커가 있는 경우
            socket.emit('markerExists', { success: false, message: 'Marker already exists' });
            return;
        }

        // 마커 생성자 정보 추가
        markerData.admin = socket.id;
        // 방 생성 (마커 ID를 방 ID로 사용)
        const roomId = markerData.id;
        socket.join(roomId);
        socket.room = roomId;
        console.log(`${socket.username} created and joined room ${roomId}`);

        // 마커 정보 저장 및 브로드캐스트
        markers[roomId] = markerData;
        userMarkers[socket.username] = roomId;
        io.emit('newMarker', markerData);

        // 마커 정보를 데이터베이스에 저장
        pool.query('INSERT INTO markers (id, title, created_by, context, latitude, longitude, max_number, type, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
            [markerData.id, markerData.title, markerData.created_by, markerData.context, markerData.latitude, markerData.longitude, markerData.max_number, markerData.type, markerData.image], 
            (err) => {
                if (err) {
                    console.error('Error saving marker to MySQL:', err);
                } else {
                    console.log('Marker saved to MySQL');
                }
            });
    });

    socket.on('deleteMarker', () => {
        if (!userMarkers[socket.username]) {
            socket.emit('markerDeleteError', { success: false, message: 'No marker to delete' });
            return;
        }

        const markerId = userMarkers[socket.username];
        delete markers[markerId];
        delete userMarkers[socket.username];

        io.emit('removeMarker', { id: markerId });
        pool.query('DELETE FROM markers WHERE id = ?', [markerId], (err) => {
            if (err) {
                console.error('Error deleting marker from MySQL:', err);
                socket.emit('markerDeleteError', { success: false, message: 'Error deleting marker from database' });
            } else {
                console.log('Marker deleted from MySQL');
                socket.emit('markerDeleted', { success: true, message: 'Marker deleted' });
            }
        });
    });

    socket.on('joinMarkerRoom', (markerId) => {
        const roomId = markerId;
        if (markers[roomId]) {
            socket.join(roomId);
            socket.room = roomId;
            console.log(`${socket.username} joined marker room ${roomId}`);
            // 해당 방의 마커 정보를 전송하여 사용자 이동
            socket.emit('joinedRoom', roomId, markers[roomId]);
        }
    });

    socket.on('delete', (messageId) => {
        pool.query('DELETE FROM messages WHERE id = ?', [messageId], (err) => {
            if (err) {
                console.error('Error deleting message from MySQL:', err);
            } else {
                console.log('Message deleted from MySQL');
                io.to(socket.room).emit('delete', { messageId: messageId });
            }
        });
    });

    socket.on('message', (message) => {
        io.to(message.roomId).emit('message', { text: message.text, messageId: message.messageId, username: message.username });

        pool.query('INSERT INTO messages (id, username, text, roomId) VALUES (?, ?, ?, ?)', [message.messageId, message.username, message.text, message.roomId], (err) => {
            if (err) {
                console.error('Error saving message to MySQL:', err);
            } else {
                console.log('Message saved to MySQL');
            }
        });
    });

    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.username}`);
        if (socket.username) {
            pool.query('UPDATE user_login SET status = 0 WHERE username = ?', [socket.username], (err, result) => {
                if (err) {
                    console.error('Failed to update user status on disconnect:', err);
                    return;
                }
                console.log(`Status updated to 0 for user ${socket.username}`);
            });

            const userLocations = roomUserLocations[socket.room] || [];
            roomUserLocations[socket.room] = userLocations.filter(user => user.username !== socket.username);

            const users = roomUsers[socket.room] || [];
            roomUsers[socket.room] = users.filter(user => user !== socket.username);

            io.to(socket.room).emit('updateUserLocations', {
                userLocations: roomUserLocations[socket.room],
                users: roomUsers[socket.room]
            });

            io.to(socket.room).emit('removeMarker', { username: socket.username });
        }
    });
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

['/intro.html','/login.js', '/login.css', '/index.html', '/register.html', '/script.js', '/gps_set.js', '/style.css', '/map.html' ].forEach(file => {
    app.get(file, (req, res) => {
        const filePath = path.join(__dirname, file);
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.status(500).send('Error loading ' + file);
                return;
            }
            const contentType = {
                '.js': 'application/javascript',
                '.css': 'text/css',
                '.html': 'text/html'
            }[path.extname(file)] || 'text/plain';

            res.setHeader('Content-Type', contentType);
            res.send(data);
        });
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'intro.html'));
});

app.get('/login.html', (req, res) => {
    if (req.session.loggedin) {
        res.sendFile(path.join(__dirname, 'login.html'));
    } else {
        res.sendFile(path.join(__dirname, 'login.html'));
    }
});

app.get('/index.html', (req, res) => {
    if (req.session.loggedin) {
        const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
        const modifiedHtml = indexHtml.replace('<!--USERNAME-->', `<script>var username = "${req.session.username}";</script>`);
        res.send(modifiedHtml);
    } else {
        res.redirect('/login.html');
    }
});

app.get('/get-username', (req, res) => {
    if (req.session.loggedin) {
        res.json({ username: req.session.username });
    } else {
        res.status(401).json({ error: 'Not logged in' });
    }
});

app.post('/signup', (req, res) => {
    const { username, password } = req.body;
    if (username && password) {
        pool.execute('SELECT username FROM user_login WHERE username = ?', [username], (err, results) => {
            if (err) {
                res.status(500).json({ success: false, message: 'Database error' });
                return;
            }
            if (results.length > 0) {
                res.json({ success: false, message: 'Username already exists.' });
            } else {
                const sql = 'INSERT INTO user_login (username, password) VALUES (?, ?)';
                pool.query(sql, [username, password], (err, result) => {
                    if (err) {
                        res.status(500).json({ success: false, message: 'Database error' });
                        return;
                    }
                    res.json({ success: true, message: '가입이 성공되었습니다!' });
                });
            }
        });
    } else {
        res.status(400).json({ success: false, message: 'Both username and password are required' });
    }
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username && password) {
        pool.execute(
            'SELECT * FROM user_login WHERE username = ? AND password = ?',
            [username, password],
            (err, results) => {
                if (err) {
                    res.status(500).send('Database error');
                    return;
                }
                if (results.length > 0) {
                    req.session.loggedin = true;
                    req.session.username = username;
                    pool.query('UPDATE user_login SET status = 1 WHERE username = ?', [username], (err, result) => {
                        if (err) {
                            console.error('Failed to update user status:', err);
                            return;
                        }
                    });
                    res.redirect('/map.html');
                } else {
                    res.send('Incorrect Username and/or Password!');
                }
            }
        );
    } else {
        res.status(400).send('Username and Password are required');
    }
});

app.post('/getMarkers', (req, res) => {
    const markerType = req.body.type;

    pool.execute('SELECT * FROM markers WHERE type = ?', [markerType], (err, results) => {
        if (err) {
            console.error('Error fetching markers:', err);
            res.status(500).send('Database error');
            return;
        }
        res.json(results);
    });
});

/*
app.post('/createMarkers', (req, res)=>{
    const marker = req.body;
    pool.execute('INSERT INTO markers (id, title, created_by, context, latitude, longitude, max_number, type, image) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [marker.id, marker.title, marker.created_by, marker.context, marker.latitude, marker.longitude, marker.max_number, marker.type, marker.image], 
    (err, results) => {
        if(err) {
            console.error('Error creating marker:', err);
            res.status(500).send('Database error');
            return;
        }
        console.log('create marker success.');
        res.json({ success: true, message: 'Marker created successfully!' });
    });
}); */

app.get('/map.html', (req, res) => {
    res.sendFile(__dirname + '/map.html');
});

server.listen(8080, () => {
    console.log('Server is listening on http://localhost:8080');
    loadMarkersFromDB(); // 서버 시작 시 마커 로드
});
