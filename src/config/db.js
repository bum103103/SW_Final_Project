const mysql = require('mysql2');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '1234',
    database: process.env.DB_NAME || 'chat_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise();

module.exports = pool;
