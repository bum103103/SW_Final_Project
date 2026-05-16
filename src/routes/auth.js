const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

// 회원가입
router.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Both username and password are required' });
    }

    try {
        const [results] = await pool.execute('SELECT username FROM user_login WHERE username = ?', [username]);
        if (results.length > 0) {
            return res.json({ success: false, message: 'Username already exists.' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        await pool.query('INSERT INTO user_login (username, password) VALUES (?, ?)', [username, hashedPassword]);
        res.json({ success: true, message: '가입이 성공되었습니다!' });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// 로그인
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and Password are required' });
    }

    try {
        const [results] = await pool.execute('SELECT * FROM user_login WHERE username = ?', [username]);
        if (results.length > 0 && bcrypt.compareSync(password, results[0].password)) {
            if (results[0].status === 1) {
                return res.status(400).json({ success: false, message: '이미 접속 중입니다.' });
            }

            req.session.loggedin = true;
            req.session.username = username;
            req.session.isAdmin = results[0].is_admin;

            await pool.query('UPDATE user_login SET status = 1 WHERE username = ?', [username]);
            res.json({ success: true, isAdmin: results[0].is_admin });
        } else {
            res.status(400).json({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다' });
        }
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// 유저 이름 조회
router.get('/get-username', (req, res) => {
    if (req.session.loggedin) {
        res.json({ username: req.session.username });
    } else {
        res.status(401).json({ error: 'Not logged in' });
    }
});

module.exports = router;
