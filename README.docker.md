# Docker 실행 방법

## DB만 Docker로 실행

```powershell
npm run db:up
```

또는:

```powershell
docker compose up -d db
```

MySQL 접속 정보:

- Host: `localhost`
- Port: `3307`
- User: `root`
- Password: `1234`
- Database: `chat_db`

로컬 Node 서버 실행:

```powershell
npm start
```

앱 주소:

```text
http://localhost:8080
```

## DB와 앱 전체를 Docker로 실행

```powershell
npm run docker:up
```

또는:

```powershell
docker compose up --build
```

앱 주소:

```text
http://localhost:8080
```

## 중지

DB 컨테이너만 중지:

```powershell
npm run db:down
```

전체 중지:

```powershell
npm run docker:down
```

DB 데이터를 포함해서 완전히 초기화하려면:

```powershell
docker compose down -v
```

## 포트 변경

이미 `3307` 또는 `8080` 포트를 사용 중이면 `.env` 파일을 만들고 값을 바꾸면 됩니다.

```powershell
Copy-Item .env.example .env
```

예시:

```env
DB_PORT=3308
APP_PORT=8081
```
