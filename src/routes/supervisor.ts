// Supervisor routes - API dành cho giám thị

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { StudentModel } from '../models/Student';
import { ExamModel } from '../models/Exam';
import { ExamParticipantModel } from '../models/ExamParticipant';
import { ExamQuestionModel } from '../models/ExamQuestion';
import { requireSupervisor } from '../middleware/auth';
import { 
  validate, 
  validateCreateStudent, 
  validateUpdateStudent,
  validateCreateExam,
  validateUpdateExam,
  validateId,
  validatePagination,
  validateSearch,
  validateAddStudentsToExam,
  validateExamMonitoring,
  validateAudioSubmission
} from '../middleware/validation';
import { ApiResponse, HttpStatus, ResponseMessages } from '../types/index';
import { 
  parseStudentExcel, 
  validateStudentData, 
  createStudentImportTemplate,
  exportStudentsToExcel,
  exportExamResultsToExcel,
  isValidExcelFormat,
  generateExcelFilename
} from '../utils/excelHelper';
import { convertAudioToMP3, cleanupTempFiles, validateMP3File, detectAudioFormat } from '../utils/audioProcessor';
import { ExamParticipantWithDetails } from '../types/models';
import { getTempUploadPath, getAudioUploadPath } from '../config/config';

const router = Router();

// Multer config cho upload Excel
const excelUpload = multer({
  dest: getTempUploadPath(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (isValidExcelFormat(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file Excel (.xlsx, .xls)'));
    }
  }
});

// ===== STUDENT MANAGEMENT =====

/**
 * GET /api/supervisor/students
 * Lấy danh sách học sinh (có phân trang và tìm kiếm)
 */
router.get('/students', requireSupervisor, validate(validatePagination.concat(validateSearch)), async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.q as string;

    const studentModel = new StudentModel();
    let result;
    if (search) {
      result = await studentModel.search(search, { page, limit });
    } else {
      result = await studentModel.findAll({ page, limit });
    }

    const response: ApiResponse = {
      success: true,
      message: ResponseMessages.SUCCESS,
      data: result
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Get students error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * POST /api/supervisor/students
 * Tạo học sinh mới
 */
router.post('/students', requireSupervisor, validate(validateCreateStudent), async (req: Request, res: Response) => {
  try {
    const studentModel = new StudentModel();
    const result = await studentModel.create(req.body);
    
    const response: ApiResponse = {
      success: true,
      message: 'Tạo học sinh thành công',
      data: {
        student: {
          id: result.student.id,
          student_code: result.student.student_code,
          full_name: result.student.full_name,
          created_at: result.student.created_at
        },
        generated_password: result.password
      }
    };

    res.status(HttpStatus.CREATED).json(response);
  } catch (error: any) {
    console.error('Create student error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * PUT /api/supervisor/students/:id
 * Cập nhật thông tin học sinh
 */
router.put('/students/:id', requireSupervisor, validate(validateUpdateStudent), async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.id);
    const studentModel = new StudentModel();
    const updatedStudent = await studentModel.update(studentId, req.body);
    
    if (!updatedStudent) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.NOT_FOUND,
        error: 'Không tìm thấy học sinh'
      };
      res.status(HttpStatus.NOT_FOUND).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: 'Cập nhật học sinh thành công',
      data: {
        student: {
          id: updatedStudent.id,
          student_code: updatedStudent.student_code,
          full_name: updatedStudent.full_name,
          created_at: updatedStudent.created_at
        }
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Update student error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * DELETE /api/supervisor/students/:id
 * Xóa học sinh
 */
router.delete('/students/:id', requireSupervisor, validate(validateId), async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.id);
    const studentModel = new StudentModel();
    const deleted = await studentModel.delete(studentId);
    
    if (!deleted) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.NOT_FOUND,
        error: 'Không tìm thấy học sinh'
      };
      res.status(HttpStatus.NOT_FOUND).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: 'Xóa học sinh thành công'
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Delete student error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * POST /api/supervisor/students/:id/reset-password
 * Reset mật khẩu học sinh
 */
router.post('/students/:id/reset-password', requireSupervisor, validate(validateId), async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.id);
    const studentModel = new StudentModel();
    const newPassword = await studentModel.resetPassword(studentId);
    
    if (!newPassword) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.NOT_FOUND,
        error: 'Không tìm thấy học sinh'
      };
      res.status(HttpStatus.NOT_FOUND).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: 'Reset mật khẩu thành công',
      data: {
        new_password: newPassword
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Reset password error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

// ===== EXCEL IMPORT/EXPORT =====

/**
 * GET /api/supervisor/students/template
 * Download template Excel để import học sinh
 */
router.get('/students/template', requireSupervisor, async (req: Request, res: Response) => {
  try {
    const buffer = createStudentImportTemplate();
    const filename = generateExcelFilename('template_hoc_sinh');
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Generate template error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * POST /api/supervisor/students/import
 * Import học sinh từ file Excel
 */
router.post('/students/import', requireSupervisor, excelUpload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.VALIDATION_ERROR,
        error: 'Vui lòng chọn file Excel'
      };
      res.status(HttpStatus.BAD_REQUEST).json(response);
      return;
    }

    // Parse Excel file
    const studentsData = await parseStudentExcel(req.file.path);
    
    // Validate data
    const { valid, errors } = validateStudentData(studentsData);
    
    if (valid.length === 0) {
      // Cleanup uploaded file
      fs.unlinkSync(req.file.path);
      
      const response: ApiResponse = {
        success: false,
        message: 'Không có dữ liệu hợp lệ để import',
        error: 'Tất cả các dòng đều có lỗi',
        data: { errors }
      };
      res.status(HttpStatus.BAD_REQUEST).json(response);
      return;
    }

    // Import valid students
    let success = 0;
    let failed = 0;
    const importErrors: any[] = [...errors];
    const studentModel = new StudentModel();

    for (const studentData of valid) {
      try {
        await studentModel.create(studentData);
        success++;
      } catch (error: any) {
        failed++;
        importErrors.push({
          student_code: studentData.student_code,
          error: error.message
        });
      }
    }

    // Cleanup uploaded file
    fs.unlinkSync(req.file.path);

    const response: ApiResponse = {
      success: true,
      message: `Import hoàn thành: ${success} thành công, ${failed} thất bại`,
      data: {
        total: studentsData.length,
        success,
        failed,
        errors: importErrors
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Import students error:', error);
    
    // Cleanup uploaded file if exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * GET /api/supervisor/students/export
 * Export danh sách học sinh ra Excel
 */
router.get('/students/export', requireSupervisor, async (req: Request, res: Response) => {
  try {
    const studentModel = new StudentModel();
    const allStudents = await studentModel.findAll({ page: 1, limit: 1000 });
    const buffer = exportStudentsToExcel(allStudents.items);
    const filename = generateExcelFilename('danh_sach_hoc_sinh');
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Export students error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

// ===== EXAM MANAGEMENT =====

/**
 * GET /api/supervisor/exams
 * Lấy danh sách kỳ thi
 */
router.get('/exams', requireSupervisor, validate(validatePagination.concat(validateSearch)), async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.q as string;

    const examModel = new ExamModel();
    let result;
    if (search) {
      result = await examModel.search(search, { page, limit });
    } else {
      result = await examModel.findAll({ page, limit });
    }

    const response: ApiResponse = {
      success: true,
      message: ResponseMessages.SUCCESS,
      data: result
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Get exams error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * POST /api/supervisor/exams
 * Tạo kỳ thi mới
 */
router.post('/exams', requireSupervisor, validate(validateCreateExam), async (req: Request, res: Response) => {
  try {
    const examModel = new ExamModel();
    const exam = await examModel.create(req.body);
    
    const response: ApiResponse = {
      success: true,
      message: 'Tạo kỳ thi thành công',
      data: { exam }
    };

    res.status(HttpStatus.CREATED).json(response);
  } catch (error: any) {
    console.error('Create exam error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * PUT /api/supervisor/exams/:id
 * Cập nhật kỳ thi
 */
router.put('/exams/:id', requireSupervisor, validate(validateUpdateExam), async (req: Request, res: Response) => {
  try {
    const examId = parseInt(req.params.id);
    const examModel = new ExamModel();
    const updatedExam = await examModel.update(examId, req.body);
    
    if (!updatedExam) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.NOT_FOUND,
        error: 'Không tìm thấy kỳ thi'
      };
      res.status(HttpStatus.NOT_FOUND).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: 'Cập nhật kỳ thi thành công',
      data: { exam: updatedExam }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Update exam error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * DELETE /api/supervisor/exams/:id
 * Xóa kỳ thi
 */
router.delete('/exams/:id', requireSupervisor, validate(validateId), async (req: Request, res: Response) => {
  try {
    const examId = parseInt(req.params.id);
    const examModel = new ExamModel();
    const deleted = await examModel.delete(examId);
    
    if (!deleted) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.NOT_FOUND,
        error: 'Không tìm thấy kỳ thi hoặc kỳ thi đã có học sinh tham gia'
      };
      res.status(HttpStatus.NOT_FOUND).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: 'Xóa kỳ thi thành công'
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Delete exam error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

// ===== EXAM PARTICIPANT MANAGEMENT =====

/**
 * POST /api/supervisor/exams/:examId/students
 * Thêm học sinh vào kỳ thi
 */
router.post('/exams/:examId/students', requireSupervisor, validate(validateAddStudentsToExam), async (req: Request, res: Response) => {
  try {
    const examId = parseInt(req.params.examId);
    const { student_ids } = req.body;

    const examParticipantModel = new ExamParticipantModel();
    const result = await examParticipantModel.createMany(examId, student_ids);
    
    const response: ApiResponse = {
      success: true,
      message: `Thêm học sinh vào kỳ thi: ${result.success} thành công, ${result.failed} thất bại`,
      data: result
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Add students to exam error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * GET /api/supervisor/exams/:examId/monitoring
 * Lấy dữ liệu monitoring kỳ thi
 */
router.get('/exams/:examId/monitoring', requireSupervisor, validate(validateExamMonitoring), async (req: Request, res: Response) => {
  try {
    const examId = parseInt(req.params.examId);
    const examParticipantModel = new ExamParticipantModel();
    const monitoringData = await examParticipantModel.getMonitoringData(examId);
    
    if (!monitoringData) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.NOT_FOUND,
        error: 'Không tìm thấy kỳ thi'
      };
      res.status(HttpStatus.NOT_FOUND).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: ResponseMessages.SUCCESS,
      data: monitoringData
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Get exam monitoring error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * GET /api/supervisor/exams/:examId/export
 * Export tất cả file audio của thí sinh trong kỳ thi dưới dạng ZIP
 */
router.get('/exams/:examId/export', requireSupervisor, validate(validateExamMonitoring), async (req: Request, res: Response) => {
  try {
    const examId = parseInt(req.params.examId);
    const examParticipantModel = new ExamParticipantModel();
    const monitoringData = await examParticipantModel.getMonitoringData(examId);
    
    if (!monitoringData) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.NOT_FOUND,
        error: 'Không tìm thấy kỳ thi'
      };
      res.status(HttpStatus.NOT_FOUND).json(response);
      return;
    }

    // Lấy danh sách participants có file audio
    const participantsWithAudio = [];
    for (const p of monitoringData.participants) {
      const participant = await examParticipantModel.findByIdWithDetails(p.id);
      if (participant && participant.audio_file_path && fs.existsSync(participant.audio_file_path)) {
        participantsWithAudio.push(participant);
      }
    }

    if (participantsWithAudio.length === 0) {
      const response: ApiResponse = {
        success: false,
        message: 'Không có file audio nào để tải về',
        error: 'Chưa có thí sinh nào nộp bài'
      };
      res.status(HttpStatus.NOT_FOUND).json(response);
      return;
    }

    // Tạo tên file ZIP
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const examNameSafe = monitoringData.exam.exam_name.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const zipFilename = `audio_${examNameSafe}_${timestamp}.zip`;

    // Thiết lập response headers cho file ZIP
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

    // Tạo archive stream
    const archive = archiver('zip', {
      zlib: { level: 9 } // Compression level
    });

    // Pipe archive data to the response
    archive.pipe(res);

    // Thêm file audio vào archive (convert thành MP3 nếu cần)
    const tempFilesToCleanup: string[] = [];
    const conversionPromises: Promise<{fileToArchive: string, audioFilename: string}>[] = [];
    
    // Tạo promises cho tất cả conversion operations
    for (const participant of participantsWithAudio) {
      const audioPath = participant.audio_file_path;
      if (!audioPath) continue; // Skip if no audio file
      
      // Tạo tên file: {mã học sinh}.mp3
      const audioFilename = `${participant.student.student_code}.mp3`;
      
      // Tạo promise cho việc convert audio
      const conversionPromise = (async (): Promise<{fileToArchive: string, audioFilename: string}> => {
        // Detect thực sự format của file (không dựa vào extension)
        const formatDetection = await detectAudioFormat(audioPath);
        let fileToArchive = audioPath;
        
        console.log(`Audio format detection for ${audioFilename}: format=${formatDetection.format}, codec=${formatDetection.codec}, needsConversion=${formatDetection.needsConversion}`);
        
        if (formatDetection.needsConversion) {
          // Convert file thành MP3 tạm thời
          const tempMp3Path = path.join(getTempUploadPath(), `temp_export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`);
          
          try {
            console.log(`Converting ${formatDetection.format} (${formatDetection.codec}) to MP3 for export: ${audioFilename}`);
            const conversionResult = await convertAudioToMP3(audioPath, tempMp3Path);
            
            if (conversionResult.success && conversionResult.convertedPath && fs.existsSync(conversionResult.convertedPath)) {
              // Validate converted MP3 file
              const validation = await validateMP3File(conversionResult.convertedPath);
              if (validation.isValid) {
                fileToArchive = conversionResult.convertedPath;
                tempFilesToCleanup.push(conversionResult.convertedPath);
                console.log(`Successfully converted and validated ${formatDetection.format} to MP3 for export: ${audioFilename} (duration: ${validation.duration}s)`);
              } else {
                console.warn(`Converted MP3 file failed validation: ${validation.error}, using original file: ${audioFilename}`);
                // Delete invalid converted file
                try {
                  fs.unlinkSync(conversionResult.convertedPath);
                } catch (deleteError) {
                  console.error('Error deleting invalid converted file:', deleteError);
                }
                fileToArchive = audioPath;
              }
            } else {
              console.warn(`Failed to convert ${formatDetection.format} to MP3, using original file: ${audioFilename}`, conversionResult.error);
              // Use original file if conversion fails
              fileToArchive = audioPath;
            }
          } catch (error) {
            console.error(`Error converting audio for ${audioFilename}:`, error);
            // Use original file if conversion fails
            fileToArchive = audioPath;
          }
        } else {
          // File is already a valid MP3, no conversion needed
          console.log(`File is already MP3 format for ${audioFilename}: ${formatDetection.format} (${formatDetection.codec})`);
          fileToArchive = audioPath;
        }
        
        return { fileToArchive, audioFilename };
      })();
      
      conversionPromises.push(conversionPromise);
    }
    
    // Đợi tất cả conversion hoàn thành
    console.log(`Waiting for ${conversionPromises.length} audio conversions to complete...`);
    const conversionResults = await Promise.all(conversionPromises);
    
    // Thêm tất cả files vào archive sau khi conversion hoàn thành
    for (const result of conversionResults) {
      if (fs.existsSync(result.fileToArchive)) {
        archive.file(result.fileToArchive, { name: result.audioFilename });
        console.log(`Added to archive: ${result.audioFilename}`);
      } else {
        console.error(`File not found for archive: ${result.fileToArchive}`);
      }
    }
    
    // Cleanup temporary files when archive is finalized
    archive.on('end', async () => {
      console.log('Archive finalized, starting cleanup...');
      if (tempFilesToCleanup.length > 0) {
        // Delay cleanup to ensure archive stream is completely finished
        setTimeout(async () => {
          try {
            await cleanupTempFiles(tempFilesToCleanup);
            console.log(`Cleaned up ${tempFilesToCleanup.length} temporary files`);
          } catch (error) {
            console.error('Error cleaning up temporary files:', error);
          }
        }, 2000); // 2 second delay
      }
    });
    
    // Handle archive errors
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Lỗi tạo file ZIP',
          error: err.message
        });
      }
    });

    // Finalize the archive sau khi đã thêm tất cả files
    console.log(`Finalizing archive with ${conversionResults.length} files...`);
    await archive.finalize();

  } catch (error: any) {
    console.error('Export audio files error:', error);
    
    // Ensure response is not already sent
    if (!res.headersSent) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.ERROR,
        error: error.message
      };
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
    }
  }
});

/**
 * GET /api/supervisor/exams/:examId/audio/:participantId
 * Download file audio của học sinh (luôn ở định dạng MP3)
 */
router.get('/exams/:examId/audio/:participantId', requireSupervisor, async (req: Request, res: Response) => {
  let tempFileToCleanup: string | null = null;
  
  try {
    const participantId = parseInt(req.params.participantId);
    const examParticipantModel = new ExamParticipantModel();
    const participant = await examParticipantModel.findByIdWithDetails(participantId);
    
    if (!participant || !participant.audio_file_path) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.NOT_FOUND,
        error: 'Không tìm thấy file audio'
      };
      res.status(HttpStatus.NOT_FOUND).json(response);
      return;
    }

    const audioPath = participant.audio_file_path;
    
    if (!fs.existsSync(audioPath)) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.NOT_FOUND,
        error: 'File audio không tồn tại'
      };
      res.status(HttpStatus.NOT_FOUND).json(response);
      return;
    }

    // Tạo tên file luôn có extension .mp3
    const questionCode = participant.question?.question_code || 'unknown';
    const filename = `${participant.student.student_code}_${questionCode}.mp3`;
    
    // Detect thực sự format của file (không dựa vào extension)
    const formatDetection = await detectAudioFormat(audioPath);
    let fileToSend = audioPath;
    
    console.log(`Audio format detection for download ${filename}: format=${formatDetection.format}, codec=${formatDetection.codec}, needsConversion=${formatDetection.needsConversion}`);
    
    if (formatDetection.needsConversion) {
      // Convert file thành MP3 tạm thời
      const tempMp3Path = path.join(getTempUploadPath(), `download_temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`);
      
      try {
        console.log(`Converting ${formatDetection.format} (${formatDetection.codec}) to MP3 for download: ${filename}`);
        const conversionResult = await convertAudioToMP3(audioPath, tempMp3Path);
        
        if (conversionResult.success && conversionResult.convertedPath && fs.existsSync(conversionResult.convertedPath)) {
          // Validate converted file
          const validation = await validateMP3File(conversionResult.convertedPath);
          if (validation.isValid) {
            fileToSend = conversionResult.convertedPath;
            tempFileToCleanup = conversionResult.convertedPath;
            console.log(`Successfully converted and validated for download: ${filename} (duration: ${validation.duration}s)`);
          } else {
            console.warn(`Converted MP3 file failed validation: ${validation.error}, using original file: ${filename}`);
            // Delete invalid converted file
            try {
              fs.unlinkSync(conversionResult.convertedPath);
            } catch (deleteError) {
              console.error('Error deleting invalid converted file:', deleteError);
            }
          }
        } else {
          console.warn(`Failed to convert ${formatDetection.format} to MP3 for download, using original file:`, conversionResult.error);
        }
      } catch (error) {
        console.error(`Error converting audio for download:`, error);
        // Continue with original file if conversion fails
      }
    } else {
      // File is already a valid MP3, no conversion needed
      console.log(`File is already MP3 format for download ${filename}: ${formatDetection.format} (${formatDetection.codec})`);
    }
    
    // Set response headers
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Send file and cleanup temp file after response
    res.sendFile(path.resolve(fileToSend), (err) => {
      if (err && !res.headersSent) {
        console.error('Error sending file:', err);
        const response: ApiResponse = {
          success: false,
          message: ResponseMessages.ERROR,
          error: 'Lỗi tải file'
        };
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
      }
      
      // Cleanup temporary file after download completes (success or failure)
      if (tempFileToCleanup) {
        // Longer delay to ensure file transmission is complete
        setTimeout(async () => {
          try {
            if (fs.existsSync(tempFileToCleanup!)) {
              await cleanupTempFiles([tempFileToCleanup!]);
              console.log(`Cleaned up temporary download file: ${tempFileToCleanup}`);
            }
          } catch (cleanupError) {
            console.error('Error cleaning up temporary download file:', cleanupError);
          }
        }, 3000); // 3 second delay to ensure transmission is complete
      }
    });
    
  } catch (error: any) {
    console.error('Download audio error:', error);
    
    // Cleanup temp file if error occurs
    if (tempFileToCleanup) {
      setTimeout(async () => {
        try {
          if (fs.existsSync(tempFileToCleanup!)) {
            await cleanupTempFiles([tempFileToCleanup!]);
            console.log(`Cleaned up temp file after error: ${tempFileToCleanup}`);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up temp file after error:', cleanupError);
        }
      }, 2000); // 2 second delay
    }
    
    if (!res.headersSent) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.ERROR,
        error: error.message
      };
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
    }
  }
});

/**
 * DELETE /api/supervisor/participants/:participantId/reset
 * Reset lần làm bài của thí sinh (để thí sinh có thể làm bài lại)
 */
router.delete('/participants/:participantId/reset', requireSupervisor, validate(validateAudioSubmission), async (req: Request, res: Response) => {
  try {
    const participantId = parseInt(req.params.participantId);
    
    const examParticipantModel = new ExamParticipantModel();
    
    // Kiểm tra participant có tồn tại không
    const participant = await examParticipantModel.findByIdWithDetails(participantId);
    if (!participant) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.NOT_FOUND,
        error: 'Không tìm thấy thông tin tham gia thi'
      };
      res.status(HttpStatus.NOT_FOUND).json(response);
      return;
    }

    // Reset lần làm bài - luôn xóa số đề
    const resetParticipant = await examParticipantModel.resetExam(participantId);
    
    if (!resetParticipant) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.ERROR,
        error: 'Lỗi reset lần làm bài'
      };
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: `Reset lần làm bài thành công cho học sinh ${participant.student.full_name}`,
      data: {
        participant: {
          id: resetParticipant.id,
          student_id: resetParticipant.student_id,
          exam_id: resetParticipant.exam_id,
          question_id: resetParticipant.question_id,
          status: resetParticipant.status,
          start_time: resetParticipant.start_time,
          submit_time: resetParticipant.submit_time,
          audio_file_path: resetParticipant.audio_file_path
        },
        student: {
          student_code: participant.student.student_code,
          full_name: participant.student.full_name
        },
        exam: {
          exam_name: participant.exam.exam_name
        }
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Reset exam error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

// ===== EXAM QUESTION MANAGEMENT =====

/**
 * POST /api/supervisor/exams/:examId/questions
 * Tạo đề thi mới cho kỳ thi
 */
router.post('/exams/:examId/questions', requireSupervisor, async (req: Request, res: Response) => {
  try {
    const examId = parseInt(req.params.examId);
    const { question_code, pdf_drive_url, is_active } = req.body;

    if (!question_code || !pdf_drive_url) {
      const response: ApiResponse = {
        success: false,
        message: 'Thiếu thông tin bắt buộc',
        error: 'question_code và pdf_drive_url là bắt buộc'
      };
      return res.status(HttpStatus.BAD_REQUEST).json(response);
    }

    // Kiểm tra kỳ thi tồn tại
    const examModel = new ExamModel();
    const exam = await examModel.findById(examId);
    if (!exam) {
      const response: ApiResponse = {
        success: false,
        message: 'Không tìm thấy kỳ thi',
        error: `Exam ID ${examId} không tồn tại`
      };
      return res.status(HttpStatus.NOT_FOUND).json(response);
    }

    const examQuestionModel = new ExamQuestionModel();
    const question = await examQuestionModel.create({
      exam_id: examId,
      question_code,
      pdf_drive_url,
      is_active: is_active !== undefined ? is_active : true
    });

    const response: ApiResponse = {
      success: true,
      message: 'Tạo đề thi thành công',
      data: { question }
    };

    res.status(HttpStatus.CREATED).json(response);
  } catch (error: any) {
    console.error('Create exam question error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * POST /api/supervisor/exams/:examId/questions/batch
 * Tạo nhiều đề thi cùng lúc
 */
router.post('/exams/:examId/questions/batch', requireSupervisor, async (req: Request, res: Response) => {
  try {
    const examId = parseInt(req.params.examId);
    const { questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      const response: ApiResponse = {
        success: false,
        message: 'Thiếu danh sách đề thi',
        error: 'questions phải là mảng và không được rỗng'
      };
      return res.status(HttpStatus.BAD_REQUEST).json(response);
    }

    // Kiểm tra kỳ thi tồn tại
    const examModel = new ExamModel();
    const exam = await examModel.findById(examId);
    if (!exam) {
      const response: ApiResponse = {
        success: false,
        message: 'Không tìm thấy kỳ thi',
        error: `Exam ID ${examId} không tồn tại`
      };
      return res.status(HttpStatus.NOT_FOUND).json(response);
    }

    const examQuestionModel = new ExamQuestionModel();
    const result = await examQuestionModel.createMany(examId, questions);

    const response: ApiResponse = {
      success: true,
      message: `Tạo đề thi thành công: ${result.success}/${questions.length}`,
      data: result
    };

    res.status(HttpStatus.CREATED).json(response);
  } catch (error: any) {
    console.error('Batch create exam questions error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * GET /api/supervisor/exams/:examId/questions
 * Lấy danh sách đề thi của kỳ thi
 */
router.get('/exams/:examId/questions', requireSupervisor, async (req: Request, res: Response) => {
  try {
    const examId = parseInt(req.params.examId);
    const activeOnly = req.query.active === 'true';

    const examQuestionModel = new ExamQuestionModel();
    const questions = await examQuestionModel.findByExam(examId, activeOnly);

    const response: ApiResponse = {
      success: true,
      message: ResponseMessages.SUCCESS,
      data: { questions }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Get exam questions error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * GET /api/supervisor/exams/:examId/questions/usage
 * Lấy thống kê sử dụng đề thi
 */
router.get('/exams/:examId/questions/usage', requireSupervisor, async (req: Request, res: Response) => {
  try {
    const examId = parseInt(req.params.examId);

    const examQuestionModel = new ExamQuestionModel();
    const usageStats = await examQuestionModel.getUsedQuestions(examId);

    const response: ApiResponse = {
      success: true,
      message: ResponseMessages.SUCCESS,
      data: { usage: usageStats }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Get question usage error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * GET /api/supervisor/questions/:id
 * Lấy thông tin chi tiết đề thi
 */
router.get('/questions/:id', requireSupervisor, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    const examQuestionModel = new ExamQuestionModel();
    const question = await examQuestionModel.findByIdWithExam(id);

    if (!question) {
      const response: ApiResponse = {
        success: false,
        message: 'Không tìm thấy đề thi',
        error: `Question ID ${id} không tồn tại`
      };
      return res.status(HttpStatus.NOT_FOUND).json(response);
    }

    const response: ApiResponse = {
      success: true,
      message: ResponseMessages.SUCCESS,
      data: { question }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Get question error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * PUT /api/supervisor/questions/:id
 * Cập nhật thông tin đề thi
 */
router.put('/questions/:id', requireSupervisor, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { question_code, pdf_drive_url, is_active } = req.body;

    const examQuestionModel = new ExamQuestionModel();
    const question = await examQuestionModel.update(id, {
      question_code,
      pdf_drive_url,
      is_active
    });

    if (!question) {
      const response: ApiResponse = {
        success: false,
        message: 'Không tìm thấy đề thi',
        error: `Question ID ${id} không tồn tại`
      };
      return res.status(HttpStatus.NOT_FOUND).json(response);
    }

    const response: ApiResponse = {
      success: true,
      message: 'Cập nhật đề thi thành công',
      data: { question }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Update question error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * DELETE /api/supervisor/questions/:id
 * Xóa đề thi
 */
router.delete('/questions/:id', requireSupervisor, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    const examQuestionModel = new ExamQuestionModel();
    const deleted = await examQuestionModel.delete(id);

    if (!deleted) {
      const response: ApiResponse = {
        success: false,
        message: 'Không tìm thấy đề thi',
        error: `Question ID ${id} không tồn tại`
      };
      return res.status(HttpStatus.NOT_FOUND).json(response);
    }

    const response: ApiResponse = {
      success: true,
      message: 'Xóa đề thi thành công'
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Delete question error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * PATCH /api/supervisor/questions/:id/toggle
 * Bật/tắt đề thi
 */
router.patch('/questions/:id/toggle', requireSupervisor, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { is_active } = req.body;

    if (is_active === undefined) {
      const response: ApiResponse = {
        success: false,
        message: 'Thiếu thông tin is_active',
        error: 'is_active là bắt buộc'
      };
      return res.status(HttpStatus.BAD_REQUEST).json(response);
    }

    const examQuestionModel = new ExamQuestionModel();
    const question = await examQuestionModel.setActive(id, is_active);

    if (!question) {
      const response: ApiResponse = {
        success: false,
        message: 'Không tìm thấy đề thi',
        error: `Question ID ${id} không tồn tại`
      };
      return res.status(HttpStatus.NOT_FOUND).json(response);
    }

    const response: ApiResponse = {
      success: true,
      message: `${is_active ? 'Kích hoạt' : 'Vô hiệu hóa'} đề thi thành công`,
      data: { question }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Toggle question error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

export default router;
