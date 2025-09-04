@echo off
echo 🐳 Docker 재빌드 시작...

echo 📁 .venv 폴더 제거 중...
if exist "backend\.venv" (
    rmdir /s /q "backend\.venv"
    echo ✅ .venv 폴더 제거 완료
) else (
    echo ℹ️ .venv 폴더가 없습니다
)

echo 🚀 Docker 재빌드 시작...
docker-compose down
docker-compose up --build

echo 🎉 완료!
pause
