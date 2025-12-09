// Script to initialize database without clearing existing data
import { setupDatabase } from '../config/database';
import { SupervisorModel } from '../models/Supervisor';
import { StudentModel } from '../models/Student';

async function initializeDatabase() {
  try {
    console.log('🚀 Đang khởi tạo database...\n');

    // Setup database - tạo tables nếu chưa có
    const db = await setupDatabase();
    console.log('✅ Database đã được khởi tạo thành công');
    console.log('✅ Tất cả tables và indexes đã được tạo\n');

    // Kiểm tra và tạo supervisor mặc định nếu chưa có
    await ensureDefaultSupervisor();

    console.log('\n🎉 Hoàn tất!');
    console.log('\n📖 Bước tiếp theo:');
    console.log('1. Chạy server: npm run dev:backend');
    console.log('2. Đăng nhập Supervisor tại: /supervisor/login.html');
    console.log('   - Username: giamthi1');
    console.log('   - Password: PTNK@123');

  } catch (error) {
    console.error('❌ Lỗi khởi tạo database:', error);
    process.exit(1);
  }
}

async function ensureDefaultSupervisor() {
  try {
    console.log('👤 Kiểm tra tài khoản supervisor mặc định...');

    const supervisorModel = new SupervisorModel();
    const existing = await supervisorModel.getByUsername('giamthi1');

    if (existing) {
      console.log('✅ Tài khoản supervisor "giamthi1" đã tồn tại');
    } else {
      await supervisorModel.create({
        username: 'giamthi1',
        full_name: 'Giám thị PTNK',
        password: 'PTNK@123',
        is_active: true
      });

      console.log('✅ Đã tạo tài khoản supervisor mặc định');
      console.log('   - Username: giamthi1');
      console.log('   - Password: PTNK@123');
    }
  } catch (error) {
    console.error('❌ Lỗi tạo supervisor:', error);
    throw error;
  }
}

// Run script
if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('💥 Script thất bại:', error);
      process.exit(1);
    });
}

export { initializeDatabase };
