// Shared types cho exam system

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// User roles
export type UserRole = 'student' | 'supervisor';

// Exam status
export type ExamStatus = 'waiting' | 'in_progress' | 'completed';

// Audio format
export type AudioFormat = 'webm' | 'mp3';

// Common response messages
export const ResponseMessages = {
  SUCCESS: 'Thành công',
  ERROR: 'Có lỗi xảy ra',
  UNAUTHORIZED: 'Không có quyền truy cập',
  FORBIDDEN: 'Không có quyền thực hiện',
  NOT_FOUND: 'Không tìm thấy',
  VALIDATION_ERROR: 'Dữ liệu không hợp lệ',
  DUPLICATE_ERROR: 'Dữ liệu đã tồn tại',
  EXAM_IN_PROGRESS: 'Bài thi đang diễn ra',
  EXAM_COMPLETED: 'Bài thi đã hoàn thành',
  EXAM_NOT_STARTED: 'Bài thi chưa bắt đầu'
} as const;

// HTTP Status codes
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500
} as const;

// File upload constraints
export const FileConstraints = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_AUDIO_FORMATS: ['audio/webm', 'audio/mp3', 'audio/wav'],
  ALLOWED_EXCEL_FORMATS: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
} as const;
