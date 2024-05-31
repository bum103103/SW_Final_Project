## 지금까지 작성한 모든 db문은 다음과 같다.
```
chat_db에 
마커 테이블,
메시지 테이블,
유저 로그인 테이블이 만들어 질 것이다. 
```

CREATE DATABASE chat_db;
use chat_db;

drop table if exists markers;
create table markers (
    title varchar(255) not null,
    created_by varchar(255),
    context text,
    latitude double NOT NULL,
    longitude double NOT NULL,
    max_number int not null default 4,
    type varchar(30) not null,
    created_at timestamp default current_timestamp
);
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
   status tinyint not null default 0
);