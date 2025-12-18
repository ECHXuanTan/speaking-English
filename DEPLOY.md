# Hướng dẫn Deploy Hệ thống Thi Nói lên Ubuntu Server

## Tổng quan

Hướng dẫn này giúp bạn deploy ứng dụng **speaking-English** (Hệ thống Thi Nói) lên server Ubuntu đang chạy sẵn một ứng dụng khác (portal) mà không ảnh hưởng đến nhau.

### Thông tin môi trường

- **Server hiện tại**: Ubuntu với Nginx + PM2
- **App hiện có**: portal.ptnk.edu.vn (port 3000, PM2 #0)
- **App mới**: exam.ptnk.edu.vn (port 3001, PM2 #1)
- **Database**: SQLite (mỗi app có DB riêng)
- **Node.js**: v18+

---

## Bước 1: Chuẩn bị và Upload Code

### 1.1. Trên máy local

```bash
# Di chuyển vào thư mục project
cd d:\PTNK\Project\speaking-English

# Nén project (loại trừ node_modules, dist, .git)
tar -czf speaking-english.tar.gz --exclude=node_modules --exclude=dist --exclude=.git .

# Upload lên server (thay YOUR_USERNAME và YOUR_SERVER_IP)
scp speaking-english.tar.gz YOUR_USERNAME@YOUR_SERVER_IP:/home/speaking-english/
```

### 1.2. Trên server Ubuntu

```bash
# SSH vào server
ssh YOUR_USERNAME@YOUR_SERVER_IP

# Tạo thư mục project (nếu chưa có)
sudo mkdir -p /home/speaking-english
sudo chown $USER:$USER /home/speaking-english

# Di chuyển file vào thư mục
cd /home/speaking-english

# Giải nén
tar -xzf speaking-english.tar.gz

# Xóa file nén
rm speaking-english.tar.gz

# Kiểm tra
ls -la
```

---

## Bước 2: Cài đặt Dependencies và Build

```bash
cd /home/speaking-english

# Cài đặt Node.js dependencies
npm install

# Build TypeScript thành JavaScript
npm run build

# Kiểm tra build thành công
ls -la dist/
# Bạn sẽ thấy file app.js và các file khác
```

---

## Bước 3: Tạo File Environment (.env)

```bash
cd /home/speaking-english

# Tạo file .env
nano .env
```

**Nội dung file `.env`:**

```env
# Environment
NODE_ENV=production

# Server Config
PORT=3001
HOST=0.0.0.0

# Security (QUAN TRỌNG: Thay đổi SESSION_SECRET)
SESSION_SECRET=your-super-secret-key-change-this-in-production-12345

# Database
DB_NAME=exam_system.db
```

**Lưu file**: Nhấn `Ctrl+O`, `Enter`, sau đó `Ctrl+X`

> ⚠️ **Lưu ý**: Thay đổi `SESSION_SECRET` thành một chuỗi ngẫu nhiên phức tạp!

---

## Bước 4: Khởi tạo Database

```bash
cd /home/speaking-english

# Chạy script khởi tạo database
npm run init-db-safe

# Kiểm tra database đã được tạo
ls -la database/
# Bạn sẽ thấy file exam_system.db
```

---

## Bước 5: Cấu hình PM2

### 5.1. Tạo file ecosystem.config.js

```bash
cd /home/speaking-english
nano ecosystem.config.js
```

**Nội dung file `ecosystem.config.js`:**

```javascript
module.exports = {
  apps: [{
    name: 'speaking-english',
    script: './dist/app.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

### 5.2. Tạo thư mục logs

```bash
mkdir -p /home/speaking-english/logs
```

### 5.3. Khởi động ứng dụng với PM2

```bash
# Khởi động ứng dụng
pm2 start ecosystem.config.js

# Kiểm tra trạng thái
pm2 list

# Bạn sẽ thấy output như sau:
# ┌─────┬──────────────────┬─────────┬────────┬─────────┐
# │ id  │ name             │ mode    │ status │ restart │
# ├─────┼──────────────────┼─────────┼────────┼─────────┤
# │ 0   │ portal           │ fork    │ online │ 0       │
# │ 1   │ speaking-english │ fork    │ online │ 0       │
# └─────┴──────────────────┴─────────┴────────┴─────────┘

# Xem logs real-time
pm2 logs speaking-english

# Nếu mọi thứ OK, lưu cấu hình PM2
pm2 save

# Đảm bảo PM2 tự khởi động khi server reboot
pm2 startup
# Chạy command mà PM2 gợi ý (thường là: sudo env PATH=...)
```

### 5.4. Test ứng dụng qua localhost

```bash
# Test API endpoint
curl http://localhost:3001/api/auth/check

# Nếu thành công, bạn sẽ nhận được response JSON
```

---

## Bước 6: Cấu hình Nginx

### 6.1. Tạo file config Nginx

```bash
sudo nano /etc/nginx/sites-available/exam.ptnk.edu.vn
```

**Nội dung file Nginx config:**

```nginx
server {
    listen 80;
    listen [::]:80;
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    # SSL certificates (sẽ được certbot tự động thêm)
    # ssl_certificate /etc/letsencrypt/live/exam.ptnk.edu.vn/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/exam.ptnk.edu.vn/privkey.pem;

    server_name exam.ptnk.edu.vn;

    # Logs
    access_log /var/log/nginx/exam.ptnk.edu.vn.access.log;
    error_log /var/log/nginx/exam.ptnk.edu.vn.error.log;

    # Cho phép truy cập /.well-known (cho SSL cert validation)
    location ~ /.well-known {
        auth_basic off;
        allow all;
    }

    # Proxy API requests tới backend trên port 3001
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Server $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $http_host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_pass_request_headers on;
        proxy_max_temp_file_size 0;
        proxy_connect_timeout 900;
        proxy_send_timeout 900;
        proxy_read_timeout 900;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
        proxy_temp_file_write_size 256k;
    }

    # Proxy Socket.IO connections
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # WebSocket timeout settings
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Serve static files
    location / {
        root /home/speaking-english/public;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

    # Serve uploaded audio files
    location /uploads/ {
        alias /home/speaking-english/uploads/;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 6.2. Enable site và reload Nginx

```bash
# Tạo symbolic link
sudo ln -s /etc/nginx/sites-available/exam.ptnk.edu.vn /etc/nginx/sites-enabled/

# Kiểm tra cấu hình Nginx
sudo nginx -t

# Nếu output là "syntax is ok" và "test is successful", reload Nginx
sudo systemctl reload nginx

# Kiểm tra trạng thái Nginx
sudo systemctl status nginx
```

---

## Bước 7: Cấu hình DNS

### 7.1. Thêm bản ghi DNS

Truy cập vào trang quản lý DNS của tên miền `ptnk.edu.vn` và thêm bản ghi A:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | exam | [IP của server] | 3600 |

Hoặc nếu muốn dùng subdomain khác:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | thi-noi | [IP của server] | 3600 |

### 7.2. Kiểm tra DNS propagation

```bash
# Kiểm tra DNS đã resolve chưa
nslookup exam.ptnk.edu.vn

# Hoặc dùng dig
dig exam.ptnk.edu.vn
```

> ℹ️ **Lưu ý**: DNS có thể mất 5-30 phút để propagate.

---

## Bước 8: Cài đặt SSL Certificate (Let's Encrypt)

### 8.1. Cài đặt Certbot (nếu chưa có)

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
```

### 8.2. Tạo SSL certificate

```bash
# Tạo certificate cho domain
sudo certbot --nginx -d exam.ptnk.edu.vn

# Certbot sẽ hỏi một số câu hỏi:
# 1. Email: nhập email của bạn
# 2. Agree to Terms: Yes (Y)
# 3. Share email: No (N) hoặc Yes (Y) tùy bạn
# 4. Redirect HTTP to HTTPS: 2 (Redirect)
```

### 8.3. Kiểm tra SSL

```bash
# Xem danh sách certificates
sudo certbot certificates

# Test SSL
curl https://exam.ptnk.edu.vn/api/auth/check
```

### 8.4. Auto-renewal

```bash
# Certbot tự động setup cron job để renew
# Kiểm tra dry-run renewal
sudo certbot renew --dry-run

# Nếu thành công, certificate sẽ tự động renew khi sắp hết hạn
```

---

## Bước 9: Phân quyền và Bảo mật

### 9.1. Phân quyền thư mục

```bash
cd /home/speaking-english

# Đảm bảo thư mục uploads có quyền ghi
sudo chown -R www-data:www-data uploads/
sudo chmod -R 755 uploads/

# Đảm bảo database có quyền đọc/ghi
sudo chown -R www-data:www-data database/
sudo chmod -R 755 database/

# Phân quyền cho logs
sudo chown -R $USER:$USER logs/
sudo chmod -R 755 logs/
```

### 9.2. Firewall (nếu chưa cấu hình)

```bash
# Cho phép HTTP, HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Kiểm tra firewall
sudo ufw status
```

---

## Bước 10: Kiểm tra và Xác nhận

### 10.1. Checklist

- [ ] PM2 đang chạy app `speaking-english` (ID #1)
- [ ] Nginx config đúng và đã reload
- [ ] DNS đã trỏ đúng về IP server
- [ ] SSL certificate đã được cài đặt
- [ ] Database đã được khởi tạo
- [ ] Thư mục uploads có quyền ghi
- [ ] App truy cập được qua HTTPS

### 10.2. Test các endpoint

```bash
# Test API
curl https://exam.ptnk.edu.vn/api/auth/check

# Test trang chủ
curl https://exam.ptnk.edu.vn/

# Xem logs PM2
pm2 logs speaking-english --lines 50

# Xem logs Nginx
sudo tail -f /var/log/nginx/exam.ptnk.edu.vn.access.log
sudo tail -f /var/log/nginx/exam.ptnk.edu.vn.error.log
```

### 10.3. Test trên trình duyệt

1. Mở trình duyệt và truy cập: `https://exam.ptnk.edu.vn`
2. Test đăng nhập supervisor
3. Test đăng nhập student
4. Test tạo kỳ thi
5. Test ghi âm (cần HTTPS để microphone hoạt động)

---

## Các Lệnh Quản Lý Hữu Ích

### PM2

```bash
# Xem danh sách apps
pm2 list

# Restart app
pm2 restart speaking-english

# Stop app
pm2 stop speaking-english

# Start app
pm2 start speaking-english

# Xem logs
pm2 logs speaking-english

# Xem logs với số dòng cụ thể
pm2 logs speaking-english --lines 100

# Monitor real-time
pm2 monit

# Xem thông tin chi tiết
pm2 show speaking-english

# Xóa app khỏi PM2
pm2 delete speaking-english
```

### Nginx

```bash
# Test config
sudo nginx -t

# Reload (không downtime)
sudo systemctl reload nginx

# Restart
sudo systemctl restart nginx

# Stop
sudo systemctl stop nginx

# Start
sudo systemctl start nginx

# Xem status
sudo systemctl status nginx

# Xem logs
sudo tail -f /var/log/nginx/exam.ptnk.edu.vn.access.log
sudo tail -f /var/log/nginx/exam.ptnk.edu.vn.error.log
```

### Database

```bash
# Truy cập SQLite database
sqlite3 /home/speaking-english/database/exam_system.db

# Trong SQLite prompt:
.tables                    # Xem danh sách tables
.schema students           # Xem schema của table
SELECT * FROM students;    # Query data
.quit                      # Thoát
```

### System

```bash
# Kiểm tra disk usage
df -h

# Kiểm tra memory
free -h

# Kiểm tra CPU, RAM usage của apps
htop

# Kiểm tra port đang listen
sudo netstat -tulpn | grep LISTEN

# Hoặc dùng ss
sudo ss -tulpn | grep LISTEN
```

---

## Troubleshooting

### Vấn đề 1: PM2 app không start được

**Triệu chứng**: `pm2 list` hiển thị status "errored" hoặc "stopped"

**Giải pháp**:
```bash
# Xem logs để tìm lỗi
pm2 logs speaking-english --lines 100

# Thử chạy trực tiếp để xem lỗi
cd /home/speaking-english
node dist/app.js

# Kiểm tra port 3001 có bị chiếm không
sudo netstat -tulpn | grep 3001

# Kill process nếu port bị chiếm
sudo kill -9 [PID]
```

### Vấn đề 2: Nginx 502 Bad Gateway

**Triệu chứng**: Truy cập website báo lỗi 502

**Giải pháp**:
```bash
# Kiểm tra PM2 app có chạy không
pm2 list

# Kiểm tra logs Nginx
sudo tail -f /var/log/nginx/exam.ptnk.edu.vn.error.log

# Kiểm tra port backend có listen không
curl http://localhost:3001/api/auth/check

# Restart cả PM2 và Nginx
pm2 restart speaking-english
sudo systemctl restart nginx
```

### Vấn đề 3: SSL certificate không hoạt động

**Triệu chứng**: Truy cập HTTPS báo lỗi certificate

**Giải pháp**:
```bash
# Kiểm tra certificate
sudo certbot certificates

# Renew certificate
sudo certbot renew

# Kiểm tra Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Vấn đề 4: Database permission denied

**Triệu chứng**: App báo lỗi không ghi được database

**Giải pháp**:
```bash
cd /home/speaking-english

# Phân quyền lại
sudo chown -R www-data:www-data database/
sudo chmod -R 755 database/

# Restart app
pm2 restart speaking-english
```

### Vấn đề 5: Uploads không hoạt động

**Triệu chứng**: Không upload được file âm thanh

**Giải pháp**:
```bash
cd /home/speaking-english

# Tạo thư mục nếu chưa có
mkdir -p uploads/audio uploads/temp

# Phân quyền
sudo chown -R www-data:www-data uploads/
sudo chmod -R 755 uploads/

# Restart app
pm2 restart speaking-english
```

### Vấn đề 6: Socket.IO không kết nối được

**Triệu chứng**: Real-time features không hoạt động

**Giải pháp**:
```bash
# Kiểm tra Nginx config có cấu hình /socket.io/ không
sudo nano /etc/nginx/sites-available/exam.ptnk.edu.vn

# Kiểm tra logs
pm2 logs speaking-english
sudo tail -f /var/log/nginx/exam.ptnk.edu.vn.error.log

# Test Socket.IO endpoint
curl https://exam.ptnk.edu.vn/socket.io/

# Reload Nginx
sudo systemctl reload nginx
```

---

## Update và Maintenance

### Update code

```bash
# SSH vào server
ssh YOUR_USERNAME@YOUR_SERVER_IP

# Di chuyển vào thư mục project
cd /home/speaking-english

# Backup trước khi update
cp -r . ../speaking-english-backup-$(date +%Y%m%d)

# Pull code mới (nếu dùng git)
git pull origin main

# Hoặc upload file mới từ local
# Trên local: scp speaking-english.tar.gz ...
# Trên server: tar -xzf speaking-english.tar.gz

# Cài đặt dependencies mới (nếu có)
npm install

# Build lại
npm run build

# Restart app
pm2 restart speaking-english

# Xem logs để đảm bảo app chạy OK
pm2 logs speaking-english --lines 50
```

### Backup database

```bash
# Backup database
cp /home/speaking-english/database/exam_system.db \
   /home/speaking-english/database/exam_system.db.backup.$(date +%Y%m%d_%H%M%S)

# Hoặc backup ra ngoài server
scp YOUR_USERNAME@YOUR_SERVER_IP:/home/speaking-english/database/exam_system.db \
    ./exam_system.db.backup.$(date +%Y%m%d)
```

### Restore database

```bash
# Stop app trước
pm2 stop speaking-english

# Restore từ backup
cp /home/speaking-english/database/exam_system.db.backup.20250118_120000 \
   /home/speaking-english/database/exam_system.db

# Start app lại
pm2 start speaking-english
```

### Monitor logs

```bash
# Setup logrotate để tránh logs quá lớn
sudo nano /etc/logrotate.d/speaking-english
```

**Nội dung file logrotate:**
```
/home/speaking-english/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    missingok
    copytruncate
}
```

---

## Tối ưu Performance

### 1. Enable Gzip trong Nginx

Thêm vào file nginx config:
```nginx
# Gzip compression
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
```

### 2. Cache static files

Đã có trong config:
```nginx
location /uploads/ {
    alias /home/speaking-english/uploads/;
    expires 1d;
    add_header Cache-Control "public, immutable";
}
```

### 3. PM2 Cluster Mode (nếu cần)

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'speaking-english',
    script: './dist/app.js',
    instances: 2,  // Thay đổi từ 1 sang 2 hoặc 'max'
    exec_mode: 'cluster',  // Thay đổi từ 'fork' sang 'cluster'
    // ... các config khác
  }]
};
```

---

## Thông tin Bổ sung

### Cấu trúc thư mục trên server

```
/home/speaking-english/
├── dist/                  # Compiled JavaScript
├── public/                # Static files (HTML, CSS, JS)
├── database/              # SQLite database
├── uploads/               # Uploaded audio files
│   ├── audio/
│   └── temp/
├── logs/                  # Application logs
├── node_modules/          # Dependencies
├── src/                   # Source TypeScript (có thể xóa sau khi build)
├── .env                   # Environment variables
├── ecosystem.config.js    # PM2 config
└── package.json
```

### Port sử dụng

| Service | Port | Sử dụng |
|---------|------|---------|
| Portal | 3000 | Backend API portal |
| Speaking English | 3001 | Backend API exam system |
| Nginx | 80 | HTTP |
| Nginx | 443 | HTTPS |

### Tài khoản mặc định (sau khi init database)

**Supervisor:**
- Username: `admin`
- Password: `admin123`

> ⚠️ **Quan trọng**: Đổi password ngay sau khi đăng nhập lần đầu!

---

## Liên hệ & Hỗ trợ

- **Project**: Hệ thống Thi Nói PTNK
- **Version**: 1.0.0
- **Tác giả**: PTNK Team

---

## Changelog

### Version 1.0.0 (2025-01-18)
- Initial deployment guide
- PM2 configuration
- Nginx reverse proxy setup
- SSL certificate installation
- Troubleshooting guide

---

**Chúc bạn deploy thành công!** 🚀
