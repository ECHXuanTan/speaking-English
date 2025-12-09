// Exam model - quản lý dữ liệu kỳ thi

import Database from 'better-sqlite3';
import { getDatabase, runQuery, getRow, getAllRows } from '../config/database';
import { 
  Exam, 
  CreateExamDto, 
  UpdateExamDto,
  PaginationParams,
  PaginatedResponse,
  ExamStatistics 
} from '../types/models';

export class ExamModel {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Tạo kỳ thi mới
   */
  async create(data: CreateExamDto): Promise<Exam> {
    try {
      const sql = `
        INSERT INTO exams (exam_name, preparation_time, exam_duration)
        VALUES (?, ?, ?)
      `;

      const result = await runQuery(this.db, sql, [
        data.exam_name,
        data.preparation_time,
        data.exam_duration
      ]);

      const exam = await this.findById(result.id);
      if (!exam) {
        throw new Error('Lỗi tạo kỳ thi');
      }

      return exam;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Tìm kỳ thi theo ID
   */
  async findById(id: number): Promise<Exam | null> {
    const sql = 'SELECT * FROM exams WHERE id = ?';
    const row = await getRow(this.db, sql, [id]);
    return row || null;
  }

  /**
   * Lấy danh sách tất cả kỳ thi có phân trang
   */
  async findAll(params: PaginationParams = {}): Promise<PaginatedResponse<Exam>> {
    const { page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    try {
      // Đếm tổng số kỳ thi
      const countSql = 'SELECT COUNT(*) as total FROM exams';
      const countResult = await getRow(this.db, countSql);
      const total = countResult.total;

      // Lấy dữ liệu kỳ thi
      const sql = `
        SELECT * FROM exams 
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      const exams = await getAllRows(this.db, sql, [limit, offset]);

      return {
        items: exams,
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
   * Tìm kiếm kỳ thi theo tên
   */
  async search(keyword: string, params: PaginationParams = {}): Promise<PaginatedResponse<Exam>> {
    const { page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;
    const searchPattern = `%${keyword}%`;

    try {
      // Đếm tổng số kết quả
      const countSql = `
        SELECT COUNT(*) as total FROM exams 
        WHERE exam_name LIKE ?
      `;
      const countResult = await getRow(this.db, countSql, [searchPattern]);
      const total = countResult.total;

      // Lấy dữ liệu
      const sql = `
        SELECT * FROM exams 
        WHERE exam_name LIKE ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      const exams = await getAllRows(this.db, sql, [searchPattern, limit, offset]);

      return {
        items: exams,
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
   * Cập nhật thông tin kỳ thi
   */
  async update(id: number, data: UpdateExamDto): Promise<Exam | null> {
    try {
      const exam = await this.findById(id);
      if (!exam) {
        throw new Error('Không tìm thấy kỳ thi');
      }

      const updates: string[] = [];
      const values: any[] = [];

      if (data.exam_name) {
        updates.push('exam_name = ?');
        values.push(data.exam_name);
      }

      if (data.preparation_time !== undefined) {
        updates.push('preparation_time = ?');
        values.push(data.preparation_time);
      }

      if (data.exam_duration !== undefined) {
        updates.push('exam_duration = ?');
        values.push(data.exam_duration);
      }

      if (updates.length === 0) {
        return exam;
      }

      values.push(id);
      const sql = `UPDATE exams SET ${updates.join(', ')} WHERE id = ?`;
      
      await runQuery(this.db, sql, values);
      return await this.findById(id);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa kỳ thi
   */
  async delete(id: number): Promise<boolean> {
    try {
      // Kiểm tra xem có học sinh nào đang tham gia kỳ thi không
      const checkSql = 'SELECT COUNT(*) as count FROM exam_participants WHERE exam_id = ?';
      const checkResult = await getRow(this.db, checkSql, [id]);
      
      if (checkResult.count > 0) {
        throw new Error('Không thể xóa kỳ thi đã có học sinh tham gia');
      }

      const sql = 'DELETE FROM exams WHERE id = ?';
      const result = await runQuery(this.db, sql, [id]);
      return result.changes > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy thống kê kỳ thi
   */
  async getStatistics(examId: number): Promise<ExamStatistics | null> {
    try {
      const exam = await this.findById(examId);
      if (!exam) {
        return null;
      }

      const sql = `
        SELECT 
          COUNT(*) as total_participants,
          SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          AVG(
            CASE 
              WHEN status = 'completed' AND start_time IS NOT NULL AND submit_time IS NOT NULL 
              THEN (julianday(submit_time) - julianday(start_time)) * 24 * 60 * 60
              ELSE NULL 
            END
          ) as average_duration
        FROM exam_participants 
        WHERE exam_id = ?
      `;

      const result = await getRow(this.db, sql, [examId]);
      
      if (!result || result.total_participants === 0) {
        return {
          total_participants: 0,
          waiting: 0,
          in_progress: 0,
          completed: 0,
          completion_rate: 0
        };
      }

      return {
        total_participants: result.total_participants,
        waiting: result.waiting,
        in_progress: result.in_progress,
        completed: result.completed,
        completion_rate: result.total_participants > 0 
          ? (result.completed / result.total_participants) * 100 
          : 0,
        average_duration: result.average_duration || undefined
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy danh sách kỳ thi có thể tham gia (chưa bắt đầu hoặc đang diễn ra)
   */
  async getAvailableExams(): Promise<Exam[]> {
    try {
      const sql = 'SELECT * FROM exams ORDER BY created_at DESC';
      return await getAllRows(this.db, sql);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Kiểm tra kỳ thi có tồn tại không
   */
  async exists(id: number): Promise<boolean> {
    try {
      const exam = await this.findById(id);
      return exam !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Đếm tổng số kỳ thi
   */
  async count(): Promise<number> {
    const sql = 'SELECT COUNT(*) as total FROM exams';
    const result = await getRow(this.db, sql);
    return result.total;
  }

  /**
   * Lấy kỳ thi gần đây nhất
   */
  async getLatest(limit: number = 5): Promise<Exam[]> {
    try {
      const sql = `
        SELECT * FROM exams
        ORDER BY created_at DESC
        LIMIT ?
      `;
      return await getAllRows(this.db, sql, [limit]);
    } catch (error) {
      throw error;
    }
  }
}
