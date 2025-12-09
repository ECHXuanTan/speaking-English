// Database model types

import { ExamStatus, PaginationParams, PaginatedResponse } from './index';

export { ExamStatus, PaginationParams, PaginatedResponse };

// Student model
export interface Student {
  id: number;
  student_code: string;
  full_name: string;
  password: string;
  created_at: Date;
}

// Create student DTO (Data Transfer Object)
export interface CreateStudentDto {
  student_code: string;
  full_name: string;
  password?: string; // Optional vì có thể auto-generate
}

// Update student DTO
export interface UpdateStudentDto {
  student_code?: string;
  full_name?: string;
  password?: string;
}

// Student login DTO
export interface StudentLoginDto {
  student_code: string;
  password: string;
}

// Exam model
export interface Exam {
  id: number;
  exam_name: string;
  preparation_time: number; // seconds
  exam_duration: number;    // seconds
  created_at: Date;
}

// Create exam DTO
export interface CreateExamDto {
  exam_name: string;
  preparation_time: number;
  exam_duration: number;
}

// Update exam DTO
export interface UpdateExamDto {
  exam_name?: string;
  preparation_time?: number;
  exam_duration?: number;
}

// ExamQuestion model (Đề thi)
export interface ExamQuestion {
  id: number;
  exam_id: number;
  question_code: string;    // Mã đề (VD: DE001, DE002)
  pdf_drive_url: string;    // Link Google Drive nhúng PDF
  is_active: boolean;       // Đề có đang hoạt động không
  created_at: Date;
}

// Create exam question DTO
export interface CreateExamQuestionDto {
  exam_id: number;
  question_code: string;
  pdf_drive_url: string;
  is_active?: boolean;
}

// Update exam question DTO
export interface UpdateExamQuestionDto {
  question_code?: string;
  pdf_drive_url?: string;
  is_active?: boolean;
}

// ExamQuestion with exam info
export interface ExamQuestionWithExam extends ExamQuestion {
  exam: Exam;
}

// ExamParticipant model
export interface ExamParticipant {
  id: number;
  exam_id: number;
  student_id: number;
  question_id?: number;      // ID của đề thi được random
  status: ExamStatus;
  audio_file_path?: string;
  start_time?: Date;
  submit_time?: Date;
}

// Create exam participant DTO
export interface CreateExamParticipantDto {
  exam_id: number;
  student_id: number;
  question_id?: number; // Sẽ được random tự động nếu không có
}

// Update exam participant DTO
export interface UpdateExamParticipantDto {
  question_id?: number;
  status?: ExamStatus;
  audio_file_path?: string;
  start_time?: Date;
  submit_time?: Date;
}

// Extended types với join data
export interface ExamParticipantWithDetails extends ExamParticipant {
  student: Student;
  exam: Exam;
  question?: ExamQuestion;   // Thông tin đề thi được random
}

export interface StudentWithExamInfo extends Student {
  exam_participant?: ExamParticipant;
  exam?: Exam;
}

// Excel import types
export interface ExcelStudentRow {
  'Mã học sinh': string;
  'Họ và tên': string;
  'Mật khẩu'?: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
}

// Audio processing types
export interface AudioProcessingResult {
  success: boolean;
  originalPath: string;
  convertedPath?: string;
  duration?: number;
  format?: string;
  error?: string;
  warning?: string;
}

// Statistics types
export interface ExamStatistics {
  total_participants: number;
  waiting: number;
  in_progress: number;
  completed: number;
  completion_rate: number;
  average_duration?: number;
}

// Exam monitoring data
export interface ExamMonitoringData {
  exam: Exam;
  participants: Array<{
    id: number;
    student: Student;
    status: ExamStatus;
    question?: ExamQuestion;  // Thông tin đề thi
    audio_file_path?: string;
    start_time?: Date;
    submit_time?: Date;
    duration?: number;
  }>;
  statistics: ExamStatistics;
}
