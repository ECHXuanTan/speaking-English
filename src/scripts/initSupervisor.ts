// Script to initialize default data: supervisor, test student, and sample exam
import { setupDatabase } from '../config/database';
import { SupervisorModel } from '../models/Supervisor';
import { StudentModel } from '../models/Student';
import { ExamModel } from '../models/Exam';
import { ExamParticipantModel } from '../models/ExamParticipant';
import { getDatabasePath } from '../config/config';
import fs from 'fs';
import path from 'path';

async function clearDatabase() {
  try {
    console.log('🗑️  Đang xóa database hiện có...');
    
    const dbPath = getDatabasePath();
    const dbDir = path.dirname(dbPath);
    
    // Kiểm tra và xóa file database nếu tồn tại
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log(`✅ Đã xóa database: ${dbPath}`);
    } else {
      console.log('ℹ️  Database không tồn tại, bỏ qua việc xóa');
    }
    
    // Xóa thư mục uploads/audio và uploads/temp nếu tồn tại
    const audioUploadPath = path.join(process.cwd(), 'uploads', 'audio');
    const tempUploadPath = path.join(process.cwd(), 'uploads', 'temp');
    
    if (fs.existsSync(audioUploadPath)) {
      fs.rmSync(audioUploadPath, { recursive: true, force: true });
      console.log('✅ Đã xóa thư mục audio uploads');
    }
    
    if (fs.existsSync(tempUploadPath)) {
      fs.rmSync(tempUploadPath, { recursive: true, force: true });
      console.log('✅ Đã xóa thư mục temp uploads');
    }
    
    console.log('🧹 Hoàn tất việc dọn dẹp database và files');
    
  } catch (error) {
    console.error('❌ Lỗi xóa database:', error);
    throw error;
  }
}

async function initializeSupervisor() {
  try {
    console.log('🚀 Đang khởi tạo tài khoản supervisor mặc định...');
    
    // Setup database
    await setupDatabase();
    
    const supervisorModel = new SupervisorModel();
    
    // Kiểm tra xem tài khoản đã tồn tại chưa
    const existingSupervisor = await supervisorModel.getByUsername('giamthi1');
    
    if (existingSupervisor) {
      console.log('✅ Tài khoản supervisor "giamthi1" đã tồn tại');
    } else {
      // Tạo tài khoản supervisor mặc định
      const supervisorId = await supervisorModel.create({
        username: 'giamthi1',
        full_name: 'Giám thị PTNK',
        password: 'PTNK@123',
        is_active: true
      });
      
      console.log(`✅ Đã tạo tài khoản supervisor với ID: ${supervisorId}`);
      console.log('📋 Thông tin đăng nhập supervisor:');
      console.log('   - Username: giamthi1');
      console.log('   - Password: PTNK@123');
    }
    
  } catch (error) {
    console.error('❌ Lỗi khởi tạo supervisor:', error);
    process.exit(1);
  }
}

async function initializeTestStudent() {
  try {
    console.log('🎓 Đang khởi tạo học sinh test...');
    
    const studentModel = new StudentModel();
    
    // Kiểm tra học sinh test đã tồn tại chưa
    const existingStudent = await studentModel.findByStudentCode('HS001');
    
    if (existingStudent) {
      console.log('✅ Học sinh test "HS001" đã tồn tại');
      return existingStudent;
    }
    
    // Tạo học sinh test
    const result = await studentModel.create({
      student_code: 'HS001',
      full_name: 'Nguyễn Văn Test',
      password: '123456'
    });
    
    console.log(`✅ Đã tạo học sinh test với ID: ${result.student.id}`);
    console.log('📋 Thông tin đăng nhập học sinh:');
    console.log('   - Mã học sinh: HS001');
    console.log('   - Họ tên: Nguyễn Văn Test');
    console.log('   - Mật khẩu: 123456');
    
    return result.student;
  } catch (error) {
    console.error('❌ Lỗi khởi tạo học sinh test:', error);
    throw error;
  }
}

async function initializeSampleExam() {
  try {
    console.log('📝 Đang khởi tạo kỳ thi mẫu...');
    
    const examModel = new ExamModel();
    
    // Tạo kỳ thi mẫu
    const exam = await examModel.create({
      exam_name: 'Kỳ thi tuyển chọn đội tuyển học sinh giỏi 2025',
      preparation_time: 300, // 5 phút = 300 giây
      exam_duration: 300     // 5 phút = 300 giây
    });

    console.log(`✅ Đã tạo kỳ thi mẫu với ID: ${exam.id}`);
    console.log('📋 Thông tin kỳ thi:');
    console.log(`   - Tên: ${exam.exam_name}`);
    console.log(`   - Thời gian chuẩn bị: ${exam.preparation_time / 60} phút`);
    console.log(`   - Thời gian làm bài: ${exam.exam_duration / 60} phút`);
    console.log('   - Lưu ý: Cần thêm đề thi qua giao diện Supervisor');
    
    return exam;
  } catch (error) {
    console.error('❌ Lỗi khởi tạo kỳ thi mẫu:', error);
    throw error;
  }
}

async function addStudentToExam(student: any, exam: any) {
  try {
    console.log('🔗 Đang thêm học sinh vào kỳ thi...');
    
    const examParticipantModel = new ExamParticipantModel();
    
    // Kiểm tra học sinh đã tham gia kỳ thi chưa
    const existingParticipant = await examParticipantModel.findByExamAndStudent(exam.id, student.id);
    
    if (existingParticipant) {
      console.log('✅ Học sinh đã tham gia kỳ thi này');
      return existingParticipant;
    }
    
    // Thêm học sinh vào kỳ thi
    const participant = await examParticipantModel.create({
      exam_id: exam.id,
      student_id: student.id
    });
    
    console.log(`✅ Đã thêm học sinh vào kỳ thi`);
    console.log(`   - Học sinh: ${student.full_name} (${student.student_code})`);
    console.log(`   - Kỳ thi: ${exam.exam_name}`);
    console.log(`   - Trạng thái: ${participant.status} (chưa có số đề)`);
    
    return participant;
  } catch (error) {
    console.error('❌ Lỗi thêm học sinh vào kỳ thi:', error);
    throw error;
  }
}

async function initializeSystem() {
  try {
    console.log('🎯 Bắt đầu khởi tạo hệ thống...\n');
    
    // 0. Xóa database hiện có
    await clearDatabase();
    console.log('');
    
    // 1. Khởi tạo supervisor
    await initializeSupervisor();
    console.log('');
    
    // 2. Khởi tạo học sinh test
    const student = await initializeTestStudent();
    console.log('');
    
    // 3. Khởi tạo kỳ thi mẫu
    const exam = await initializeSampleExam();
    console.log('');
    
    // 4. Thêm học sinh vào kỳ thi
    await addStudentToExam(student, exam);
    console.log('');
    
    console.log('🎉 Khởi tạo hệ thống hoàn tất!');
    console.log('\n📖 Hướng dẫn sử dụng:');
    console.log('1. Supervisor đăng nhập tại: /supervisor/login.html');
    console.log('   - Username: giamthi1');
    console.log('   - Password: PTNK@123');
    console.log('');
    console.log('2. Học sinh đăng nhập tại: /student/login.html');
    console.log('   - Mã học sinh: HS001');
    console.log('   - Mật khẩu: 123456');
    console.log('');
    console.log('3. QUAN TRỌNG: Đăng nhập Supervisor và thêm đề thi:');
    console.log('   - Vào trang "Quản lý Kỳ thi"');
    console.log('   - Click "Quản lý Đề Thi" cho kỳ thi mẫu');
    console.log('   - Thêm các đề thi với mã đề và link Google Drive PDF');
    console.log('');
    console.log('4. Format link Google Drive PDF phải là:');
    console.log('   https://drive.google.com/file/d/FILE_ID/preview');
    
  } catch (error) {
    console.error('💥 Lỗi khởi tạo hệ thống:', error);
    process.exit(1);
  }
}

// Chạy script nếu được gọi trực tiếp
if (require.main === module) {
  initializeSystem()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script thất bại:', error);
      process.exit(1);
    });
}

export { clearDatabase, initializeSupervisor, initializeTestStudent, initializeSampleExam, addStudentToExam, initializeSystem };
