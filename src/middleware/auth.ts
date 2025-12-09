// Authentication middleware

import { Request, Response, NextFunction } from 'express';
import { ApiResponse, HttpStatus, ResponseMessages } from '../types/index';

// Extend Request interface để thêm user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        role: 'student' | 'supervisor';
        student_code?: string;
        username?: string;
        full_name?: string;
      };
    }
  }
}

/**
 * Middleware kiểm tra authentication chung
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session || !req.session.user) {
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.UNAUTHORIZED,
      error: 'Vui lòng đăng nhập để tiếp tục'
    };
    res.status(HttpStatus.UNAUTHORIZED).json(response);
    return;
  }

  // Thêm user info vào request
  req.user = req.session.user;
  next();
}

/**
 * Middleware kiểm tra quyền học sinh
 */
export function requireStudent(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'student') {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.FORBIDDEN,
        error: 'Chỉ học sinh mới có thể truy cập'
      };
      res.status(HttpStatus.FORBIDDEN).json(response);
      return;
    }
    next();
  });
}

/**
 * Middleware kiểm tra quyền giám thị
 */
export function requireSupervisor(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'supervisor') {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.FORBIDDEN,
        error: 'Chỉ giám thị mới có thể truy cập'
      };
      res.status(HttpStatus.FORBIDDEN).json(response);
      return;
    }
    next();
  });
}

/**
 * Middleware cho phép cả học sinh và giám thị
 */
export function requireAnyUser(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.user || !['student', 'supervisor'].includes(req.user.role)) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.FORBIDDEN,
        error: 'Không có quyền truy cập'
      };
      res.status(HttpStatus.FORBIDDEN).json(response);
      return;
    }
    next();
  });
}

/**
 * Middleware kiểm tra học sinh có thể truy cập resource của chính mình
 */
export function requireOwnStudent(req: Request, res: Response, next: NextFunction): void {
  requireStudent(req, res, () => {
    const studentId = parseInt(req.params.studentId || req.params.id);
    
    if (isNaN(studentId) || studentId !== req.user!.id) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.FORBIDDEN,
        error: 'Chỉ có thể truy cập thông tin của chính mình'
      };
      res.status(HttpStatus.FORBIDDEN).json(response);
      return;
    }
    next();
  });
}

/**
 * Middleware optional auth - không bắt buộc đăng nhập
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session && req.session.user) {
    req.user = req.session.user;
  }
  next();
}

/**
 * Middleware kiểm tra session timeout
 */
export function checkSessionTimeout(req: Request, res: Response, next: NextFunction): void {
  if (req.session && req.session.user) {
    const now = Date.now();
    const lastActivity = req.session.lastActivity || now;
    const timeout = 7 * 24 * 60 * 60 * 1000; // 7 days (1 week) in milliseconds

    if (now - lastActivity > timeout) {
      // Session timeout
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
      });

      const response: ApiResponse = {
        success: false,
        message: 'Phiên đăng nhập đã hết hạn',
        error: 'SESSION_TIMEOUT'
      };
      res.status(HttpStatus.UNAUTHORIZED).json(response);
      return;
    }

    // Update last activity
    req.session.lastActivity = now;
  }

  next();
}

/**
 * Helper function để tạo session cho user
 */
export function createUserSession(
  req: Request, 
  user: { id: number; role: 'student' | 'supervisor'; student_code?: string; username?: string; full_name?: string }
): void {
  req.session.user = user;
  req.session.lastActivity = Date.now();
}

/**
 * Helper function để xóa session
 */
export function destroyUserSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!req.session) {
      resolve();
      return;
    }

    req.session.destroy((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

/**
 * Middleware log user activity
 */
export function logUserActivity(req: Request, res: Response, next: NextFunction): void {
  if (req.user) {
    console.log(`[${new Date().toISOString()}] ${req.user.role}(${req.user.id}) ${req.method} ${req.originalUrl}`);
  }
  next();
}

// Extend session interface
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      role: 'student' | 'supervisor';
      student_code?: string;
      full_name?: string;
    };
    lastActivity?: number;
  }
}
