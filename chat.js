const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');

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
let bannedUsers = {}; // 방별 강퇴된 사용자 목록
const roomUserCounts = {}; // 방별 유저 수를 저장하는 객체
const roomEmptyCheckInterval = 5 * 60 * 1000; // 5분
const roomMarkers = {};

function checkAndRemoveEmptyRooms() {
    for (const roomId in roomUsers) {
        if (roomUsers.hasOwnProperty(roomId)) {
            if (roomUsers[roomId].length === 0) {
                console.log(`Removing empty room: ${roomId}`);
                removeRoom(roomId);
            }
        }
    }
}

function removeRoom(roomId) {
    // DB에서 마커 삭제
    pool.query('DELETE FROM markers WHERE id = ?', [roomId], (err) => {
        if (err) {
            console.error('Error deleting marker from MySQL:', err);
            return;
        }

        delete markers[roomId];

        delete roomUsers[roomId];

        io.emit('removeMarker', { id: roomId });
    });
}
function initializeRoomMarkers(roomId, startLat, startLng, endLat, endLng) {
    roomMarkers[roomId] = {
        start: { lat: startLat, lng: startLng },
        end: { lat: endLat, lng: endLng }
    };
}
function updateMarkerPosition(roomId, type, lat, lng) {
    if (roomMarkers[roomId] && (type === 'start' || type === 'end')) {
        roomMarkers[roomId][type] = { lat, lng };
    }
}
function getMarkerPositions(roomId) {
    if (roomMarkers[roomId]) {
        return roomMarkers[roomId];
    } else {
        // 방에 대한 마커 정보가 없으면 기본값 반환
        return {
            start: { lat: 37.566826, lng: 126.9786567 }, // 서울시청 좌표
            end: { lat: 37.566826, lng: 126.9786567 }
        };
    }
}
setInterval(checkAndRemoveEmptyRooms, roomEmptyCheckInterval);

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

            // 유저 수 정보를 포함시켜서 클라이언트로 전송
            const userCount = roomUsers[marker.id] ? roomUsers[marker.id].length : 0;
            const maxNumber = marker.max_number || 0;

            io.emit('newMarker', {
                ...marker,
                userCount: userCount,
                maxNumber: maxNumber
            });
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


    Object.values(markers).forEach(marker => {
        const userCount = roomUsers[marker.id] ? roomUsers[marker.id].length : 0;
        const maxNumber = marker.max_number || 0;

        socket.emit('newMarker', {
            ...marker,
            userCount: userCount,
            maxNumber: maxNumber
        });
    });

    socket.on('joinRoom', (roomId) => {
        if (bannedUsers[roomId] && bannedUsers[roomId].includes(socket.username)) {
            socket.emit('banned', { success: false, message: 'You are banned from this room.' });
            return;
        }

        const currentUsersCount = roomUsers[roomId] ? roomUsers[roomId].length : 0;
        const maxNumber = markers[roomId] ? markers[roomId].max_number : 0;

        if (currentUsersCount >= maxNumber) {
            socket.emit('roomFull', { success: false, message: 'Room is full' });
            return;
        }

        socket.join(roomId);
        socket.room = roomId;

        if (!roomUserLocations[roomId]) {
            roomUserLocations[roomId] = [];
        }
        if (!roomUsers[roomId]) {
            roomUsers[roomId] = [];
        }

        if (!roomUsers[roomId].includes(socket.username)) {
            roomUsers[roomId].push(socket.username);
        }

        roomUserCounts[roomId] = {
            userCount: roomUsers[roomId].length,
            maxNumber: markers[roomId] ? markers[roomId].max_number : 0
        };

        const isAdmin = markers[roomId].created_by === socket.username;
        socket.emit('joinedRoom', roomId, markers[roomId], isAdmin);

        if (roomMarkers[roomId]) {
            socket.emit('markerUpdate', roomMarkers[roomId].start);
            socket.emit('markerUpdate', roomMarkers[roomId].end);
        }

        io.to(roomId).emit('updateUserLocations', {
            userLocations: roomUserLocations[roomId],
            center: calculateCenter(roomUserLocations[roomId]),
            users: roomUsers[roomId]
        });

        io.emit('updateUserCount', {
            roomId: roomId,
            userCount: roomUserCounts[roomId].userCount,
            maxNumber: roomUserCounts[roomId].maxNumber
        });

        socket.emit('adminStatus', isAdmin);
        const currentMarkers = getMarkerPositions(roomId);
        socket.emit('initialMarkers', currentMarkers);
    });
    
    socket.on('markerMove', (data) => {
        if (!roomMarkers[data.roomId]) {
            roomMarkers[data.roomId] = {};
        }
        roomMarkers[data.roomId][data.type] = data;
        socket.to(data.roomId).emit('markerUpdate', data);
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
        markerData.admin = socket.id;
        const roomId = markerData.id;
        socket.join(roomId);
        socket.room = roomId;

        markers[roomId] = markerData;
        userMarkers[socket.username] = roomId;
        io.emit('newMarker', markerData);

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
        const username = socket.username;

        pool.query('SELECT * FROM markers WHERE created_by = ?', [username], (err, results) => {
            if (err) {
                console.error('Error checking existing marker:', err);
                socket.emit('markerDeleteError', { success: false, message: 'Database error' });
                return;
            }

            if (results.length === 0) {
                socket.emit('markerDeleteError', { success: false, message: 'No marker to delete' });
                return;
            }

            const markerId = results[0].id;

            delete markers[markerId];
            delete userMarkers[username];

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
    });

    socket.on('joinMarkerRoom', (markerId) => {
        const roomId = markerId;
        if (markers[roomId]) {
            const currentUsersCount = roomUsers[roomId] ? roomUsers[roomId].length : 0;
            const maxNumber = markers[roomId].max_number;
    
            // 사용자가 강퇴된 목록에 있는지 확인
            if (bannedUsers[roomId] && bannedUsers[roomId].includes(socket.username)) {
                socket.emit('banned', { success: false, message: 'You are banned from this room.' });
                return;
            }
    
            if (currentUsersCount < maxNumber) {
                socket.join(roomId);
                socket.room = roomId;
                
                // 사용자 목록에 추가
                if (!roomUsers[roomId]) {
                    roomUsers[roomId] = [];
                }
                if (!roomUsers[roomId].includes(socket.username)) {
                    roomUsers[roomId].push(socket.username);
                }
                socket.emit('joinedRoom', roomId, markers[roomId]);
            } else {
                socket.emit('roomFull', { success: false, message: 'Room is full' });
            }
        }
    });

    socket.on('kickUser', (data) => {
        const { roomId, username } = data;

        if (socket.username === markers[roomId].created_by) {
            if (!bannedUsers[roomId]) {
                bannedUsers[roomId] = [];
            }
            if (!bannedUsers[roomId].includes(username)) {
                bannedUsers[roomId].push(username);
            }

            io.sockets.sockets.forEach(s => {
                if (s.username === username && s.room === roomId) {
                    s.leave(roomId);
                    s.emit('kicked', { message: 'You have been kicked from the room.' });
                    io.to(roomId).emit('updateUserLocations', {
                        userLocations: roomUserLocations[roomId].filter(loc => loc.username !== username),
                        users: roomUsers[roomId].filter(user => user !== username)
                    });
                }
            });

            roomUserLocations[roomId] = roomUserLocations[roomId].filter(loc => loc.username !== username);
            roomUsers[roomId] = roomUsers[roomId].filter(user => user !== username);

            roomUserCounts[roomId] = {
                userCount: roomUsers[roomId].length,
                maxNumber: markers[roomId] ? markers[roomId].max_number : 0
            };

            io.emit('updateUserCount', {
                roomId: roomId,
                userCount: roomUserCounts[roomId].userCount,
                maxNumber: roomUserCounts[roomId].maxNumber
            });

            console.log(`${username} was kicked from room ${roomId} by ${socket.username}`);
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
        if (socket.room) {
            const roomId = socket.room;
            roomUsers[roomId] = roomUsers[roomId].filter(user => user !== socket.username);
    
            roomUserCounts[roomId] = {
                userCount: roomUsers[roomId].length,
                maxNumber: markers[roomId] ? markers[roomId].max_number : 0
            };

            // 유저 수 업데이트 이벤트 전송
            io.emit('updateUserCount', {
                roomId: roomId,
                userCount: roomUserCounts[roomId].userCount,
                maxNumber: roomUserCounts[roomId].maxNumber
            });}
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

['/intro.html','/login.js', '/login.css', '/index.html', '/register.html', '/script.js', '/gps_set.js', '/style.css', '/map.html','/admin.html'].forEach(file => {
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
                    res.status(500).json({ success: false, message: 'Database error' });
                    return;
                }
                if (results.length > 0) {
                    if (results[0].status === 1) {
                        res.status(400).json({ success: false, message: '이미 접속 중입니다.' });
                    } else {
                        req.session.loggedin = true;
                        req.session.username = username;

                        const isAdmin = results[0].is_admin;
                        req.session.isAdmin = isAdmin;

                        pool.query('UPDATE user_login SET status = 0 WHERE username = ?', [username], (err, result) => {
                            if (err) {
                                console.error('Failed to update user status:', err);
                                return;
                            }
                        });
                        /*pool.query('UPDATE user_login SET status = 0 WHERE username = ?', [username], (err, result) => {
                            if (err) {
                                console.error('Failed to update user status:', err);
                                return;
                            }
                        });*/

                        res.json({ success: true, isAdmin: isAdmin });
                    }
                } else {
                    res.status(400).json({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다' });
                }
            }
        );
    } else {
        res.status(400).json({ success: false, message: 'Username and Password are required' });
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

app.get('/hasMarker', (req, res) => {
    if (!req.session.username) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    const username = req.session.username;

    pool.query('SELECT * FROM markers WHERE created_by = ?', [username], (err, results) => {
        if (err) {
            console.error('Error checking existing marker:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        if (results.length > 0) {
            return res.json({ hasMarker: true, marker: results[0] });
        }

        res.json({ hasMarker: false });
    });
});

app.get('/getUserCounts', (req, res) => {
    const userCounts = {};

    for (const roomId in roomUsers) {
        userCounts[roomId] = {
            userCount: roomUsers[roomId].length,
            maxNumber: markers[roomId] ? markers[roomId].max_number : 0
        };
    }

    res.json(userCounts);
});

app.get('/hasMarker', (req, res) => {
    if (!req.session.username) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    const username = req.session.username;

    pool.query('SELECT * FROM markers WHERE created_by = ?', [username], (err, results) => {
        if (err) {
            console.error('Error checking existing marker:', err);
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        if (results.length > 0) {
            return res.json({ hasMarker: true, marker: results[0] });
        }

        res.json({ hasMarker: false });
    });
});

app.get('/api/messages', (req, res) => {
    const roomId = req.query.roomId;
    if (!roomId) {
        return res.status(400).send('Room ID is required');
    }

    pool.query('SELECT * FROM messages WHERE roomId = ? ORDER BY id ASC', [roomId], (err, results) => {
        if (err) {
            console.error('Error fetching messages from MySQL:', err);
            return res.status(500).send('Database error');
        }
        res.json(results);
    });
});

app.get('/map.html', (req, res) => {
    res.sendFile(__dirname + '/map.html');
});

server.listen(8080, () => {
    console.log('Server is listening on http://localhost:8080');
    loadMarkersFromDB(); // 서버 시작 시 마커 로드
});
