# 실시간 채팅 및 위치 공유 애플리케이션

PostgreSQL과 Docker를 사용한 실시간 채팅 및 위치 기반 마커 시스템입니다.

## 🚀 빠른 시작 (Docker 사용 - 추천)

### 1. Docker 설치 확인
```bash
docker --version
docker-compose --version
```

### 2. 프로젝트 실행
```bash
# 의존성 설치 및 컨테이너 빌드
npm run docker:build

# 애플리케이션 실행
npm run docker:up
```

### 3. 접속
- 웹 브라우저에서 http://localhost:8080 접속
- 초기 관리자 계정: `admin` / `admin123`
- 테스트 계정: `testuser` / `test123`

### 4. 중지
```bash
npm run docker:down
```

## 🛠️ 로컬 개발 환경 설정

### 1. PostgreSQL 설치
- PostgreSQL 15 이상 설치
- 데이터베이스 생성: `chat_db`
- 사용자: `postgres`, 비밀번호: `postgres123`

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
`.env` 파일을 생성하고 다음 내용을 추가:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres123
DB_NAME=chat_db
SESSION_SECRET=your_secret_key_here
PORT=8080
```

### 4. 데이터베이스 초기화
PostgreSQL에 접속하여 `init.sql` 파일의 내용을 실행

### 5. 애플리케이션 실행
```bash
# 프로덕션 모드
npm start

# 개발 모드 (nodemon)
npm run dev
```

## 📁 프로젝트 구조

```
├── chat.js                 # 메인 서버 파일
├── init.sql               # PostgreSQL 초기화 스크립트
├── docker-compose.yml     # Docker 구성 파일
├── Dockerfile            # Docker 이미지 설정
├── package.json          # Node.js 의존성
├── index.html           # 메인 채팅 인터페이스
├── map.html            # 지도 인터페이스
├── login.html          # 로그인 페이지
└── images/             # 정적 이미지 파일들
```

## 🗄️ 데이터베이스 스키마

### 테이블 구조
- **user_login**: 사용자 정보 (id, username, password, is_admin, status)
- **markers**: 위치 마커 (id, title, created_by, context, latitude, longitude, max_number, type, image)
- **messages**: 채팅 메시지 (id, username, text, roomId, timestamp)

## 🔧 주요 기능

- ✅ 실시간 채팅 (Socket.IO)
- ✅ 위치 기반 마커 시스템
- ✅ 사용자 관리 및 권한 시스템
- ✅ Docker 컨테이너화
- ✅ PostgreSQL 데이터베이스
- ✅ 세션 관리
- ✅ 반응형 웹 디자인

## 🌐 API 엔드포인트

- `GET /` - 메인 페이지
- `POST /login` - 로그인
- `POST /signup` - 회원가입
- `GET /index.html` - 채팅 페이지
- `GET /map.html` - 지도 페이지
- `GET /api/messages?roomId={id}` - 방 메시지 조회
- `POST /getMarkers` - 마커 조회

## 🔒 보안 기능

- XSS 보호
- 세션 기반 인증
- SQL 인젝션 방지 (파라미터화 쿼리)
- CORS 설정

## 🐛 문제 해결

### Docker 관련
```bash
# 컨테이너 로그 확인
docker-compose logs

# 컨테이너 재시작
docker-compose restart

# 전체 재설정
docker-compose down -v
docker-compose up --build
```

### 데이터베이스 연결 오류
- PostgreSQL이 실행 중인지 확인
- 환경 변수 설정 확인
- Docker 네트워크 연결 상태 확인

## 📝 개발자 노트

- 기존 MySQL에서 PostgreSQL로 마이그레이션 완료
- 모든 쿼리가 파라미터화되어 SQL 인젝션 방지
- Docker를 통한 일관된 개발 환경 제공
- 실시간 채팅을 위한 Socket.IO 최적화
