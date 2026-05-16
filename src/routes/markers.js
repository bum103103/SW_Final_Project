const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// 마커 목록 조회 (타입별)
router.post('/getMarkers', async (req, res) => {
    const markerType = req.body.type;
    try {
        const [results] = await pool.execute('SELECT * FROM markers WHERE type = ?', [markerType]);
        res.json(results);
    } catch (err) {
        console.error('Error fetching markers:', err);
        res.status(500).send('Database error');
    }
});

// 내 마커 보유 여부 확인
router.get('/hasMarker', async (req, res) => {
    if (!req.session.username) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    try {
        const username = req.session.username;
        const [results] = await pool.query('SELECT * FROM markers WHERE created_by = ?', [username]);
        if (results.length > 0) {
            return res.json({ hasMarker: true, marker: results[0] });
        }
        res.json({ hasMarker: false });
    } catch (err) {
        console.error('Error checking existing marker:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

module.exports = router;
