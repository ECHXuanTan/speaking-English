// System routes - API chung của hệ thống

import { Router, Request, Response } from 'express';
import { StudentModel } from '../models/Student';
import { ExamModel } from '../models/Exam';
import { ExamParticipantModel } from '../models/ExamParticipant';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { ApiResponse, HttpStatus, ResponseMessages } from '../types/index';
import { config } from '../config/config';
import { checkFFmpegAvailability } from '../utils/audioProcessor';
import { getDatabasePath } from '../config/config';
import fs from 'fs';

const router = Router();

/**
 * GET /api/system/health
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Kiểm tra database
    const dbPath = getDatabasePath();
    const dbExists = fs.existsSync(dbPath);
    
    // Kiểm tra FFmpeg (for audio processing)
    const ffmpegAvailable = await checkFFmpegAvailability();
    
    // Kiểm tra thư mục uploads
    const uploadsPath = config.upload.audioPath;
    const uploadsExists = fs.existsSync(uploadsPath);
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: dbExists,
        path: dbPath
      },
      audio: {
        ffmpeg_available: ffmpegAvailable
      },
      storage: {
        uploads_directory: uploadsExists,
        path: uploadsPath
      },
      config: {
        node_env: process.env.NODE_ENV || 'development',
        port: config.port
      }
    };

    const response: ApiResponse = {
      success: true,
      message: 'System is healthy',
      data: health
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Health check error:', error);
    const response: ApiResponse = {
      success: false,
      message: 'System health check failed',
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * GET /api/system/stats
 * Lấy thống kê tổng quan hệ thống
 */
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const studentModel = new StudentModel();
    const examModel = new ExamModel();
    const [
      totalStudents,
      totalExams,
      // Thống kê exam participants theo status
      totalParticipants,
      waitingCount,
      inProgressCount,
      completedCount
    ] = await Promise.all([
      studentModel.count(),
      examModel.count(),
      // Đếm tổng participants
      new Promise<number>((resolve, reject) => {
        const db = require('../config/database').getDatabase();
        db.get('SELECT COUNT(*) as count FROM exam_participants', (err: any, row: any) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      }),
      // Đếm waiting
      new Promise<number>((resolve, reject) => {
        const db = require('../config/database').getDatabase();
        db.get("SELECT COUNT(*) as count FROM exam_participants WHERE status = 'waiting'", (err: any, row: any) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      }),
      // Đếm in_progress
      new Promise<number>((resolve, reject) => {
        const db = require('../config/database').getDatabase();
        db.get("SELECT COUNT(*) as count FROM exam_participants WHERE status = 'in_progress'", (err: any, row: any) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      }),
      // Đếm completed
      new Promise<number>((resolve, reject) => {
        const db = require('../config/database').getDatabase();
        db.get("SELECT COUNT(*) as count FROM exam_participants WHERE status = 'completed'", (err: any, row: any) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      })
    ]);

    const stats = {
      students: {
        total: totalStudents
      },
      exams: {
        total: totalExams
      },
      participants: {
        total: totalParticipants,
        waiting: waitingCount,
        in_progress: inProgressCount,
        completed: completedCount,
        completion_rate: totalParticipants > 0 ? (completedCount / totalParticipants * 100).toFixed(1) : '0'
      }
    };

    const response: ApiResponse = {
      success: true,
      message: ResponseMessages.SUCCESS,
      data: stats
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Get system stats error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * GET /api/system/config
 * Lấy cấu hình hệ thống (chỉ những thông tin cần thiết cho client)
 */
router.get('/config', optionalAuth, (req: Request, res: Response) => {
  try {
    const publicConfig = {
      upload: {
        maxFileSize: config.upload.maxFileSize,
        audioFormats: config.upload.audioFormats,
        excelFormats: config.upload.excelFormats
      },
      exam: {
        defaultPreparationTime: config.exam.defaultPreparationTime,
        defaultExamDuration: config.exam.defaultExamDuration,
        maxQuestions: config.exam.maxQuestions,
        autoSubmitDelay: config.exam.autoSubmitDelay
      },
      security: {
        passwordMinLength: config.security.passwordMinLength,
        sessionTimeout: config.security.sessionTimeout
      }
    };

    const response: ApiResponse = {
      success: true,
      message: ResponseMessages.SUCCESS,
      data: publicConfig
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Get config error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * GET /api/system/available-exams
 * Lấy danh sách kỳ thi có thể tham gia (public endpoint)
 */
router.get('/available-exams', async (req: Request, res: Response) => {
  try {
    const examModel = new ExamModel();
    const exams = await examModel.getAvailableExams();
    
    const response: ApiResponse = {
      success: true,
      message: ResponseMessages.SUCCESS,
      data: {
        exams: exams.map(exam => ({
          id: exam.id,
          exam_name: exam.exam_name,
          total_questions: exam.total_questions,
          preparation_time: exam.preparation_time,
          exam_duration: exam.exam_duration
        }))
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Get available exams error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * GET /api/system/exam-info/:examId
 * Lấy thông tin chi tiết kỳ thi (public endpoint)
 */
router.get('/exam-info/:examId', async (req: Request, res: Response) => {
  try {
    const examId = parseInt(req.params.examId);
    
    if (isNaN(examId)) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.VALIDATION_ERROR,
        error: 'ID kỳ thi không hợp lệ'
      };
      res.status(HttpStatus.BAD_REQUEST).json(response);
      return;
    }

    const examModel = new ExamModel();
    const exam = await examModel.findById(examId);
    
    if (!exam) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.NOT_FOUND,
        error: 'Không tìm thấy kỳ thi'
      };
      res.status(HttpStatus.NOT_FOUND).json(response);
      return;
    }

    const stats = await examModel.getStatistics(examId);

    const response: ApiResponse = {
      success: true,
      message: ResponseMessages.SUCCESS,
      data: {
        exam: {
          id: exam.id,
          exam_name: exam.exam_name,
          total_questions: exam.total_questions,
          preparation_time: exam.preparation_time,
          exam_duration: exam.exam_duration,
          created_at: exam.created_at
        },
        statistics: stats
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Get exam info error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * POST /api/system/check-student
 * Kiểm tra học sinh có tồn tại không (dùng trước khi login)
 */
router.post('/check-student', async (req: Request, res: Response) => {
  try {
    const { student_code } = req.body;
    
    if (!student_code) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.VALIDATION_ERROR,
        error: 'Mã học sinh không được để trống'
      };
      res.status(HttpStatus.BAD_REQUEST).json(response);
      return;
    }

    const studentModel = new StudentModel();
    const student = await studentModel.findByStudentCode(student_code);
    
    const response: ApiResponse = {
      success: true,
      message: ResponseMessages.SUCCESS,
      data: {
        exists: !!student,
        student_info: student ? {
          id: student.id,
          student_code: student.student_code,
          full_name: student.full_name
        } : null
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Check student error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * GET /api/system/time
 * Lấy thời gian server (để đồng bộ client)
 */
router.get('/time', (req: Request, res: Response) => {
  try {
    const response: ApiResponse = {
      success: true,
      message: ResponseMessages.SUCCESS,
      data: {
        server_time: new Date().toISOString(),
        timestamp: Date.now(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Get server time error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * GET /api/system/version
 * Lấy thông tin version hệ thống
 */
router.get('/version', (req: Request, res: Response) => {
  try {
    const packageJson = require('../../package.json');
    
    const response: ApiResponse = {
      success: true,
      message: ResponseMessages.SUCCESS,
      data: {
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
        author: packageJson.author,
        build_time: new Date().toISOString()
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Get version error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

export default router;
