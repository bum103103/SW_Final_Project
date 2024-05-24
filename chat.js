const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
const session = require('express-session');

const sessionParser = session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // HTTPS를 사용하는 경우 true로 설정하세요.
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'chat_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

let userLocations = [];
let users = [];

app.use(sessionParser);

// 웹소켓 서버 이벤트 리스너


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

wss.on('connection', function connection(ws, req) {

    sessionParser(req, {}, () => {
        if (req.session.username) {
            ws.username = req.session.username;
            console.log(`Session user: ${req.session.username}`);
        }
    });

    ws.on('message', function incoming(data) {
        const message = JSON.parse(data);

        if (message.action === 'updateLocation') {
            const { latitude, longitude } = message;
            const username = ws.username;
    
            const userLocation = { username, latitude, longitude };
            const index = userLocations.findIndex(loc => loc.username === username);
            if (index !== -1) {
                userLocations[index] = userLocation;
            } else {
                userLocations.push(userLocation);
            }
            const center = calculateCenter(userLocations);

            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        action: 'updateUserLocations',
                        userLocations: userLocations,
                        center: center
                    }));
                }
            });

        }else if (message.action === 'join') {
            const userLocation = {
                username: message.username,
                x: Math.random() * 800,
                y: Math.random() * 600
            };
            userLocations.push(userLocation);
            users.push({ username: message.username });

            wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ action: 'updateUsers', users: users }));
                }
            });
        } else if (message.action === 'delete') {
            pool.query('DELETE FROM messages WHERE id = ?', [message.messageId], (err) => {
                if (err) {
                    console.error('Error deleting message from MySQL:', err);
                } else {
                    console.log('Message deleted from MySQL');
                }
            });
            wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ action: 'delete', messageId: message.messageId }));
                }
            });
        } else {
            wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ text: message.text, messageId: message.messageId, username: message.username }));
                }
            });

            pool.query('INSERT INTO messages (id, username, text) VALUES (?, ?, ?)', [message.messageId, message.username, message.text], (err) => {
                if (err) {
                    console.error('Error saving message to MySQL:', err);
                } else {
                    console.log('Message saved to MySQL');
                }
            });
        }
    });

    ws.on('close', function () {
        console.log(`WebSocket disconnected: ${ws.username}`);
        if (ws.username) {
            pool.query('UPDATE user_login SET status = 0 WHERE username = ?', [ws.username], (err, result) => {
                if (err) {
                    console.error('Failed to update user status on disconnect:', err);
                    return;
                }
                console.log(`Status updated to 0 for user ${ws.username}`);
            });
        }

        userLocations = userLocations.filter(user => user.username !== ws.username);
        users = users.filter(user => user.username !== ws.username);
        wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ action: 'updateUserLocations', userLocations: userLocations }));
                client.send(JSON.stringify({ action: 'updateUsers', users: users }));
                client.send(JSON.stringify({
                    action: 'removeMarker',
                    username: ws.username
                }));
            }
        });
    });
});




app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // HTTPS가 아니라면 false로 설정
}));


// HTTP 서버를 사용하는 추가 경로 설정
['/login.js', '/login.css', '/index.html', '/register.html', '/script.js', '/gps_set.js', '/style.css', '/map.html' ].forEach(file => {
    app.get(file, (req, res) => {
        // 파일 경로를 보다 명확하게 지정
        const filePath = path.join(__dirname, file); // 'public' 디렉토리 내 파일을 가정
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.status(500).send('Error loading ' + file);
                return;
            }
            // 적절한 Content-Type 설정
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
                    res.redirect('/index.html');
                } else {
                    res.send('Incorrect Username and/or Password!');
                }
            }
        );
    } else {
        res.status(400).send('Username and Password are required');
    }
});

app.get('/map.html', (req, res) => {
    res.sendFile(__dirname + '/map.html');
  });

server.listen(8080, () => {
    console.log('Server is listening on http://localhost:8080');
});