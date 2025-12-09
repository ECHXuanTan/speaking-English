// Validation middleware sử dụng express-validator

import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { ApiResponse, HttpStatus, ResponseMessages } from '../types/index';

/**
 * Middleware xử lý validation errors
 */
export function handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.VALIDATION_ERROR,
      error: errors.array().map(error => `${(error as any).param || 'field'}: ${error.msg}`).join(', ')
    };
    res.status(HttpStatus.BAD_REQUEST).json(response);
    return;
  }
  
  next();
}

// ===== STUDENT VALIDATIONS =====

/**
 * Validation cho tạo học sinh
 */
export const validateCreateStudent: ValidationChain[] = [
  body('student_code')
    .notEmpty()
    .withMessage('Mã học sinh không được để trống')
    .isLength({ min: 3, max: 20 })
    .withMessage('Mã học sinh phải từ 3-20 ký tự')
    .matches(/^[A-Za-z0-9]+$/)
    .withMessage('Mã học sinh chỉ chứa chữ cái và số'),
  
  body('full_name')
    .notEmpty()
    .withMessage('Họ tên không được để trống')
    .isLength({ min: 2, max: 100 })
    .withMessage('Họ tên phải từ 2-100 ký tự')
    .trim(),
  
  body('password')
    .optional()
    .isLength({ min: 6, max: 50 })
    .withMessage('Mật khẩu phải từ 6-50 ký tự')
];

/**
 * Validation cho cập nhật học sinh
 */
export const validateUpdateStudent: ValidationChain[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID học sinh không hợp lệ'),
  
  body('student_code')
    .optional()
    .isLength({ min: 3, max: 20 })
    .withMessage('Mã học sinh phải từ 3-20 ký tự')
    .matches(/^[A-Za-z0-9]+$/)
    .withMessage('Mã học sinh chỉ chứa chữ cái và số'),
  
  body('full_name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Họ tên phải từ 2-100 ký tự')
    .trim(),
  
  body('password')
    .optional()
    .isLength({ min: 6, max: 50 })
    .withMessage('Mật khẩu phải từ 6-50 ký tự')
];

/**
 * Validation cho đăng nhập học sinh
 */
export const validateStudentLogin: ValidationChain[] = [
  body('student_code')
    .notEmpty()
    .withMessage('Mã học sinh không được để trống'),
  
  body('password')
    .notEmpty()
    .withMessage('Mật khẩu không được để trống')
];

// ===== EXAM VALIDATIONS =====

/**
 * Validation cho tạo kỳ thi
 */
export const validateCreateExam: ValidationChain[] = [
  body('exam_name')
    .notEmpty()
    .withMessage('Tên kỳ thi không được để trống')
    .isLength({ min: 3, max: 100 })
    .withMessage('Tên kỳ thi phải từ 3-100 ký tự')
    .trim(),
  
  body('total_questions')
    .isInt({ min: 1, max: 100 })
    .withMessage('Số lượng đề phải từ 1-100'),
  
  body('preparation_time')
    .isInt({ min: 0, max: 3600 })
    .withMessage('Thời gian chuẩn bị phải từ 0-3600 giây'),
  
  body('exam_duration')
    .isInt({ min: 60, max: 7200 })
    .withMessage('Thời gian làm bài phải từ 60-7200 giây')
];

/**
 * Validation cho cập nhật kỳ thi
 */
export const validateUpdateExam: ValidationChain[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID kỳ thi không hợp lệ'),
  
  body('exam_name')
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage('Tên kỳ thi phải từ 3-100 ký tự')
    .trim(),
  
  body('total_questions')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Số lượng đề phải từ 1-100'),
  
  body('preparation_time')
    .optional()
    .isInt({ min: 0, max: 3600 })
    .withMessage('Thời gian chuẩn bị phải từ 0-3600 giây'),
  
  body('exam_duration')
    .optional()
    .isInt({ min: 60, max: 7200 })
    .withMessage('Thời gian làm bài phải từ 60-7200 giây')
];

// ===== EXAM PARTICIPANT VALIDATIONS =====

/**
 * Validation cho thêm học sinh vào kỳ thi
 */
export const validateAddStudentToExam: ValidationChain[] = [
  body('exam_id')
    .isInt({ min: 1 })
    .withMessage('ID kỳ thi không hợp lệ'),
  
  body('student_id')
    .isInt({ min: 1 })
    .withMessage('ID học sinh không hợp lệ'),
  
  body('question_number')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Số đề phải từ 1-100')
];

/**
 * Validation cho thêm nhiều học sinh vào kỳ thi
 */
export const validateAddStudentsToExam: ValidationChain[] = [
  param('examId')
    .isInt({ min: 1 })
    .withMessage('ID kỳ thi không hợp lệ'),
  
  body('student_ids')
    .isArray({ min: 1 })
    .withMessage('Danh sách học sinh không được để trống'),
  
  body('student_ids.*')
    .isInt({ min: 1 })
    .withMessage('ID học sinh không hợp lệ')
];

// ===== COMMON VALIDATIONS =====

/**
 * Validation cho ID parameter
 */
export const validateId: ValidationChain[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID không hợp lệ')
];

/**
 * Validation cho pagination parameters
 */
export const validatePagination: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Số trang phải lớn hơn 0'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Số lượng item phải từ 1-100')
];

/**
 * Validation cho search query
 */
export const validateSearch: ValidationChain[] = [
  query('q')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Từ khóa tìm kiếm phải từ 1-100 ký tự')
    .trim()
];

/**
 * Validation cho file upload
 */
export const validateFileUpload = (fieldName: string, allowedMimeTypes: string[]) => [
  body(fieldName)
    .custom((value, { req }) => {
      if (!req.file) {
        throw new Error('File không được để trống');
      }
      
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        throw new Error(`File phải có định dạng: ${allowedMimeTypes.join(', ')}`);
      }
      
      return true;
    })
];

/**
 * Validation cho exam monitoring
 */
export const validateExamMonitoring: ValidationChain[] = [
  param('examId')
    .isInt({ min: 1 })
    .withMessage('ID kỳ thi không hợp lệ')
];

/**
 * Validation cho audio submission
 */
export const validateAudioSubmission: ValidationChain[] = [
  param('participantId')
    .isInt({ min: 1 })
    .withMessage('ID thông tin tham gia thi không hợp lệ')
];

/**
 * Validation cho đổi mật khẩu
 */
export const validateChangePassword: ValidationChain[] = [
  body('current_password')
    .notEmpty()
    .withMessage('Mật khẩu hiện tại không được để trống'),
  
  body('new_password')
    .isLength({ min: 6, max: 50 })
    .withMessage('Mật khẩu mới phải từ 6-50 ký tự'),
  
  body('confirm_password')
    .custom((value, { req }) => {
      if (value !== req.body.new_password) {
        throw new Error('Xác nhận mật khẩu không khớp');
      }
      return true;
    })
];

/**
 * Sanitization helpers
 */
export function sanitizeString(str: string): string {
  return str.trim().replace(/\s+/g, ' ');
}

export function sanitizeStudentCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Custom validation cho exam status
 */
export const validateExamStatus: ValidationChain[] = [
  body('status')
    .isIn(['waiting', 'in_progress', 'completed'])
    .withMessage('Trạng thái thi không hợp lệ')
];

/**
 * Middleware kết hợp validation và error handling
 */
export function validate(validations: ValidationChain[]) {
  return [...validations, handleValidationErrors];
}
