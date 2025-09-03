FROM node:18-alpine

WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm install

# 애플리케이션 소스 복사
COPY . .

# 포트 노출
EXPOSE 8080

# 애플리케이션 실행
CMD ["node", "chat.js"]
