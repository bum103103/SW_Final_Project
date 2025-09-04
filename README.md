# 채팅 및 위치 기반 모임 앱

Node.js와 HTML/CSS로 작성된 기존 코드를 Django와 Vue.js로 마이그레이션한 프로젝트입니다.

## 🏗️ 프로젝트 구조

```
├── backend/                 # Django 백엔드
│   ├── accounts/           # 사용자 인증 앱
│   ├── chat/              # 채팅 및 마커 관리 앱
│   ├── chat_backend/      # Django 프로젝트 설정
│   └── manage.py          # Django 관리 명령어
├── frontend/               # Vue.js 프론트엔드
│   └── chat-frontend/     # Vue.js 앱
├── Dockerfile              # Docker 이미지 설정
├── docker-compose.yml      # Docker Compose 설정
└── README.md               # 프로젝트 설명서
```

## 🚀 실행 방법

### 1. Docker를 사용한 실행 (권장)

```bash
# 프로젝트 루트 디렉토리에서
docker-compose up --build
```

이 명령어는 다음을 실행합니다:
- PostgreSQL 데이터베이스 (포트 5432)
- Django 백엔드 (포트 8000)

### 2. 수동 실행

#### 백엔드 실행
```bash
cd backend
uv sync  # 의존성 설치
uv run python manage.py migrate  # 데이터베이스 마이그레이션
uv run python manage.py runserver  # 서버 실행
```

#### 프론트엔드 실행
```bash
cd frontend/chat-frontend
npm install  # 의존성 설치
npm run dev  # 개발 서버 실행 (포트 8080)
```

## 🔧 주요 기능

### 백엔드 (Django)
- **사용자 인증**: JWT 기반 인증 시스템
- **채팅**: Django Channels를 사용한 실시간 WebSocket 채팅
- **마커 관리**: 위치 기반 마커 생성/수정/삭제
- **데이터베이스**: PostgreSQL 사용

### 프론트엔드 (Vue.js)
- **사용자 인터페이스**: Vue 3 + Vue Router
- **실시간 채팅**: WebSocket을 통한 실시간 메시지
- **지도 기능**: 위치 기반 마커 표시 및 관리
- **반응형 디자인**: 모바일 친화적 UI

## 🌐 API 엔드포인트

- **인증**: `/api/auth/`
- **채팅**: `/api/chat/`
- **WebSocket**: `ws://localhost:8000/ws/chat/{room_id}/`

## 📱 사용법

1. **회원가입/로그인**: 사용자 계정 생성 및 로그인
2. **지도 보기**: 위치 기반 마커들을 지도에서 확인
3. **마커 생성**: 원하는 위치에 마커 생성 (음식점, 스터디룸, 택시 등)
4. **채팅**: 마커를 클릭하여 해당 위치의 채팅방 참여
5. **실시간 소통**: WebSocket을 통한 실시간 메시지 교환

## 🛠️ 기술 스택

### 백엔드
- Django 4.2+
- Django REST Framework
- Django Channels (WebSocket)
- PostgreSQL
- JWT 인증

### 프론트엔드
- Vue.js 3
- Vue Router
- Axios (HTTP 클라이언트)
- WebSocket API

### 인프라
- Docker & Docker Compose
- PostgreSQL 15

## 🔍 문제 해결

### 데이터베이스 연결 오류
- PostgreSQL 서비스가 실행 중인지 확인
- 환경변수 설정 확인 (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)

### WebSocket 연결 오류
- Django Channels 서비스가 실행 중인지 확인
- CORS 설정 확인
- JWT 토큰 유효성 확인

### 프론트엔드 빌드 오류
- Node.js 버전 확인 (16+ 권장)
- 의존성 재설치: `npm install`

## 📝 개발 노트

- 기존 Node.js 코드의 기능을 Django와 Vue.js로 완전히 마이그레이션
- WebSocket 연결을 통한 실시간 채팅 구현
- 위치 기반 서비스와 채팅 기능의 통합
- Docker를 통한 개발 환경 표준화
