const request = require('supertest');
const { app, pool } = require('../chat.js');

describe('Comprehensive API Integration Tests', () => {
    let testUser = `testuser_${Date.now()}`;
    let testPassword = 'password123';
    let agent; // 세션 유지를 위한 agent

    beforeAll(async () => {
        agent = request.agent(app);
        // 테스트용 유저 미리 생성
        const hashedPassword = require('bcryptjs').hashSync(testPassword, 10);
        await pool.query('INSERT INTO user_login (username, password) VALUES (?, ?)', [testUser, hashedPassword]);
    });

    afterAll(async () => {
        // 테스트 데이터 정리
        await pool.query('DELETE FROM user_login WHERE username = ?', [testUser]);
        await pool.query('DELETE FROM messages WHERE username = ?', [testUser]);
        await pool.end();
    });

    describe('Authentication & Session', () => {
        test('GET /get-username - 로그인 전에는 401 에러를 반환해야 함', async () => {
            const response = await request(app).get('/get-username');
            expect(response.statusCode).toBe(401);
        });

        test('POST /login - 로그인 성공 및 세션 생성', async () => {
            const response = await agent
                .post('/login')
                .send({ username: testUser, password: testPassword });
            
            expect(response.statusCode).toBe(200);
            expect(response.body.success).toBe(true);
        });

        test('GET /get-username - 로그인 후에는 유저네임을 반환해야 함', async () => {
            const response = await agent.get('/get-username');
            expect(response.statusCode).toBe(200);
            expect(response.body.username).toBe(testUser);
        });
    });

    describe('Marker Operations', () => {
        test('POST /getMarkers - 마커 리스트를 가져와야 함', async () => {
            const response = await request(app)
                .post('/getMarkers')
                .send({ type: 'taxi' });
            
            expect(response.statusCode).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        test('GET /hasMarker - 로그인된 유저의 마커 보유 여부 확인', async () => {
            const response = await agent.get('/hasMarker');
            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('hasMarker');
        });
    });

    describe('Chat & Messages', () => {
        test('GET /api/messages - 메시지 리스트를 가져와야 함 (roomId 필요)', async () => {
            const response = await request(app).get('/api/messages?roomId=test_room');
            expect(response.statusCode).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        test('GET /api/messages - roomId가 없으면 400 에러를 반환해야 함', async () => {
            const response = await request(app).get('/api/messages');
            expect(response.statusCode).toBe(400);
        });
    });

    describe('System Info', () => {
        test('GET /getUserCounts - 실시간 유저 접속 카운트 반환', async () => {
            const response = await request(app).get('/getUserCounts');
            expect(response.statusCode).toBe(200);
            expect(typeof response.body).toBe('object');
        });
    });
});
