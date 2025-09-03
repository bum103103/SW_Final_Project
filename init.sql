-- PostgreSQL 초기화 스크립트

-- 데이터베이스 생성 (docker-compose에서 이미 생성됨)
-- CREATE DATABASE chat_db;

-- chat_db 데이터베이스 사용
-- \c chat_db;

-- 기존 테이블들 삭제 (있는 경우)
DROP TABLE IF EXISTS markers CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS user_login CASCADE;

-- 사용자 로그인 테이블
CREATE TABLE user_login (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    status SMALLINT DEFAULT 0
);

-- 마커 테이블
CREATE TABLE markers (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    context TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    max_number INTEGER NOT NULL,
    type VARCHAR(255) NOT NULL,
    image VARCHAR(80) NOT NULL,
    FOREIGN KEY (created_by) REFERENCES user_login(username) ON DELETE CASCADE
);

-- 메시지 테이블
CREATE TABLE messages (
    id VARCHAR(40) PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    text VARCHAR(500) NOT NULL,
    roomId VARCHAR(40) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (username) REFERENCES user_login(username) ON DELETE CASCADE
);

-- 인덱스 생성 (성능 향상)
CREATE INDEX idx_messages_roomId ON messages(roomId);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE INDEX idx_markers_created_by ON markers(created_by);
CREATE INDEX idx_user_login_username ON user_login(username);

-- 초기 관리자 계정 생성
INSERT INTO user_login (username, password, is_admin) VALUES ('admin', 'admin123', TRUE);
INSERT INTO user_login (username, password) VALUES ('testuser', 'test123');
