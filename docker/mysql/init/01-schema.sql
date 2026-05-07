CREATE DATABASE IF NOT EXISTS chat_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE chat_db;

CREATE TABLE IF NOT EXISTS markers (
  id varchar(255) NOT NULL,
  title varchar(255) NOT NULL,
  created_by varchar(255) NOT NULL,
  context text NOT NULL,
  latitude double NOT NULL,
  longitude double NOT NULL,
  max_number int NOT NULL,
  type varchar(255) NOT NULL,
  image char(80) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS messages (
  id char(40) NOT NULL,
  username char(20) NOT NULL,
  text varchar(200) NOT NULL,
  roomId char(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS user_login (
  id bigint PRIMARY KEY AUTO_INCREMENT,
  username varchar(255) NOT NULL,
  password varchar(30) NOT NULL,
  is_admin boolean DEFAULT false,
  status tinyint NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
