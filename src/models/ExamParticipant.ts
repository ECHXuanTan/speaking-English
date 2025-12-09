// ExamParticipant model - quản lý dữ liệu tham gia thi

import Database from 'better-sqlite3';
import fs from 'fs';
import { getDatabase, runQuery, getRow, getAllRows } from '../config/database';
import {
  ExamParticipant,
  CreateExamParticipantDto,
  UpdateExamParticipantDto,
  ExamParticipantWithDetails,
  ExamMonitoringData,
  ExamStatus,
  Student,
  Exam,
  ExamQuestion
} from '../types/models';
import { ExamModel } from './Exam';
import { ExamQuestionModel } from './ExamQuestion';

export class ExamParticipantModel {
  private db: Database.Database;
  private examModel: ExamModel;
  private examQuestionModel: ExamQuestionModel;

  constructor() {
    this.db = getDatabase();
    this.examModel = new ExamModel();
    this.examQuestionModel = new ExamQuestionModel();
  }

  /**
   * Thêm học sinh vào kỳ thi
   */
  async create(data: CreateExamParticipantDto): Promise<ExamParticipant> {
    try {
      // Kiểm tra học sinh đã tham gia kỳ thi này chưa
      const existing = await this.findByExamAndStudent(data.exam_id, data.student_id);
      if (existing) {
        throw new Error('Học sinh đã tham gia kỳ thi này');
      }

      // Lấy thông tin kỳ thi để kiểm tra
      const exam = await this.examModel.findById(data.exam_id);
      if (!exam) {
        throw new Error('Không tìm thấy kỳ thi');
      }

      // Không tự động random đề - để học sinh tự random
      let questionId = data.question_id || null;

      const sql = `
        INSERT INTO exam_participants (exam_id, student_id, question_id, status)
        VALUES (?, ?, ?, 'waiting')
      `;

      const result = await runQuery(this.db, sql, [
        data.exam_id,
        data.student_id,
        questionId
      ]);

      const participant = await this.findById(result.id);
      if (!participant) {
        throw new Error('Lỗi tạo thông tin tham gia thi');
      }

      return participant;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Thêm nhiều học sinh vào kỳ thi
   */
  async createMany(examId: number, studentIds: number[]): Promise<{ success: number; failed: number; errors: any[] }> {
    let success = 0;
    let failed = 0;
    const errors: any[] = [];

    for (const studentId of studentIds) {
      try {
        await this.create({ exam_id: examId, student_id: studentId });
        success++;
      } catch (error: any) {
        failed++;
        errors.push({
          studentId,
          error: error.message
        });
      }
    }

    return { success, failed, errors };
  }

  /**
   * Tìm thông tin tham gia thi theo ID
   */
  async findById(id: number): Promise<ExamParticipant | null> {
    const sql = 'SELECT * FROM exam_participants WHERE id = ?';
    const row = await getRow(this.db, sql, [id]);
    return row || null;
  }

  /**
   * Tìm thông tin tham gia thi theo exam và student
   */
  async findByExamAndStudent(examId: number, studentId: number): Promise<ExamParticipant | null> {
    const sql = 'SELECT * FROM exam_participants WHERE exam_id = ? AND student_id = ?';
    const row = await getRow(this.db, sql, [examId, studentId]);
    return row || null;
  }

  /**
   * Lấy thông tin chi tiết tham gia thi (bao gồm thông tin học sinh, kỳ thi và đề thi)
   */
  async findByIdWithDetails(id: number): Promise<ExamParticipantWithDetails | null> {
    const sql = `
      SELECT
        ep.*,
        s.student_code, s.full_name as student_name,
        e.exam_name, e.preparation_time, e.exam_duration,
        eq.id as question_id, eq.question_code, eq.pdf_drive_url, eq.is_active
      FROM exam_participants ep
      JOIN students s ON ep.student_id = s.id
      JOIN exams e ON ep.exam_id = e.id
      LEFT JOIN exam_questions eq ON ep.question_id = eq.id
      WHERE ep.id = ?
    `;

    const row = await getRow(this.db, sql, [id]);
    if (!row) return null;

    const result: ExamParticipantWithDetails = {
      id: row.id,
      exam_id: row.exam_id,
      student_id: row.student_id,
      question_id: row.question_id,
      status: row.status,
      audio_file_path: row.audio_file_path,
      start_time: row.start_time,
      submit_time: row.submit_time,
      student: {
        id: row.student_id,
        student_code: row.student_code,
        full_name: row.student_name,
        password: '',
        created_at: new Date()
      },
      exam: {
        id: row.exam_id,
        exam_name: row.exam_name,
        preparation_time: row.preparation_time,
        exam_duration: row.exam_duration,
        created_at: new Date()
      }
    };

    // Thêm thông tin đề thi nếu có
    if (row.question_id) {
      result.question = {
        id: row.question_id,
        exam_id: row.exam_id,
        question_code: row.question_code,
        pdf_drive_url: row.pdf_drive_url,
        is_active: row.is_active,
        created_at: new Date()
      };
    }

    return result;
  }

  /**
   * Lấy danh sách học sinh tham gia kỳ thi
   */
  async findByExam(examId: number): Promise<ExamParticipantWithDetails[]> {
    const sql = `
      SELECT
        ep.*,
        s.student_code, s.full_name as student_name, s.created_at as student_created_at,
        e.exam_name, e.preparation_time, e.exam_duration, e.created_at as exam_created_at,
        eq.id as question_id, eq.question_code, eq.pdf_drive_url, eq.is_active as question_is_active, eq.created_at as question_created_at
      FROM exam_participants ep
      JOIN students s ON ep.student_id = s.id
      JOIN exams e ON ep.exam_id = e.id
      LEFT JOIN exam_questions eq ON ep.question_id = eq.id
      WHERE ep.exam_id = ?
      ORDER BY s.full_name ASC
    `;

    const rows = await getAllRows(this.db, sql, [examId]);

    return rows.map(row => {
      const result: ExamParticipantWithDetails = {
        id: row.id,
        exam_id: row.exam_id,
        student_id: row.student_id,
        question_id: row.question_id,
        status: row.status,
        audio_file_path: row.audio_file_path,
        start_time: row.start_time,
        submit_time: row.submit_time,
        student: {
          id: row.student_id,
          student_code: row.student_code,
          full_name: row.student_name,
          password: '',
          created_at: row.student_created_at
        },
        exam: {
          id: row.exam_id,
          exam_name: row.exam_name,
          preparation_time: row.preparation_time,
          exam_duration: row.exam_duration,
          created_at: row.exam_created_at
        }
      };

      if (row.question_id) {
        result.question = {
          id: row.question_id,
          exam_id: row.exam_id,
          question_code: row.question_code,
          pdf_drive_url: row.pdf_drive_url,
          is_active: row.question_is_active,
          created_at: row.question_created_at
        };
      }

      return result;
    });
  }

  /**
   * Lấy thông tin kỳ thi của học sinh
   */
  async findByStudent(studentId: number): Promise<ExamParticipantWithDetails[]> {
    const sql = `
      SELECT
        ep.*,
        s.student_code, s.full_name as student_name, s.created_at as student_created_at,
        e.exam_name, e.preparation_time, e.exam_duration, e.created_at as exam_created_at,
        eq.id as question_id, eq.question_code, eq.pdf_drive_url, eq.is_active as question_is_active, eq.created_at as question_created_at
      FROM exam_participants ep
      JOIN students s ON ep.student_id = s.id
      JOIN exams e ON ep.exam_id = e.id
      LEFT JOIN exam_questions eq ON ep.question_id = eq.id
      WHERE ep.student_id = ?
      ORDER BY e.created_at DESC
    `;

    const rows = await getAllRows(this.db, sql, [studentId]);

    return rows.map(row => {
      const result: ExamParticipantWithDetails = {
        id: row.id,
        exam_id: row.exam_id,
        student_id: row.student_id,
        question_id: row.question_id,
        status: row.status,
        audio_file_path: row.audio_file_path,
        start_time: row.start_time,
        submit_time: row.submit_time,
        student: {
          id: row.student_id,
          student_code: row.student_code,
          full_name: row.student_name,
          password: '',
          created_at: row.student_created_at
        },
        exam: {
          id: row.exam_id,
          exam_name: row.exam_name,
          preparation_time: row.preparation_time,
          exam_duration: row.exam_duration,
          created_at: row.exam_created_at
        }
      };

      if (row.question_id) {
        result.question = {
          id: row.question_id,
          exam_id: row.exam_id,
          question_code: row.question_code,
          pdf_drive_url: row.pdf_drive_url,
          is_active: row.question_is_active,
          created_at: row.question_created_at
        };
      }

      return result;
    });
  }

  /**
   * Cập nhật thông tin tham gia thi
   */
  async update(id: number, data: UpdateExamParticipantDto): Promise<ExamParticipant | null> {
    try {
      const participant = await this.findById(id);
      if (!participant) {
        throw new Error('Không tìm thấy thông tin tham gia thi');
      }

      const updates: string[] = [];
      const values: any[] = [];

      if (data.question_id !== undefined) {
        updates.push('question_id = ?');
        values.push(data.question_id);
      }

      if (data.status) {
        updates.push('status = ?');
        values.push(data.status);
      }

      if (data.audio_file_path) {
        updates.push('audio_file_path = ?');
        values.push(data.audio_file_path);
      }

      if (data.start_time) {
        updates.push('start_time = ?');
        values.push(data.start_time instanceof Date ? data.start_time.toISOString() : data.start_time);
      }

      if (data.submit_time) {
        updates.push('submit_time = ?');
        values.push(data.submit_time instanceof Date ? data.submit_time.toISOString() : data.submit_time);
      }

      if (updates.length === 0) {
        return participant;
      }

      values.push(id);
      const sql = `UPDATE exam_participants SET ${updates.join(', ')} WHERE id = ?`;
      
      await runQuery(this.db, sql, values);
      return await this.findById(id);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bắt đầu làm bài thi
   */
  async startExam(id: number): Promise<ExamParticipant | null> {
    return this.update(id, {
      status: 'in_progress',
      start_time: new Date()
    });
  }

  /**
   * Nộp bài thi
   */
  async submitExam(id: number, audioFilePath?: string): Promise<ExamParticipant | null> {
    const updateData: UpdateExamParticipantDto = {
      status: 'completed',
      submit_time: new Date()
    };

    if (audioFilePath) {
      updateData.audio_file_path = audioFilePath;
    }

    return this.update(id, updateData);
  }

  /**
   * Xóa học sinh khỏi kỳ thi
   */
  async delete(id: number): Promise<boolean> {
    try {
      const sql = 'DELETE FROM exam_participants WHERE id = ?';
      const result = await runQuery(this.db, sql, [id]);
      return result.changes > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa tất cả học sinh khỏi kỳ thi
   */
  async deleteByExam(examId: number): Promise<number> {
    try {
      const sql = 'DELETE FROM exam_participants WHERE exam_id = ?';
      const result = await runQuery(this.db, sql, [examId]);
      return result.changes;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy dữ liệu monitoring cho giám thị
   */
  async getMonitoringData(examId: number): Promise<ExamMonitoringData | null> {
    try {
      const exam = await this.examModel.findById(examId);
      if (!exam) {
        return null;
      }

      const participants = await this.findByExam(examId);
      const statistics = await this.examModel.getStatistics(examId);

      const participantsWithDuration = participants.map(p => {
        let duration: number | undefined;

        if (p.start_time && p.submit_time) {
          const startTime = new Date(p.start_time).getTime();
          const submitTime = new Date(p.submit_time).getTime();
          duration = (submitTime - startTime) / 1000; // seconds
        }

        return {
          id: p.id,
          student: p.student,
          status: p.status,
          question: p.question,
          audio_file_path: p.audio_file_path,
          start_time: p.start_time,
          submit_time: p.submit_time,
          duration
        };
      });

      return {
        exam,
        participants: participantsWithDuration,
        statistics: statistics!
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Kiểm tra học sinh có thể bắt đầu thi không
   */
  async canStartExam(id: number): Promise<boolean> {
    try {
      const participant = await this.findById(id);
      return participant?.status === 'waiting';
    } catch (error) {
      return false;
    }
  }

  /**
   * Kiểm tra học sinh có đang thi không
   */
  async isExamInProgress(id: number): Promise<boolean> {
    try {
      const participant = await this.findById(id);
      return participant?.status === 'in_progress';
    } catch (error) {
      return false;
    }
  }

  /**
   * Kiểm tra học sinh đã hoàn thành thi chưa
   */
  async isExamCompleted(id: number): Promise<boolean> {
    try {
      const participant = await this.findById(id);
      return participant?.status === 'completed';
    } catch (error) {
      return false;
    }
  }

  /**
   * Lấy thời gian còn lại của bài thi
   */
  async getRemainingTime(id: number): Promise<number | null> {
    try {
      const participant = await this.findByIdWithDetails(id);
      if (!participant || participant.status !== 'in_progress' || !participant.start_time) {
        return null;
      }

      const startTime = new Date(participant.start_time).getTime();
      const currentTime = Date.now();
      const elapsedTime = (currentTime - startTime) / 1000; // seconds
      // Tính tổng thời gian thi = thời gian chuẩn bị + thời gian làm bài
      const totalExamTime = participant.exam.preparation_time + participant.exam.exam_duration;
      const remainingTime = totalExamTime - elapsedTime;

      return Math.max(0, remainingTime);
    } catch (error) {
      return null;
    }
  }

  /**
   * Random đề thi cho thí sinh
   */
  async randomizeQuestion(id: number): Promise<ExamParticipant | null> {
    try {
      const participant = await this.findByIdWithDetails(id);
      if (!participant) {
        throw new Error('Không tìm thấy thông tin tham gia thi');
      }

      // Chỉ cho phép random khi chưa bắt đầu thi
      if (participant.status !== 'waiting') {
        throw new Error('Chỉ có thể random đề khi chưa bắt đầu thi');
      }

      // Chỉ cho phép random nếu chưa có đề
      if (participant.question_id) {
        throw new Error('Đã có đề thi, không thể random lại');
      }

      // Random một đề thi từ danh sách đề active
      const randomQuestion = await this.examQuestionModel.randomQuestion(participant.exam_id);
      if (!randomQuestion) {
        throw new Error('Không tìm thấy đề thi nào cho kỳ thi này');
      }

      // Cập nhật đề thi
      const sql = `UPDATE exam_participants SET question_id = ? WHERE id = ?`;
      await runQuery(this.db, sql, [randomQuestion.id, id]);

      // Trả về thông tin đã được cập nhật
      return await this.findById(id);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Reset lần làm bài của thí sinh (để thí sinh có thể làm bài lại)
   */
  async resetExam(id: number): Promise<ExamParticipant | null> {
    try {
      const participant = await this.findByIdWithDetails(id);
      if (!participant) {
        throw new Error('Không tìm thấy thông tin tham gia thi');
      }

      // Xóa file audio nếu có
      if (participant.audio_file_path && fs.existsSync(participant.audio_file_path)) {
        try {
          fs.unlinkSync(participant.audio_file_path);
          console.log('Deleted audio file:', participant.audio_file_path);
        } catch (error) {
          console.error('Error deleting audio file:', error);
          // Không throw error để không cản trở việc reset
        }
      }

      // Reset thông tin tham gia thi - xóa đề thi để học sinh tự random lại
      const sql = `
        UPDATE exam_participants
        SET status = 'waiting',
            start_time = NULL,
            submit_time = NULL,
            audio_file_path = NULL,
            question_id = NULL
        WHERE id = ?
      `;

      await runQuery(this.db, sql, [id]);
      
      // Trả về thông tin đã được cập nhật
      return await this.findById(id);
    } catch (error) {
      throw error;
    }
  }
}
