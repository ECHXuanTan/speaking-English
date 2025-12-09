// Socket.io event types

import { ExamStatus } from './index';

// Client to Server events
export interface ClientToServerEvents {
  // Kết nối và authentication
  authenticate: (data: { token: string }) => void;
  
  // Exam events từ student
  join_exam: (data: { examId: number; studentId: number }) => void;
  start_exam: (data: { examParticipantId: number }) => void;
  submit_exam: (data: { examParticipantId: number }) => void;
  
  // Audio events
  start_recording: (data: { examParticipantId: number }) => void;
  stop_recording: (data: { examParticipantId: number }) => void;
  audio_chunk: (data: { examParticipantId: number; audioData: ArrayBuffer }) => void;
  
  // Heartbeat/ping
  ping: () => void;
}

// Server to Client events
export interface ServerToClientEvents {
  // Authentication response
  authenticated: (data: { success: boolean; user?: any }) => void;
  
  // Exam status updates
  exam_status_update: (data: {
    examParticipantId: number;
    status: ExamStatus;
    timeRemaining?: number;
  }) => void;
  
  // Timer events
  preparation_start: (data: { examParticipantId: number; preparationTime: number }) => void;
  exam_start: (data: { examParticipantId: number; examDuration: number }) => void;
  time_warning: (data: { examParticipantId: number; timeRemaining: number }) => void;
  auto_submit: (data: { examParticipantId: number; reason: string }) => void;
  
  // Recording events
  recording_started: (data: { examParticipantId: number }) => void;
  recording_stopped: (data: { examParticipantId: number; audioFile?: string }) => void;
  recording_error: (data: { examParticipantId: number; error: string }) => void;
  
  // Supervisor monitoring events
  student_joined: (data: { 
    examId: number; 
    student: { 
      id: number; 
      studentCode: string; 
      fullName: string; 
      questionNumber: number;
      status: ExamStatus;
    } 
  }) => void;
  
  student_status_changed: (data: {
    examId: number;
    studentId: number;
    status: ExamStatus;
    submissionTime?: Date;
  }) => void;
  
  // Error events
  error: (data: { message: string; code?: string }) => void;
  
  // Heartbeat response
  pong: () => void;
}

// Inter-server events (không cần trong single instance)
export interface InterServerEvents {}

// Socket data cho authentication
export interface SocketData {
  userId: number;
  userRole: 'student' | 'supervisor';
  examId?: number;
  examParticipantId?: number;
}

// Room naming conventions
export const SocketRooms = {
  EXAM: (examId: number) => `exam_${examId}`,
  SUPERVISOR: (examId: number) => `supervisor_${examId}`,
  STUDENT: (studentId: number) => `student_${studentId}`
} as const;

// Socket events constants
export const SocketEvents = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error'
} as const;
