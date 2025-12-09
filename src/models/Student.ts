// Student model - quản lý dữ liệu học sinh

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { getDatabase, runQuery, getRow, getAllRows } from '../config/database';
import { 
  Student, 
  CreateStudentDto, 
  UpdateStudentDto, 
  StudentLoginDto,
  PaginationParams,
  PaginatedResponse 
} from '../types/models';

export class StudentModel {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Tạo mật khẩu tự động cho học sinh
   */
  private generatePassword(): string {
    return Math.random().toString(36).slice(-8);
  }

  /**
   * Hash mật khẩu
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * So sánh mật khẩu
   */
  private async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * Tạo học sinh mới
   */
  async create(data: CreateStudentDto): Promise<{ student: Student; password: string }> {
    try {
      // Kiểm tra mã học sinh đã tồn tại
      const existing = await this.findByStudentCode(data.student_code);
      if (existing) {
        throw new Error('Mã học sinh đã tồn tại');
      }

      // Tạo mật khẩu nếu không có
      const plainPassword = data.password || this.generatePassword();
      const hashedPassword = await this.hashPassword(plainPassword);

      const sql = `
        INSERT INTO students (student_code, full_name, password)
        VALUES (?, ?, ?)
      `;

      const result = await runQuery(this.db, sql, [
        data.student_code,
        data.full_name,
        hashedPassword
      ]);

      const student = await this.findById(result.id);
      if (!student) {
        throw new Error('Lỗi tạo học sinh');
      }

      return { student, password: plainPassword };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Tìm học sinh theo ID
   */
  async findById(id: number): Promise<Student | null> {
    const sql = 'SELECT * FROM students WHERE id = ?';
    const row = await getRow(this.db, sql, [id]);
    return row || null;
  }

  /**
   * Tìm học sinh theo mã học sinh
   */
  async findByStudentCode(studentCode: string): Promise<Student | null> {
    const sql = 'SELECT * FROM students WHERE student_code = ?';
    const row = await getRow(this.db, sql, [studentCode]);
    return row || null;
  }

  /**
   * Lấy danh sách tất cả học sinh có phân trang
   */
  async findAll(params: PaginationParams = {}): Promise<PaginatedResponse<Student>> {
    const { page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    try {
      // Đếm tổng số học sinh
      const countSql = 'SELECT COUNT(*) as total FROM students';
      const countResult = await getRow(this.db, countSql);
      const total = countResult.total;

      // Lấy dữ liệu học sinh
      const sql = `
        SELECT * FROM students 
        ORDER BY created_at DESC, full_name ASC
        LIMIT ? OFFSET ?
      `;
      const students = await getAllRows(this.db, sql, [limit, offset]);

      return {
        items: students,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Tìm kiếm học sinh theo tên hoặc mã
   */
  async search(keyword: string, params: PaginationParams = {}): Promise<PaginatedResponse<Student>> {
    const { page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;
    const searchPattern = `%${keyword}%`;

    try {
      // Đếm tổng số kết quả
      const countSql = `
        SELECT COUNT(*) as total FROM students 
        WHERE student_code LIKE ? OR full_name LIKE ?
      `;
      const countResult = await getRow(this.db, countSql, [searchPattern, searchPattern]);
      const total = countResult.total;

      // Lấy dữ liệu
      const sql = `
        SELECT * FROM students 
        WHERE student_code LIKE ? OR full_name LIKE ?
        ORDER BY full_name ASC
        LIMIT ? OFFSET ?
      `;
      const students = await getAllRows(this.db, sql, [searchPattern, searchPattern, limit, offset]);

      return {
        items: students,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cập nhật thông tin học sinh
   */
  async update(id: number, data: UpdateStudentDto): Promise<Student | null> {
    try {
      const student = await this.findById(id);
      if (!student) {
        throw new Error('Không tìm thấy học sinh');
      }

      // Kiểm tra mã học sinh trùng (nếu thay đổi)
      if (data.student_code && data.student_code !== student.student_code) {
        const existing = await this.findByStudentCode(data.student_code);
        if (existing) {
          throw new Error('Mã học sinh đã tồn tại');
        }
      }

      const updates: string[] = [];
      const values: any[] = [];

      if (data.student_code) {
        updates.push('student_code = ?');
        values.push(data.student_code);
      }

      if (data.full_name) {
        updates.push('full_name = ?');
        values.push(data.full_name);
      }

      if (data.password) {
        updates.push('password = ?');
        values.push(await this.hashPassword(data.password));
      }

      if (updates.length === 0) {
        return student;
      }

      values.push(id);
      const sql = `UPDATE students SET ${updates.join(', ')} WHERE id = ?`;
      
      await runQuery(this.db, sql, values);
      return await this.findById(id);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa học sinh
   */
  async delete(id: number): Promise<boolean> {
    try {
      const sql = 'DELETE FROM students WHERE id = ?';
      const result = await runQuery(this.db, sql, [id]);
      return result.changes > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa nhiều học sinh
   */
  async deleteMany(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;

    try {
      const placeholders = ids.map(() => '?').join(',');
      const sql = `DELETE FROM students WHERE id IN (${placeholders})`;
      const result = await runQuery(this.db, sql, ids);
      return result.changes;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Đăng nhập học sinh
   */
  async login(data: StudentLoginDto): Promise<Student | null> {
    try {
      const student = await this.findByStudentCode(data.student_code);
      if (!student) {
        return null;
      }

      const isValidPassword = await this.comparePassword(data.password, student.password);
      if (!isValidPassword) {
        return null;
      }

      return student;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Đổi mật khẩu học sinh
   */
  async changePassword(id: number, newPassword: string): Promise<boolean> {
    try {
      const hashedPassword = await this.hashPassword(newPassword);
      const sql = 'UPDATE students SET password = ? WHERE id = ?';
      const result = await runQuery(this.db, sql, [hashedPassword, id]);
      return result.changes > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Reset mật khẩu và trả về mật khẩu mới
   */
  async resetPassword(id: number): Promise<string | null> {
    try {
      const newPassword = this.generatePassword();
      const success = await this.changePassword(id, newPassword);
      return success ? newPassword : null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Đếm tổng số học sinh
   */
  async count(): Promise<number> {
    const sql = 'SELECT COUNT(*) as total FROM students';
    const result = await getRow(this.db, sql);
    return result.total;
  }
}
