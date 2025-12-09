# Hướng Dẫn Triển Khai Hệ Thống Thi Nói Trực Tuyến

## 📦 Package Đã Tạo

File package đã được tạo tại: `package/exam-system-v1.0.zip` (26MB)

## 🚀 Cách Triển Khai

### Bước 1: Chuẩn Bị Máy Server (Giám Thị)

1. **Giải nén file package:**
   ```
   exam-system-v1.0.zip → giải nén ra thư mục bất kỳ
   ```

2. **Cấu trúc sau khi giải nén:**
   ```
   exam-system/
   ├── app.exe                          ← File thực thi chính
   ├── start-server.bat                 ← Script khởi chạy nhanh
   ├── HƯỚNG_DẪN_TRIỂN_KHAI.txt       ← Hướng dẫn chi tiết
   ├── public/                          ← Giao diện web
   ├── database/                        ← Cơ sở dữ liệu có sẵn
   └── uploads/                         ← Thư mục lưu audio
   ```

### Bước 2: Khởi Chạy Server

**Cách 1: Chạy script tự động (Khuyến nghị)**
```
Đúp chuột vào file: start-server.bat
```

**Cách 2: Chạy thủ công**
```
Đúp chuột vào file: app.exe
```

### Bước 3: Kiểm Tra Kết Nối

1. **Trên máy server:**
   - Mở trình duyệt: `http://localhost:3000`
   - Đăng nhập giám thị: `giamthi1` / `PTNK@123`

2. **Từ máy khác trong mạng LAN:**
   - Tìm IP của máy server (ví dụ: 192.168.1.100)
   - Truy cập: `http://192.168.1.100:3000`

## 🌐 Truy Cập Từ Mạng LAN

### Cho Giám Thị:
```
http://[ĐỊA_CHỈ_IP]:3000/supervisor/login.html
Username: giamthi1
Password: PTNK@123
```

### Cho Học Sinh:
```
http://[ĐỊA_CHỈ_IP]:3000/student/login.html
Username: HS001 (mẫu)
Password: 123456 (mẫu)
```

## 🔧 Cấu Hình Mạng

### 1. Tìm Địa Chỉ IP Máy Server:

**Windows:**
```cmd
ipconfig
```
Tìm dòng "IPv4 Address" (ví dụ: 192.168.1.100)

**Linux/Mac:**
```bash
ifconfig
# hoặc
ip addr show
```

### 2. Mở Port 3000 Trên Firewall:

**Windows Firewall:**
1. Control Panel → System and Security → Windows Defender Firewall
2. Advanced Settings → Inbound Rules → New Rule
3. Port → TCP → Specific Local Ports: 3000 → Allow

**Linux:**
```bash
sudo ufw allow 3000
```

### 3. Kiểm Tra Kết Nối:
Từ máy học sinh, ping đến máy server:
```cmd
ping [ĐỊA_CHỈ_IP_SERVER]
```

## 💾 Dữ Liệu Có Sẵn

Package đã bao gồm dữ liệu mẫu:

### Tài Khoản Giám Thị:
- **Username:** `giamthi1`
- **Password:** `PTNK@123`
- **Quyền:** Toàn quyền quản lý

### Học Sinh Mẫu:
- **Mã HS:** `HS001`
- **Tên:** Nguyễn Văn Test
- **Password:** `123456`

### Kỳ Thi Mẫu:
- **Tên:** Kỳ thi tuyển chọn đội tuyển học sinh giỏi 2025
- **Số Đề:** 10 đề
- **Thời Gian Chuẩn Bị:** 5 phút
- **Thời Gian Làm Bài:** 5 phút
- **Trạng Thái:** Sẵn sàng

## 🔄 Quy Trình Sử Dụng Hoàn Chỉnh

### A. Chuẩn Bị Thi (Giám Thị):

1. **Khởi động hệ thống:**
   - Chạy `start-server.bat` hoặc `app.exe`
   - Kiểm tra kết nối mạng LAN

2. **Đăng nhập và chuẩn bị dữ liệu:**
   - Truy cập dashboard giám thị
   - Import danh sách học sinh từ Excel (nếu cần)
   - Tạo kỳ thi mới hoặc sử dụng kỳ thi mẫu
   - Thêm học sinh vào kỳ thi

3. **Thông báo cho học sinh:**
   - Cung cấp địa chỉ IP và port cho học sinh
   - Hướng dẫn học sinh test microphone trước thi

### B. Làm Bài (Học Sinh):

1. **Truy cập hệ thống:**
   ```
   http://[ĐỊA_CHỈ_IP]:3000/student/login.html
   ```

2. **Quy trình thi:**
   - Đăng nhập bằng mã học sinh
   - Test microphone và nghe thử
   - Chọn kỳ thi được phân công
   - Random số đề thi (chỉ 1 lần)
   - Bắt đầu làm bài
   - Ghi âm và nộp bài

### C. Giám Sát (Giám Thị):

1. **Monitor thời gian thực:**
   - Theo dõi Dashboard
   - Xem số lượng thí sinh đang thi
   - Theo dõi tiến độ nộp bài

2. **Xử lý sau thi:**
   - Nghe preview file audio
   - Tải về từng file hoặc tất cả file ZIP
   - Reset lần làm bài nếu cần
   - Backup dữ liệu

## ⚠️ Lưu Ý Quan Trọng

### 1. Backup Dữ Liệu:
```
Backup thư mục database/ trước mỗi kỳ thi
```

### 2. Dung Lượng Ổ Cứng:
```
Mỗi file audio ~1-5MB
Đảm bảo đủ dung lượng cho số lượng thí sinh
```

### 3. Kết Nối Mạng:
```
Kiểm tra tốc độ mạng LAN ổn định
Đảm bảo không có gián đoạn mạng trong quá trình thi
```

### 4. Bảo Mật:
```
Đổi mật khẩu mặc định của giám thị
Chỉ cho phép truy cập từ mạng LAN tin cậy
```

## 🆘 Khắc Phục Sự Cố

### Lỗi "Cannot access the site":
- ✅ Kiểm tra app.exe có đang chạy
- ✅ Verify địa chỉ IP và port 3000
- ✅ Kiểm tra Windows Firewall
- ✅ Ping test kết nối mạng

### Lỗi "Audio upload failed":
- ✅ Kiểm tra thư mục uploads/ có quyền ghi
- ✅ Kiểm tra dung lượng ổ cứng
- ✅ Test microphone trên trình duyệt

### Lỗi "Database error":
- ✅ Đảm bảo thư mục database/ tồn tại
- ✅ Kiểm tra quyền đọc/ghi file .db
- ✅ Restart app.exe

### Performance Issues:
- ✅ Đóng các ứng dụng không cần thiết
- ✅ Kiểm tra RAM và CPU usage
- ✅ Limit số lượng thí sinh cùng lúc

## 📊 Thống Kê và Monitoring

### Theo Dõi Hệ Thống:
```
http://[IP]:3000/api/system/health    ← Health check
http://[IP]:3000/api/system/stats     ← System statistics
```

### Log Files:
- Terminal/Command Prompt sẽ hiển thị log real-time
- Lưu log quan trọng để troubleshooting

## 🔄 Cập Nhật Hệ Thống

Để cập nhật lên phiên bản mới:
1. Backup thư mục `database/` và `uploads/`
2. Thay thế file `app.exe` mới
3. Giữ nguyên thư mục `public/`, `database/`, `uploads/`
4. Test kỹ trước khi triển khai chính thức

---

## 📞 Hỗ Trợ Kỹ Thuật

- **Documentation:** README.md trong source code
- **API Reference:** Chi tiết trong README.md
- **Issues:** Tạo issue trên repository

---

**🎯 Hệ thống đã sẵn sàng triển khai và sử dụng ngay!**
