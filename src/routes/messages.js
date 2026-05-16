const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// 메시지 내역 조회
router.get('/api/messages', async (req, res) => {
    const roomId = req.query.roomId;
    if (!roomId) {
        return res.status(400).send('Room ID is required');
    }

    try {
        const [results] = await pool.query('SELECT * FROM messages WHERE roomId = ? ORDER BY id ASC', [roomId]);
        res.json(results);
    } catch (err) {
        console.error('Error fetching messages from MySQL:', err);
        res.status(500).send('Database error');
    }
});

module.exports = router;
