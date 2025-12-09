# Hệ Thống Thi Nói Trực Tuyến

Hệ thống thi nói trực tuyến được xây dựng với Node.js, TypeScript, SQLite và Socket.IO.

## 🚀 Tính Năng Chính

### Dành cho Học Sinh
- **UC01**: Đăng nhập hệ thống (username/password)
- **UC02**: Test microphone + nghe lại (lặp lại nhiều lần)
- **UC03**: Random số đề thi (học sinh tự bấm nút, chỉ 1 lần duy nhất)
- **UC04**: Bắt đầu làm bài (chỉ sau khi đã random đề)
- **UC05**: Countdown thời gian chuẩn bị
- **UC06**: Recording trong thời gian làm bài
- **UC07**: Nộp bài sớm (optional)
- **UC08**: Tự động nộp khi hết thời gian

### Dành cho Giám Thị
- **UC09**: Import danh sách học sinh từ Excel
- **UC10**: CRUD học sinh (Create/Read/Update/Delete)
- **UC11**: Auto-generate password cho học sinh
- **UC12**: Tạo kỳ thi (thiết lập số lượng đề)
- **UC13**: Thêm học sinh vào kỳ thi cụ thể
- **UC14**: Monitor danh sách học sinh đã nộp bài
- **UC15**: Preview/nghe file audio đã nộp
- **UC16**: Download file audio về máy (.mp3)
- **UC17**: Reset lần làm bài của thí sinh (để làm bài lại)

## 🛠️ Tech Stack

| Technology | Choice | Reason |
|------------|--------|--------|
| **Database** | SQLite | File-based, no server needed |
| **Audio Format** | WebM → MP3 | Browser native → Universal |
| **Real-time** | Socket.io | Reliable, fallback support |
| **Session** | Express-session | Simple for LAN deployment |
| **Packaging** | pkg | Single executable |
| **Frontend** | Vanilla JS | No build process, direct deployment |
| **Development** | nodemon + live-server | Auto-reload for backend + frontend |

## 📁 Cấu Trúc Dự Án

```
exam-system/
├── src/
│   ├── app.ts                    # Main server
│   ├── types/
│   │   ├── index.ts              # Shared types
│   │   ├── socket.ts             # Socket event types
│   │   └── models.ts             # Database model types
│   ├── config/
│   │   ├── database.ts
│   │   └── config.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── student.ts
│   │   ├── supervisor.ts
│   │   └── system.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── validation.ts
│   ├── models/
│   │   ├── Student.ts
│   │   ├── Exam.ts
│   │   └── ExamParticipant.ts
│   └── utils/
│       ├── audioProcessor.ts
│       └── excelHelper.ts
├── dist/                         # Compiled JavaScript
├── public/                       # Frontend files
├── uploads/                      # Audio files
├── database/                     # SQLite database
├── nodemon.json                     # Auto-reload config for backend
├── tsconfig.json
├── package.json
└── README.md
```

## 🗄️ Database Schema

```sql
-- Bảng học sinh
CREATE TABLE students (
    id INTEGER PRIMARY KEY,
    student_code VARCHAR(20) UNIQUE,
    full_name VARCHAR(100),
    password VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bảng kỳ thi
CREATE TABLE exams (
    id INTEGER PRIMARY KEY,
    exam_name VARCHAR(100),
    total_questions INTEGER,
    preparation_time INTEGER, -- giây
    exam_duration INTEGER,    -- giây
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bảng tham gia thi
CREATE TABLE exam_participants (
    id INTEGER PRIMARY KEY,
    exam_id INTEGER,
    student_id INTEGER,
    question_number INTEGER,
    status ENUM('waiting', 'in_progress', 'completed'),
    audio_file_path VARCHAR(255),
    start_time DATETIME,
    submit_time DATETIME,
    FOREIGN KEY (exam_id) REFERENCES exams(id),
    FOREIGN KEY (student_id) REFERENCES students(id)
);
```

## 🚀 Cài Đặt và Chạy

### 1. Cài đặt dependencies

```bash
npm install
```

### 2. Khởi tạo dữ liệu mẫu (Lần đầu chạy)

```bash
# Chạy script khởi tạo dữ liệu mẫu
npm run init-supervisor
```

Script này sẽ tự động tạo:
- Tài khoản giám thị: `giamthi1` / `PTNK@123`
- Học sinh test: `HS001` / `123456`
- Kỳ thi mẫu với 10 đề, thời gian 5p chuẩn bị + 5p làm bài

### 3. Development với Auto-reload

Hệ thống hỗ trợ auto-reload cho cả backend và frontend trong quá trình phát triển:

#### 🔄 Chạy cả Backend và Frontend (Khuyến nghị)
```bash
# Chạy đồng thời backend và frontend với auto-reload
npm run dev:full
```

Lệnh này sẽ:
- **Backend**: Chạy trên port 3000, tự động restart khi thay đổi file TypeScript trong `src/`
- **Frontend**: Tự động mở trình duyệt tại `http://localhost:8080`, reload khi thay đổi file trong `public/`

#### ⚡ Chạy riêng lẻ

```bash
# Chỉ chạy backend với auto-reload
npm run dev:backend

# Chỉ chạy frontend với auto-reload
npm run dev:frontend

# Chạy development đơn giản (chỉ backend)
npm run dev
```

#### 📁 Auto-reload Configuration

- **nodemon.json**: Cấu hình auto-reload cho backend
  - Theo dõi thư mục `src/`
  - Hỗ trợ file `.ts`, `.js`, `.json`
  - Delay 2 giây để tránh reload quá nhiều lần

- **live-server**: Auto-reload cho frontend
  - Port 8080 
  - Wait 1 giây trước khi reload
  - Tự động mở trình duyệt

#### 🛑 Dừng Development Server

Để dừng development server, sử dụng `Ctrl + C` trong terminal.

### 4. Production Build

```bash
# Build TypeScript sang JavaScript
npm run build

# Chạy production server
npm start
```

### 5. Đóng gói thành executable

```bash
# Tạo file executable cho Windows
npm run pkg
```

## 🔧 Cấu Hình

### Environment Variables

Tạo file `.env` (optional):

```env
PORT=3000
HOST=0.0.0.0
SESSION_SECRET=your-secret-key
NODE_ENV=production
DB_NAME=exam_system.db
```

### Default Configuration

- **Port**: 3000
- **Database**: `database/exam_system.db`
- **Upload Path**: `uploads/audio/`
- **Session Timeout**: 1 tuần (7 ngày)
- **Max File Size**: 50MB

### Dữ Liệu Mẫu (Tự Động Tạo)

Hệ thống sẽ tự động tạo dữ liệu mẫu khi chạy lần đầu:

#### 👨‍🏫 Tài Khoản Giám Thị Mặc Định
- **Username**: `giamthi1`
- **Password**: `PTNK@123`
- **Họ Tên**: Giám thị PTNK
- **Trạng Thái**: Hoạt động

#### 🎓 Học Sinh Test
- **Mã Học Sinh**: `HS001`
- **Họ Tên**: Nguyễn Văn Test
- **Mật Khẩu**: `123456`

#### 📝 Kỳ Thi Mẫu
- **Tên**: Kỳ thi tuyển chọn đội tuyển học sinh giỏi 2025
- **Số Đề Thi**: 10 đề
- **Thời Gian Chuẩn Bị**: 5 phút (300 giây)
- **Thời Gian Làm Bài**: 5 phút (300 giây)
- **Trạng Thái**: Sẵn sàng

#### 🔗 Dữ Liệu Liên Kết
- Học sinh test đã được tự động thêm vào kỳ thi mẫu
- Học sinh cần tự random số đề trước khi bắt đầu thi

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - Đăng nhập học sinh
- `POST /api/auth/supervisor-login` - Đăng nhập giám thị
- `POST /api/auth/logout` - Đăng xuất
- `GET /api/auth/me` - Thông tin user hiện tại

### Student APIs
- `GET /api/student/profile` - Thông tin profile
- `GET /api/student/exams` - Danh sách kỳ thi
- `GET /api/student/exam/:participantId` - Chi tiết kỳ thi
- `POST /api/student/exam/:participantId/random-question` - Random số đề thi (chỉ 1 lần)
- `POST /api/student/exam/:participantId/start` - Bắt đầu thi (yêu cầu đã random đề)
- `POST /api/student/exam/:participantId/submit` - Nộp bài (+ audio)
- `POST /api/student/test-microphone` - Test microphone

### Supervisor APIs
- `GET /api/supervisor/students` - Danh sách học sinh
- `POST /api/supervisor/students` - Tạo học sinh
- `PUT /api/supervisor/students/:id` - Cập nhật học sinh
- `DELETE /api/supervisor/students/:id` - Xóa học sinh
- `POST /api/supervisor/students/import` - Import từ Excel
- `GET /api/supervisor/students/export` - Export ra Excel
- `GET /api/supervisor/students/template` - Download template Excel
- `GET /api/supervisor/exams` - Danh sách kỳ thi
- `POST /api/supervisor/exams` - Tạo kỳ thi
- `GET /api/supervisor/exams/:examId/monitoring` - Monitor kỳ thi
- `GET /api/supervisor/exams/:examId/export` - Tải về file ZIP chứa tất cả audio MP3
- `GET /api/supervisor/exams/:examId/audio/:participantId` - Download audio
- `DELETE /api/supervisor/participants/:participantId/reset` - Reset lần làm bài

### System APIs
- `GET /api/system/health` - Health check
- `GET /api/system/stats` - Thống kê hệ thống
- `GET /api/system/config` - Cấu hình công khai
- `GET /api/system/available-exams` - Kỳ thi có sẵn

## 🔌 Socket.IO Events

### Client to Server
- `authenticate` - Xác thực socket
- `join_exam` - Tham gia kỳ thi
- `start_exam` - Bắt đầu thi
- `submit_exam` - Nộp bài
- `start_recording` - Bắt đầu ghi âm
- `stop_recording` - Dừng ghi âm

### Server to Client
- `authenticated` - Kết quả xác thực
- `exam_status_update` - Cập nhật trạng thái thi
- `exam_start` - Bắt đầu làm bài
- `time_warning` - Cảnh báo thời gian
- `auto_submit` - Tự động nộp bài
- `recording_started/stopped` - Trạng thái ghi âm
- `student_joined` - Học sinh tham gia (cho giám thị)

## 📋 Quy Trình Sử dụng

### Cho Giám Thị

1. **Đăng nhập**: Sử dụng `giamthi1` / `PTNK@123`
2. **Import học sinh**: Upload file Excel hoặc thêm thủ công
3. **Tạo kỳ thi**: Thiết lập tên, số đề, thời gian
4. **Thêm học sinh vào kỳ thi**: Chọn danh sách học sinh
5. **Monitor**: Theo dõi quá trình thi của học sinh
6. **Reset lần làm bài**: Cho phép học sinh làm bài lại (nếu cần)
7. **Tải file audio**: Download file ZIP chứa tất cả audio MP3 của thí sinh

### Dashboard Workflow Chi Tiết

#### 📊 Giám Sát Thi (Dashboard Monitoring)

1. **Chọn Kỳ Thi**:
   - Dropdown chọn kỳ thi cần giám sát
   - Hệ thống tự động load thông tin kỳ thi và danh sách thí sinh

2. **Thông Tin Kỳ Thi**:
   - Tên kỳ thi và trạng thái
   - Số đề thi, thời gian chuẩn bị, thời gian làm bài
   - Ngày tạo kỳ thi

3. **Thống Kê Thời Gian Thực**:
   - **Chờ thi**: Số thí sinh chưa bắt đầu
   - **Đang thi**: Số thí sinh đang làm bài (có icon loading)
   - **Hoàn thành**: Số thí sinh đã nộp bài
   - **Tổng cộng**: Tổng số thí sinh tham gia
   - Cập nhật tự động mỗi 10 giây

4. **Bộ Lọc & Tìm Kiếm**:
   - Tìm kiếm theo tên/mã học sinh
   - Lọc theo trạng thái (Chờ thi/Đang thi/Hoàn thành)
   - Lọc theo số đề thi
   - Nút xóa bộ lọc

5. **Bảng Danh Sách Thí Sinh**:
   | Cột | Mô tả |
   |-----|-------|
   | Học Sinh | Tên và avatar thí sinh |
   | Mã HS | Mã học sinh |
   | Số Đề | Số đề được random |
   | Trạng Thái | Chờ thi/Đang thi/Hoàn thành |
   | Thời Gian Bắt Đầu | Thời điểm bắt đầu làm bài |
   | Thời Gian Nộp | Thời điểm nộp bài |
   | Thao Tác | Các nút chức năng |

6. **Thao Tác Trên Mỗi Thí Sinh**:
   - **🎧 Nghe bài thi**: Preview audio đã nộp (nếu có)
   - **💾 Tải về**: Download file audio về máy (nếu có)
   - **🔄 Reset**: Reset lần làm bài cho thí sinh

#### 🔄 Chức Năng Reset Lần Làm Bài

1. **Điều Kiện Reset**:
   - Chỉ reset được khi thí sinh KHÔNG đang thi (status ≠ 'in_progress')
   - Có thể reset với các trạng thái: 'waiting', 'completed'

2. **Quy Trình Reset**:
   - Click nút Reset (🔄) trên hàng thí sinh
   - Modal xác nhận hiển thị với thông tin thí sinh
   - Confirm để thực hiện reset

3. **Kết Quả Reset**:
   - Trạng thái thí sinh → "Chờ thi"
   - Xóa file audio đã nộp (nếu có)
   - Xóa thời gian bắt đầu và nộp bài
   - Xóa số đề thi hiện tại
   - Thí sinh có thể làm bài lại từ đầu (cần tự random số đề mới)

4. **Modal Reset UI**:
   ```
   ⚠️ Xác Nhận Reset Lần Làm Bài
   
   Hành động này sẽ:
   • Đưa thí sinh về trạng thái "Chờ thi"
   • Xóa file audio đã nộp (nếu có)
   • Xóa thời gian bắt đầu và nộp bài
   • Xóa số đề thi hiện tại
   • Cho phép thí sinh làm bài lại từ đầu
   
   Học sinh: [Tên HS]
   Mã HS: [Mã HS]
   Đề số hiện tại: [Số đề]
   Trạng thái: [Trạng thái]
   
   Lưu ý: Sau khi reset, thí sinh sẽ cần tự random lại số đề trước khi bắt đầu thi.
   
   [Hủy] [Xác nhận Reset]
   ```

#### 🎵 Chức Năng Audio

1. **Preview Audio**:
   - Modal hiển thị thông tin thí sinh
   - Audio player để nghe bài thi
   - Metadata: thời gian nộp, tên file
   - Nút "Phát từ đầu" và "Tải về"

2. **Download Audio**:
   - Tải file với tên chuẩn: `{MaHS}_de{SoDe}_{NgayThi}.mp3`
   - Ví dụ: `HS001_de5_2024-01-15.mp3`

#### 📈 Cập Nhật Thời Gian Thực

1. **Auto Refresh**: Mỗi 10 giây tự động cập nhật
2. **Socket.IO Events**:
   - Student joined exam
   - Recording started
   - Exam submitted
   - Status updates
3. **Manual Refresh**: Nút "Làm mới" để cập nhật ngay

#### 📥 Tải File Audio

- **File ZIP**: Chứa tất cả file audio MP3 của thí sinh đã nộp bài
- **Tên file ZIP**: `audio_{TenKyThi}_{timestamp}.zip`
- **Tên file MP3**: `{MaHS}_{TenHS}.mp3` (đã bỏ dấu và ký tự đặc biệt)
- **Định dạng**: MP3 chất lượng cao, nén ZIP tối ưu

### Cho Học Sinh

1. **Đăng nhập**: Sử dụng mã học sinh và mật khẩu (ví dụ: `HS001` / `123456`)
2. **Test microphone**: Kiểm tra thiết bị ghi âm
3. **Chọn kỳ thi**: Xem danh sách kỳ thi được phân công
4. **Random đề thi**: Bấm nút "Random Đề Thi" để được phân bổ số đề (chỉ 1 lần duy nhất)
5. **Làm bài**: 
   - Bấm "Bắt Đầu Thi" (chỉ sau khi đã random đề)
   - Countdown thời gian chuẩn bị
   - Ghi âm trong thời gian quy định
   - Nộp bài thủ công hoặc tự động

## 🔧 Troubleshooting

### Lỗi Audio Processing
```bash
# Cài đặt FFmpeg cho Windows
# Download từ: https://ffmpeg.org/download.html
# Hoặc sử dụng chocolatey:
choco install ffmpeg
```

### Lỗi Database
```bash
# Xóa database và tạo lại
rm database/exam_system.db
npm run dev  # Sẽ tự tạo database mới
```

### Lỗi Permissions
```bash
# Kiểm tra quyền thư mục uploads
mkdir uploads uploads/audio uploads/temp
chmod 755 uploads uploads/audio uploads/temp
```

## 📝 Development

### Cấu trúc Code

- **Models**: Xử lý database operations
- **Routes**: API endpoints
- **Middleware**: Authentication, validation
- **Utils**: Audio processing, Excel helpers
- **Types**: TypeScript type definitions

### Coding Standards

- Sử dụng TypeScript strict mode
- ESLint + Prettier formatting
- Async/await thay vì Promises
- Error handling với try/catch
- Logging với console (có thể thay bằng winston)

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3000/api/system/health
```

### Statistics
```bash
curl http://localhost:3000/api/system/stats
```

## 🚀 Deployment

### Local Network
1. Build project: `npm run build`
2. Package: `npm run pkg`
3. Copy executable + `public/` + `database/` folders
4. Run executable trên máy server

### Production Notes
- Đổi SESSION_SECRET
- Cấu hình HTTPS nếu cần
- Setup reverse proxy (nginx)
- Backup database định kỳ
- Monitor disk space cho audio files

## 🧪 Testing với Dữ Liệu Mẫu

### Quick Start Testing

1. **Chạy script khởi tạo**:
   ```bash
   npm run init-supervisor
   ```

2. **Khởi động server**:
   ```bash
   # Chạy cả backend và frontend với auto-reload
   npm run dev:full
   
   # Hoặc chỉ chạy backend
   npm run dev
   ```

3. **Test Giám Thị**:
   - Truy cập: `http://localhost:8080/supervisor/login.html` (với `npm run dev:full`)
   - Hoặc: `http://localhost:3000/supervisor/login.html` (với `npm run dev`)
   - Đăng nhập: `giamthi1` / `PTNK@123`
   - Vào Dashboard → Chọn kỳ thi mẫu → Monitor

4. **Test Học Sinh**:
   - Truy cập: `http://localhost:8080/student/login.html` (với `npm run dev:full`)
   - Hoặc: `http://localhost:3000/student/login.html` (với `npm run dev`)
   - Đăng nhập: `HS001` / `123456`
   - Test microphone → Chọn kỳ thi → Random đề → Bắt đầu thi

### Dữ Liệu Test Sẵn Có
- ✅ 1 giám thị với quyền đầy đủ
- ✅ 1 học sinh test đã được thêm vào kỳ thi
- ✅ 1 kỳ thi mẫu với 10 đề thi
- ✅ Học sinh cần tự random số đề trước khi thi

## 🔄 API Reset Lần Làm Bài

### Endpoint
```
DELETE /api/supervisor/participants/:participantId/reset
```

### Description
API này cho phép giám thị reset lần làm bài của một thí sinh cụ thể, đưa thí sinh về trạng thái chờ để có thể làm bài lại từ đầu.

### Parameters
- **participantId** (path): ID của participant (lấy từ monitoring data)

### Example Usage
```bash
# Reset và xóa số đề (học sinh sẽ cần random lại)
DELETE /api/supervisor/participants/123/reset
```

### Response
```json
{
  "success": true,
  "message": "Reset lần làm bài thành công cho học sinh Nguyễn Văn A",
  "data": {
    "participant": {
      "id": 123,
      "student_id": 456,
      "exam_id": 789,
      "question_number": 5,
      "status": "waiting",
      "start_time": null,
      "submit_time": null,
      "audio_file_path": null
    },
    "student": {
      "student_code": "HS001",
      "full_name": "Nguyễn Văn A"
    },
    "exam": {
      "exam_name": "Kỳ thi tuyển chọn đội tuyển"
    }
  }
}
```

### Side Effects
- Reset trạng thái participant về "waiting"
- Xóa file audio đã nộp (nếu có)
- Xóa thời gian bắt đầu và nộp bài
- Xóa số đề thi (học sinh sẽ cần tự random lại)

## 📞 Support

- **Issues**: Tạo issue trên repository
- **Documentation**: Xem code comments
- **API Testing**: Sử dụng Postman/Thunder Client

---

**Made with ❤️ for PTNK Education System**
