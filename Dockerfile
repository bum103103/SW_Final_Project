FROM python:3.13-slim

# uv 설치
RUN pip install uv

WORKDIR /app

# .venv 폴더 제거 (로컬 가상환경 제외)
RUN rm -rf .venv venv env ENV 2>/dev/null || true

# 현재 디렉토리(backend)의 모든 파일 복사
COPY . .

# 의존성 설치 및 가상환경 생성
RUN uv sync

# 포트 노출
EXPOSE 8000

# Django Channels(ASGI) 서버 실행
CMD ["uv", "run", "daphne", "-b", "0.0.0.0", "-p", "8000", "chat_backend.asgi:application"]
