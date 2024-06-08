## 지금까지 작성한 모든 db문은 다음과 같다.

chat_db에 
마커 테이블,
메시지 테이블,
유저 로그인 테이블이 만들어 질 것이다. 

```sql
CREATE DATABASE chat_db;
use chat_db;

drop table if exists markers;
CREATE TABLE `markers` (
  `id` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `created_by` varchar(255) NOT NULL,
  `context` text NOT NULL,
  `latitude` double NOT NULL,
  `longitude` double NOT NULL,
  `max_number` int NOT NULL,
  `type` varchar(255) NOT NULL,
  `image` char(80) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

drop table if exists messages;
create table `messages` (
  `id` char(40) not null,
  `username` char(20) not null,
  `text` varchar(200) not null,
  `roomId` char(40) not null
);

drop table if exists user_login;
create table user_login(
   id bigint primary key auto_increment,
   username varchar(255) not null,
   password varchar(30) not null,
   is_admin BOOLEAN DEFAULT FALSE,
   status tinyint not null default 0
);

user_login에 관리자 구분 컬럼인 is_admin(boolean 타입) 추가
ALTER TABLE user_login ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;

초기 관리자 설정
-새로운 관리자 설정
INSERT INTO user_login (username, password, is_admin) VALUES ('admin_username', 'admin_password', TRUE);
-기존 사용자 계정을 관리자로 설정
UPDATE user_login SET is_admin = TRUE WHERE username = 'existing_username';

```
