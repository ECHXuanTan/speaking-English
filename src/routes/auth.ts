// Authentication routes

import { Router, Request, Response } from 'express';
import { StudentModel } from '../models/Student';
import { SupervisorModel } from '../models/Supervisor';
import { createUserSession, destroyUserSession, optionalAuth } from '../middleware/auth';
import { validate, validateStudentLogin } from '../middleware/validation';
import { ApiResponse, HttpStatus, ResponseMessages } from '../types/index';

const router = Router();

/**
 * POST /api/auth/login
 * Đăng nhập học sinh
 */
router.post('/login', validate(validateStudentLogin), async (req: Request, res: Response) => {
  try {
    const { student_code, password } = req.body;

    // Xác thực học sinh
    const studentModel = new StudentModel();
    const student = await studentModel.login({ student_code, password });
    
    if (!student) {
      const response: ApiResponse = {
        success: false,
        message: 'Đăng nhập thất bại',
        error: 'Mã học sinh hoặc mật khẩu không đúng'
      };
      res.status(HttpStatus.UNAUTHORIZED).json(response);
      return;
    }

    // Tạo session
    createUserSession(req, {
      id: student.id,
      role: 'student',
      student_code: student.student_code,
      full_name: student.full_name
    });

    const response: ApiResponse = {
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        user: {
          id: student.id,
          student_code: student.student_code,
          full_name: student.full_name,
          role: 'student'
        }
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Login error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * POST /api/auth/supervisor-login  
 * Đăng nhập giám thị
 */
router.post('/supervisor-login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      const response: ApiResponse = {
        success: false,
        message: 'Đăng nhập thất bại',
        error: 'Vui lòng nhập đầy đủ thông tin'
      };
      res.status(HttpStatus.BAD_REQUEST).json(response);
      return;
    }

    // Xác thực supervisor từ database
    const supervisorModel = new SupervisorModel();
    const supervisor = await supervisorModel.login({ username, password });
    
    if (!supervisor) {
      const response: ApiResponse = {
        success: false,
        message: 'Đăng nhập thất bại',
        error: 'Tên đăng nhập hoặc mật khẩu không đúng'
      };
      res.status(HttpStatus.UNAUTHORIZED).json(response);
      return;
    }

    // Tạo session cho supervisor
    createUserSession(req, {
      id: supervisor.id!,
      role: 'supervisor',
      username: supervisor.username,
      full_name: supervisor.full_name
    });

    const response: ApiResponse = {
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        user: {
          id: supervisor.id,
          username: supervisor.username,
          role: 'supervisor',
          full_name: supervisor.full_name
        }
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Supervisor login error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * POST /api/auth/logout
 * Đăng xuất
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    await destroyUserSession(req);
    
    const response: ApiResponse = {
      success: true,
      message: 'Đăng xuất thành công'
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Logout error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * GET /api/auth/me
 * Lấy thông tin user hiện tại
 */
router.get('/me', optionalAuth, (req: Request, res: Response) => {
  try {
    if (!req.user) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.UNAUTHORIZED,
        error: 'Chưa đăng nhập'
      };
      res.status(HttpStatus.UNAUTHORIZED).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: ResponseMessages.SUCCESS,
      data: {
        user: req.user
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Get user info error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * GET /api/auth/check
 * Kiểm tra trạng thái đăng nhập
 */
router.get('/check', optionalAuth, (req: Request, res: Response) => {
  try {
    const isAuthenticated = !!req.user;
    
    const response: ApiResponse = {
      success: true,
      message: ResponseMessages.SUCCESS,
      data: {
        isAuthenticated,
        user: req.user || null
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Auth check error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

/**
 * POST /api/auth/refresh
 * Refresh session (extend session time)
 */
router.post('/refresh', optionalAuth, (req: Request, res: Response) => {
  try {
    if (!req.user || !req.session) {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.UNAUTHORIZED,
        error: 'Phiên đăng nhập không hợp lệ'
      };
      res.status(HttpStatus.UNAUTHORIZED).json(response);
      return;
    }

    // Update session activity time
    req.session.lastActivity = Date.now();
    
    const response: ApiResponse = {
      success: true,
      message: 'Phiên đăng nhập đã được gia hạn',
      data: {
        user: req.user
      }
    };

    res.status(HttpStatus.OK).json(response);
  } catch (error: any) {
    console.error('Session refresh error:', error);
    const response: ApiResponse = {
      success: false,
      message: ResponseMessages.ERROR,
      error: error.message
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
  }
});

export default router;
