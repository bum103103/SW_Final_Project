# SW_FinalSubject
SW 실습 기말 대체 과제 레포지토리

1. 과제의 목적: '젠리'라는 앱의 동아대 버전(디스이즈 처럼) 구현하는 것이 목적 

2. SW 개발은 에자일 기법으로 프로젝트를 진행함 [모듈화]

3. 어떻게 수정하는가? (수정 방식)
(예시로 설명)
- 세진이는 수정할 아이디어가 떠올랐다. 
- 카카오톡 단톡방에 [허세진 소스 수정 시작 3시 39분] 올리기
- 세진이가 깃허브에있는 전체 파일을 다운 후 - 원하는 기능을 수정하고[즉 모듈을 추가하고]
- 전체 파일을 다시 깃허브에 올린다.
- 카카오톡 단톡방에 [허세진 소스 수정 완료 4시 39분] 올리기
- 이 과정을 반복

4. 수정 완료 이후
일지에 모듈화한 부분을 날짜, 시간 추가해서 올림. 날짜는 위에 마크다운 문법으로 표시, 시간은 이름 뒤에 표시.

---------------------------------------------------------------------------------------
MySQL을 사용하여 채팅 메시지를 데이터베이스에 저장하려면 다음 단계를 따르시면 됩니다:

1. **MySQL 데이터베이스 설정**:
   - MySQL 서버를 설치하고 실행합니다.
   - 채팅 메시지를 저장할 데이터베이스와 테이블을 생성합니다.

2. **Node.js에서 MySQL 연동**:
   - `mysql2` 패키지를 설치합니다.
   - MySQL 데이터베이스에 연결하고, 메시지를 저장하는 로직을 작성합니다.

3. **서버 코드 수정**:
   - WebSocket 서버에서 메시지를 수신할 때마다 해당 메시지를 데이터베이스에 저장하도록 합니다.

### MySQL 데이터베이스 설정

먼저 MySQL 서버에 접속하여 데이터베이스와 테이블을 생성합니다.

```sql
CREATE DATABASE chat_db;

USE chat_db;

CREATE TABLE messages (
    id BIGINT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    text TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Node.js에서 MySQL 연동

1. `mysql2` 패키지를 설치합니다.

```sh
npm install mysql2
```

2. **chat.js** 파일을 수정하여 MySQL과 연동합니다.

### chat.js 수정

```javascript
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');

// MySQL 데이터베이스 연결 설정
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'your_username', // MySQL 사용자 이름
    password: 'your_password', // MySQL 비밀번호
    database: 'chat_db'
});

connection.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

// HTTP 서버 생성
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
    } else if (req.url === '/style.css') {
        fs.readFile(path.join(__dirname, 'style.css'), (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading style.css');
            }
            res.writeHead(200, { 'Content-Type': 'text/css' });
            res.end(data);
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// WebSocket 서버 생성
const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(data) {
        const message = JSON.parse(data);
        if (message.action && message.action === 'delete') {
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
            // 메시지를 MySQL 데이터베이스에 저장
            connection.query('INSERT INTO messages (id, username, text) VALUES (?, ?, ?)', [message.messageId, message.username, message.text], (err) => {
                if (err) {
                    console.error('Error saving message to MySQL:', err);
                } else {
                    console.log('Message saved to MySQL');
                }
            });
        }
    });
});

server.listen(8080, () => {
    console.log('Server is listening on http://localhost:8080');
});
```

위 코드에서는 MySQL 데이터베이스에 연결하고, WebSocket 메시지를 받을 때마다 해당 메시지를 `messages` 테이블에 저장합니다. MySQL 사용자 이름(`your_username`)과 비밀번호(`your_password`)를 실제 MySQL 사용자 정보로 바꾸어야 합니다.

이제 서버를 다시 시작하면, 채팅 메시지가 MySQL 데이터베이스에 저장될 것입니다.

---------------------------------------------------------------------------------


## 5월 12일 ##
- 정적으로 접속하던 것을 동적 연결으로 전환함. 이제 localhost:8080 으로 접속 가능 [김범준 16:41]
  
- mysql과 서버 연동 완료    [김범준 5.12 16:41]

- 다인원 접속 시 인원 이름이 접속한 사람의 이름으로만 출력되던 문제 해결 완료    [김범준 16:41]

- 배경화면을 동아대학교 약도 추가(현재는 그냥 map.png로 정적으로 하드코딩함. 그러나 gps로 동적으로 표시 가능하게 해보겠음.)    [김범준 16:41]

- 약도에 동적(dynamic)으로 인원이 추가될 때마다 그 인원의 위치 표시(현재 위치는 일단 랜덤으로 표시하게함)  [김범준 16:41]

- 채팅창과 맵 분리    [김범준 16:41]

- 채팅창 ui 개선, 실시간으로 채팅창 인원 파악 가능    [김범준 16:41]

## 5월 13일 ##



## 5월 14일 ##



## 5월 14일 ##
   
