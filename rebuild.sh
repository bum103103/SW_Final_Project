#!/bin/bash

echo "🐳 Docker 재빌드 시작..."

echo "📁 .venv 폴더 제거 중..."
if [ -d "backend/.venv" ]; then
    rm -rf backend/.venv
    echo "✅ .venv 폴더 제거 완료"
else
    echo "ℹ️ .venv 폴더가 없습니다"
fi

echo "🚀 Docker 재빌드 시작..."
docker-compose down
docker-compose up --build

echo "🎉 완료!"
