const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'chat_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const server = http.createServer((req, res) => {
    if (req.url === '/') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading index.html');
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (req.url === '/script.js') {
        fs.readFile(path.join(__dirname, 'script.js'), (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading script.js');
            }
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(data);
        });
    } else if (req.url === '/gps_set.js') {
        fs.readFile(path.join(__dirname, 'gps_set.js'), (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading script.js');
            }
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(data);
        });
    } else if (req.url === '/style.css') {
        fs.readFile(path.join(__dirname, 'style.css'), (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading style.css');
            }
            res.writeHead(200, { 'Content-Type': 'text/css' });
            res.end(data);
        });
    } else if (req.url === '/map.png') {
        fs.readFile(path.join(__dirname, 'map.png'), (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading map.png');
            }
            res.writeHead(200, { 'Content-Type': 'image/png' });
            res.end(data);
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

const wss = new WebSocket.Server({ server });

let userLocations = [];
let users = [];

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(data) {
        const message = JSON.parse(data);

        if (message.action === 'join') {
            const userLocation = {
                username: message.username,
                x: Math.random() * 800,
                y: Math.random() * 600
            };
            userLocations.push(userLocation);
            users.push({ username: message.username });

            wss.clients.forEach(function each(client) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ action: 'updateUserLocations', userLocations: userLocations }));
                    client.send(JSON.stringify({ action: 'updateUsers', users: users }));
                }
            });
        } else if (message.action === 'delete') {
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
        userLocations = userLocations.filter(user => user.username !== ws.username);
        users = users.filter(user => user.username !== ws.username);
        wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ action: 'updateUserLocations', userLocations: userLocations }));
                client.send(JSON.stringify({ action: 'updateUsers', users: users }));
            }
        });
    });
});

server.listen(8080, () => {
    console.log('Server is listening on http://localhost:8080');
});
