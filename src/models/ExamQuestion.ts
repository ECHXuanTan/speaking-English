// ExamQuestion model - quản lý đề thi

import Database from 'better-sqlite3';
import { getDatabase, runQuery, getRow, getAllRows } from '../config/database';
import {
  ExamQuestion,
  CreateExamQuestionDto,
  UpdateExamQuestionDto,
  ExamQuestionWithExam,
  Exam
} from '../types/models';

export class ExamQuestionModel {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Tạo đề thi mới
   */
  async create(data: CreateExamQuestionDto): Promise<ExamQuestion> {
    try {
      // Kiểm tra mã đề đã tồn tại trong kỳ thi này chưa
      const existing = await this.findByExamAndCode(data.exam_id, data.question_code);
      if (existing) {
        throw new Error('Mã đề đã tồn tại trong kỳ thi này');
      }

      const sql = `
        INSERT INTO exam_questions (exam_id, question_code, pdf_drive_url, is_active)
        VALUES (?, ?, ?, ?)
      `;

      const result = await runQuery(this.db, sql, [
        data.exam_id,
        data.question_code,
        data.pdf_drive_url,
        data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1
      ]);

      const question = await this.findById(result.id);
      if (!question) {
        throw new Error('Lỗi tạo đề thi');
      }

      return question;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Tạo nhiều đề thi cùng lúc
   */
  async createMany(examId: number, questions: Array<{question_code: string, pdf_drive_url: string}>): Promise<{ success: number; failed: number; errors: any[] }> {
    let success = 0;
    let failed = 0;
    const errors: any[] = [];

    for (const q of questions) {
      try {
        await this.create({
          exam_id: examId,
          question_code: q.question_code,
          pdf_drive_url: q.pdf_drive_url
        });
        success++;
      } catch (error: any) {
        failed++;
        errors.push({
          question_code: q.question_code,
          error: error.message
        });
      }
    }

    return { success, failed, errors };
  }

  /**
   * Tìm đề thi theo ID
   */
  async findById(id: number): Promise<ExamQuestion | null> {
    const sql = 'SELECT * FROM exam_questions WHERE id = ?';
    const row = await getRow(this.db, sql, [id]);
    return row || null;
  }

  /**
   * Tìm đề thi theo exam_id và question_code
   */
  async findByExamAndCode(examId: number, questionCode: string): Promise<ExamQuestion | null> {
    const sql = 'SELECT * FROM exam_questions WHERE exam_id = ? AND question_code = ?';
    const row = await getRow(this.db, sql, [examId, questionCode]);
    return row || null;
  }

  /**
   * Lấy tất cả đề thi của một kỳ thi
   */
  async findByExam(examId: number, activeOnly: boolean = false): Promise<ExamQuestion[]> {
    try {
      let sql = 'SELECT * FROM exam_questions WHERE exam_id = ?';
      const params: any[] = [examId];

      if (activeOnly) {
        sql += ' AND is_active = 1';
      }

      sql += ' ORDER BY question_code ASC';

      return await getAllRows(this.db, sql, params);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy đề thi với thông tin kỳ thi
   */
  async findByIdWithExam(id: number): Promise<ExamQuestionWithExam | null> {
    const sql = `
      SELECT
        eq.*,
        e.exam_name, e.preparation_time, e.exam_duration, e.created_at as exam_created_at
      FROM exam_questions eq
      JOIN exams e ON eq.exam_id = e.id
      WHERE eq.id = ?
    `;

    const row = await getRow(this.db, sql, [id]);
    if (!row) return null;

    return {
      id: row.id,
      exam_id: row.exam_id,
      question_code: row.question_code,
      pdf_drive_url: row.pdf_drive_url,
      is_active: row.is_active,
      created_at: row.created_at,
      exam: {
        id: row.exam_id,
        exam_name: row.exam_name,
        preparation_time: row.preparation_time,
        exam_duration: row.exam_duration,
        created_at: row.exam_created_at
      }
    };
  }

  /**
   * Cập nhật thông tin đề thi
   */
  async update(id: number, data: UpdateExamQuestionDto): Promise<ExamQuestion | null> {
    try {
      const question = await this.findById(id);
      if (!question) {
        throw new Error('Không tìm thấy đề thi');
      }

      const updates: string[] = [];
      const values: any[] = [];

      if (data.question_code) {
        updates.push('question_code = ?');
        values.push(data.question_code);
      }

      if (data.pdf_drive_url) {
        updates.push('pdf_drive_url = ?');
        values.push(data.pdf_drive_url);
      }

      if (data.is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(data.is_active ? 1 : 0);
      }

      if (updates.length === 0) {
        return question;
      }

      values.push(id);
      const sql = `UPDATE exam_questions SET ${updates.join(', ')} WHERE id = ?`;

      await runQuery(this.db, sql, values);
      return await this.findById(id);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa đề thi
   */
  async delete(id: number): Promise<boolean> {
    try {
      // Kiểm tra xem có học sinh nào đang sử dụng đề này không
      const checkSql = 'SELECT COUNT(*) as count FROM exam_participants WHERE question_id = ?';
      const checkResult = await getRow(this.db, checkSql, [id]);

      if (checkResult.count > 0) {
        throw new Error('Không thể xóa đề thi đã có học sinh sử dụng');
      }

      const sql = 'DELETE FROM exam_questions WHERE id = ?';
      const result = await runQuery(this.db, sql, [id]);
      return result.changes > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa tất cả đề thi của một kỳ thi
   */
  async deleteByExam(examId: number): Promise<number> {
    try {
      const sql = 'DELETE FROM exam_questions WHERE exam_id = ?';
      const result = await runQuery(this.db, sql, [examId]);
      return result.changes;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Đếm số lượng đề thi của một kỳ thi
   */
  async countByExam(examId: number, activeOnly: boolean = false): Promise<number> {
    try {
      let sql = 'SELECT COUNT(*) as total FROM exam_questions WHERE exam_id = ?';
      const params: any[] = [examId];

      if (activeOnly) {
        sql += ' AND is_active = 1';
      }

      const result = await getRow(this.db, sql, params);
      return result.total;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Kích hoạt/vô hiệu hóa đề thi
   */
  async setActive(id: number, isActive: boolean): Promise<ExamQuestion | null> {
    return this.update(id, { is_active: isActive });
  }

  /**
   * Random một đề thi từ danh sách đề thi active của kỳ thi
   */
  async randomQuestion(examId: number): Promise<ExamQuestion | null> {
    try {
      const sql = `
        SELECT * FROM exam_questions
        WHERE exam_id = ? AND is_active = 1
        ORDER BY RANDOM()
        LIMIT 1
      `;

      const row = await getRow(this.db, sql, [examId]);
      return row || null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Kiểm tra đề thi có tồn tại không
   */
  async exists(id: number): Promise<boolean> {
    try {
      const question = await this.findById(id);
      return question !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Lấy danh sách đề thi đang được sử dụng trong kỳ thi
   */
  async getUsedQuestions(examId: number): Promise<Array<{question: ExamQuestion, usage_count: number}>> {
    try {
      const sql = `
        SELECT
          eq.*,
          COUNT(ep.id) as usage_count
        FROM exam_questions eq
        LEFT JOIN exam_participants ep ON eq.id = ep.question_id
        WHERE eq.exam_id = ?
        GROUP BY eq.id
        ORDER BY usage_count DESC, eq.question_code ASC
      `;

      const rows = await getAllRows(this.db, sql, [examId]);

      return rows.map(row => ({
        question: {
          id: row.id,
          exam_id: row.exam_id,
          question_code: row.question_code,
          pdf_drive_url: row.pdf_drive_url,
          is_active: row.is_active,
          created_at: row.created_at
        },
        usage_count: row.usage_count
      }));
    } catch (error) {
      throw error;
    }
  }
}
