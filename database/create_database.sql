-- Chạy trong pgAdmin 4 khi đang kết nối database mặc định "postgres".
-- Không chạy khi Query Tool đang kết nối aair_db.
CREATE DATABASE aair_db
    WITH ENCODING = 'UTF8'
    TEMPLATE = template0;