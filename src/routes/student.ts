// Student routes - API dành cho học sinh

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { StudentModel } from '../models/Student';
import { ExamModel } from '../models/Exam';
import { ExamParticipantModel } from '../models/ExamParticipant';
import { requireStudent, requireOwnStudent } from '../middleware/auth';
import { validate, validateId, validateAudioSubmission } from '../middleware/validation';
import { ApiResponse, HttpStatus, ResponseMessages } from '../types/index';
import { processUploadedAudio } from '../utils/audioProcessor';
import { getTempUploadPath } from '../config/config';

const router = Router();

// Multer config cho upload audio
const audioUpload = multer({
  dest: getTempUploadPath(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/webm', 'audio/mp3', 'audio/wav', 'audio/mpeg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file audio định dạng WebM, MP3, WAV'));
    }
  }
});

/**
 * GET /api/student/profile
 * Lấy thông tin profile học sinh
 */
router.get('/profile', requireStudent, async (req: Request, res: Response) => {
  try {
    const studentModel = new StudentModel();
    const student = await studentModel.findById(req.user!.id);
    
    if (!student) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.NOT_FOUND,
        error: 'Không tìm thấy thông tin học sinh'
      };
      res.status(HttpStatus.NOT_FOUND).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: ResponseMessages.SUCCESS,
      data: {
        student: {
          id: student.id,
          student_code: student.student_code,
          full_name: student.full_name,
          created_at: student.created_at
        }
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Get student profile error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * GET /api/student/exams
 * Lấy danh sách kỳ thi của học sinh
 */
router.get('/exams', requireStudent, async (req: Request, res: Response) => {
  try {
    const examParticipantModel = new ExamParticipantModel();
    const studentExams = await examParticipantModel.findByStudent(req.user!.id);
    
    const response: ApiResponse = {
      success: true,
      message: ResponseMessages.SUCCESS,
      data: {
        exams: studentExams.map(exam => ({
          participant_id: exam.id,
          exam_id: exam.exam_id,
          exam_name: exam.exam.exam_name,
          question: exam.question, // Full question object with question_code, pdf_drive_url, etc.
          status: exam.status,
          preparation_time: exam.exam.preparation_time,
          exam_duration: exam.exam.exam_duration,
          start_time: exam.start_time,
          submit_time: exam.submit_time,
          audio_file_path: exam.audio_file_path
        }))
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Get student exams error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * GET /api/student/exam/:participantId
 * Lấy thông tin chi tiết kỳ thi
 */
router.get('/exam/:participantId', requireStudent, validate(validateAudioSubmission), async (req: Request, res: Response) => {
  try {
    const participantId = parseInt(req.params.participantId);
    const examParticipantModel = new ExamParticipantModel();
    const examInfo = await examParticipantModel.findByIdWithDetails(participantId);
    
    if (!examInfo) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.NOT_FOUND,
        error: 'Không tìm thấy thông tin kỳ thi'
      };
      res.status(HttpStatus.NOT_FOUND).json(response);
      return;
    }

    // Kiểm tra quyền truy cập
    if (examInfo.student_id !== req.user!.id) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.FORBIDDEN,
        error: 'Không có quyền truy cập thông tin này'
      };
      res.status(HttpStatus.FORBIDDEN).json(response);
      return;
    }

    // Tính thời gian còn lại nếu đang thi
    let remainingTime = null;
    if (examInfo.status === 'in_progress') {
      remainingTime = await examParticipantModel.getRemainingTime(participantId);
    }

    const response: ApiResponse = {
      success: true,
      message: ResponseMessages.SUCCESS,
      data: {
        exam: {
          participant_id: examInfo.id,
          exam_id: examInfo.exam_id,
          exam_name: examInfo.exam.exam_name,
          question: examInfo.question, // Full question object with question_code, pdf_drive_url
          status: examInfo.status,
          preparation_time: examInfo.exam.preparation_time,
          exam_duration: examInfo.exam.exam_duration,
          start_time: examInfo.start_time,
          submit_time: examInfo.submit_time,
          remaining_time: remainingTime,
          audio_file_path: examInfo.audio_file_path
        }
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Get exam details error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * POST /api/student/exam/:participantId/random-question
 * Random đề thi cho học sinh
 */
router.post('/exam/:participantId/random-question', requireStudent, validate(validateAudioSubmission), async (req: Request, res: Response) => {
  try {
    const participantId = parseInt(req.params.participantId);
    const examParticipantModel = new ExamParticipantModel();
    const examInfo = await examParticipantModel.findByIdWithDetails(participantId);

    if (!examInfo) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.NOT_FOUND,
        error: 'Không tìm thấy thông tin kỳ thi'
      };
      res.status(HttpStatus.NOT_FOUND).json(response);
      return;
    }

    // Kiểm tra quyền truy cập
    if (examInfo.student_id !== req.user!.id) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.FORBIDDEN,
        error: 'Không có quyền truy cập'
      };
      res.status(HttpStatus.FORBIDDEN).json(response);
      return;
    }

    // Random đề thi
    const updatedExam = await examParticipantModel.randomizeQuestion(participantId);

    if (!updatedExam) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.ERROR,
        error: 'Lỗi random đề thi'
      };
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
      return;
    }

    // Lấy thông tin đầy đủ để trả về question details
    const updatedInfo = await examParticipantModel.findByIdWithDetails(participantId);

    const response: ApiResponse = {
      success: true,
      message: 'Random đề thi thành công',
      data: {
        participant_id: updatedExam.id,
        question: updatedInfo?.question,
        status: updatedExam.status
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Random question error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * POST /api/student/exam/:participantId/start
 * Bắt đầu làm bài thi
 */
router.post('/exam/:participantId/start', requireStudent, validate(validateAudioSubmission), async (req: Request, res: Response) => {
  try {
    const participantId = parseInt(req.params.participantId);
    const examParticipantModel = new ExamParticipantModel();
    const examInfo = await examParticipantModel.findByIdWithDetails(participantId);
    
    if (!examInfo) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.NOT_FOUND,
        error: 'Không tìm thấy thông tin kỳ thi'
      };
      res.status(HttpStatus.NOT_FOUND).json(response);
      return;
    }

    // Kiểm tra quyền truy cập
    if (examInfo.student_id !== req.user!.id) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.FORBIDDEN,
        error: 'Không có quyền truy cập'
      };
      res.status(HttpStatus.FORBIDDEN).json(response);
      return;
    }

    // Kiểm tra trạng thái có thể bắt đầu thi không
    if (examInfo.status !== 'waiting') {
      const response: ApiResponse = {
        success: false,
        message: 'Không thể bắt đầu thi',
        error: examInfo.status === 'completed' ? 'Bài thi đã hoàn thành' : 'Bài thi đang diễn ra'
      };
      res.status(HttpStatus.BAD_REQUEST).json(response);
      return;
    }

    // Kiểm tra xem đã random đề chưa
    if (!examInfo.question_id) {
      const response: ApiResponse = {
        success: false,
        message: 'Chưa thể bắt đầu thi',
        error: 'Vui lòng random đề thi trước khi bắt đầu'
      };
      res.status(HttpStatus.BAD_REQUEST).json(response);
      return;
    }

    // Bắt đầu thi
    const updatedExam = await examParticipantModel.startExam(participantId);
    
    if (!updatedExam) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.ERROR,
        error: 'Lỗi bắt đầu bài thi'
      };
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: 'Bắt đầu bài thi thành công',
      data: {
        participant_id: updatedExam.id,
        status: updatedExam.status,
        start_time: updatedExam.start_time,
        exam_duration: examInfo.exam.exam_duration
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Start exam error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * POST /api/student/exam/:participantId/submit
 * Nộp bài thi (với audio)
 */
router.post('/exam/:participantId/submit', requireStudent, audioUpload.single('audio'), validate(validateAudioSubmission), async (req: Request, res: Response) => {
  try {
    const participantId = parseInt(req.params.participantId);
    const examParticipantModel = new ExamParticipantModel();
    const examInfo = await examParticipantModel.findByIdWithDetails(participantId);
    
    if (!examInfo) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.NOT_FOUND,
        error: 'Không tìm thấy thông tin kỳ thi'
      };
      res.status(HttpStatus.NOT_FOUND).json(response);
      return;
    }

    // Kiểm tra quyền truy cập
    if (examInfo.student_id !== req.user!.id) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.FORBIDDEN,
        error: 'Không có quyền truy cập'
      };
      res.status(HttpStatus.FORBIDDEN).json(response);
      return;
    }

    // Kiểm tra trạng thái có thể nộp bài không
    if (examInfo.status !== 'in_progress') {
      const response: ApiResponse = {
        success: false,
        message: 'Không thể nộp bài',
        error: examInfo.status === 'completed' ? 'Bài thi đã được nộp' : 'Bài thi chưa bắt đầu'
      };
      res.status(HttpStatus.BAD_REQUEST).json(response);
      return;
    }

    let audioFilePath: string | undefined;

    // Xử lý file audio nếu có
    if (req.file) {
      console.log('Processing uploaded audio file:', req.file.filename);
      
      const audioResult = await processUploadedAudio(
        req.file.path,
        examInfo.student_id,
        examInfo.exam_id,
        examInfo.question_number
      );

      if (audioResult.success && audioResult.convertedPath) {
        audioFilePath = audioResult.convertedPath;
        console.log('Audio processed successfully:', audioFilePath);
      } else {
        console.error('Audio processing failed:', audioResult.error);
        // Vẫn cho phép nộp bài mà không có audio
      }
    }

    // Nộp bài
    const updatedExam = await examParticipantModel.submitExam(participantId, audioFilePath);
    
    if (!updatedExam) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.ERROR,
        error: 'Lỗi nộp bài thi'
      };
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: 'Nộp bài thành công',
      data: {
        participant_id: updatedExam.id,
        status: updatedExam.status,
        submit_time: updatedExam.submit_time,
        audio_file_path: updatedExam.audio_file_path
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Submit exam error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * GET /api/student/exam/:participantId/time-remaining
 * Lấy thời gian còn lại của bài thi
 */
router.get('/exam/:participantId/time-remaining', requireStudent, validate(validateAudioSubmission), async (req: Request, res: Response) => {
  try {
    const participantId = parseInt(req.params.participantId);
    const examParticipantModel = new ExamParticipantModel();
    const examInfo = await examParticipantModel.findByIdWithDetails(participantId);
    
    if (!examInfo || examInfo.student_id !== req.user!.id) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.FORBIDDEN,
        error: 'Không có quyền truy cập'
      };
      res.status(HttpStatus.FORBIDDEN).json(response);
      return;
    }

    const remainingTime = await examParticipantModel.getRemainingTime(participantId);
    
    const response: ApiResponse = {
      success: true,
      message: ResponseMessages.SUCCESS,
      data: {
        remaining_time: remainingTime,
        status: examInfo.status
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Get remaining time error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * POST /api/student/test-microphone
 * Test microphone với audio upload
 */
router.post('/test-microphone', requireStudent, audioUpload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.VALIDATION_ERROR,
        error: 'Không có file audio để test'
      };
      res.status(HttpStatus.BAD_REQUEST).json(response);
      return;
    }

    // Chỉ cần xác nhận nhận được file, không lưu vào database
    console.log('Microphone test - received audio file:', req.file.filename);
    
    // Cleanup test file
    setTimeout(() => {
      try {
        const fs = require('fs');
        if (fs.existsSync(req.file!.path)) {
          fs.unlinkSync(req.file!.path);
        }
      } catch (error) {
        console.error('Error cleaning up test file:', error);
      }
    }, 5000);

    const response: ApiResponse = {
      success: true,
      message: 'Test microphone thành công',
      data: {
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Test microphone error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

export default router;
