// Main server application

import express, { Application, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import { Server } from 'socket.io';
import http from 'http';
import https from 'https';
import path from 'path';
import fs from 'fs';

// Config and database
import { config, validateConfig, isDev } from './config/config';
import { setupDatabase, closeDatabase } from './config/database';

// Middleware
import { checkSessionTimeout, logUserActivity } from './middleware/auth';

// Routes
import authRoutes from './routes/auth';
import studentRoutes from './routes/student';
import supervisorRoutes from './routes/supervisor';
import systemRoutes from './routes/system';

// Types
import { ApiResponse, HttpStatus, ResponseMessages } from './types/index';
import { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  InterServerEvents, 
  SocketData,
  SocketRooms 
} from './types/socket';

class ExamSystemServer {
  private app: Application;
  private server: http.Server | https.Server;
  private io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  private useHttps: boolean = false;

  constructor() {
    this.app = express();
    
    // Kiểm tra xem có SSL certificate không
    const keyPath = path.join(process.cwd(), 'certs', 'server.key');
    const certPath = path.join(process.cwd(), 'certs', 'server.crt');
    
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      // Sử dụng HTTPS nếu có certificate
      const sslOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };
      this.server = https.createServer(sslOptions, this.app);
      this.useHttps = true;
      console.log('✅ HTTPS enabled với SSL certificate');
    } else {
      // Fallback về HTTP
      this.server = http.createServer(this.app);
      console.log('⚠️ Chạy HTTP mode - Certificate không tìm thấy');
    }
    
    this.io = new Server(this.server, {
      cors: {
        origin: "*", // Có thể config chặt chẽ hơn trong production
        methods: ["GET", "POST"]
      }
    });
  }

  /**
   * Khởi tạo middleware
   */
  private initializeMiddleware(): void {
    // Trust proxy nếu chạy behind reverse proxy
    this.app.set('trust proxy', 1);

    // Parse JSON và URL encoded
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Session middleware
    this.app.use(session({
      secret: config.session.secret,
      resave: config.session.resave,
      saveUninitialized: config.session.saveUninitialized,
      cookie: {
        secure: !isDev(), // HTTPS only in production
        httpOnly: true,
        maxAge: config.session.maxAge
      }
    }));

    // Security middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      // CORS headers
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      // Security headers
      res.header('X-Frame-Options', 'DENY');
      res.header('X-XSS-Protection', '1; mode=block');
      res.header('X-Content-Type-Options', 'nosniff');
      
      next();
    });

    // Custom middleware
    this.app.use(checkSessionTimeout);
    
    // Logging middleware (chỉ trong development)
    if (isDev()) {
      this.app.use(logUserActivity);
    }
  }

  /**
   * Khởi tạo static files
   */
  private initializeStaticFiles(): void {
    // Serve static files from public directory at root path
    this.app.use(express.static(path.join(process.cwd(), 'public')));
    
    // Also serve from /public path for compatibility
    this.app.use('/public', express.static(path.join(process.cwd(), 'public')));
    
    // Ensure upload directories exist
    const directories = [
      config.upload.audioPath,
      config.upload.tempPath
    ];

    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    });
  }

  /**
   * Khởi tạo routes
   */
  private initializeRoutes(): void {
    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/student', studentRoutes);
    this.app.use('/api/supervisor', supervisorRoutes);
    this.app.use('/api/system', systemRoutes);

    // Root endpoint - serve index.html for web requests
    this.app.get('/', (req: Request, res: Response) => {
      // Check if it's an API request (Accept: application/json)
      const acceptHeader = req.get('Accept') || '';
      if (acceptHeader.includes('application/json')) {
        const response: ApiResponse = {
          success: true,
          message: 'Exam System API Server',
          data: {
            version: '1.0.0',
            status: 'running',
            timestamp: new Date().toISOString()
          }
        };
        res.json(response);
      } else {
        // Serve the main HTML page
        res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
      }
    });

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.NOT_FOUND,
        error: `Endpoint không tồn tại: ${req.method} ${req.originalUrl}`
      };
      res.status(HttpStatus.NOT_FOUND).json(response);
    });
  }

  /**
   * Khởi tạo error handlers
   */
  private initializeErrorHandlers(): void {
    // Error handler
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Unhandled error:', error);
      
      const response: ApiResponse = {
        success: false,
        message: ResponseMessages.ERROR,
        error: isDev() ? error.message : 'Internal server error'
      };
      
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response);
    });
  }

  /**
   * Khởi tạo Socket.IO
   */
  private initializeSocketIO(): void {
    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);

      // Authentication event
      socket.on('authenticate', (data) => {
        try {
          // TODO: Implement proper socket authentication
          // For now, just acknowledge
          socket.emit('authenticated', { success: true });
          console.log(`Socket ${socket.id} authenticated`);
        } catch (error) {
          socket.emit('authenticated', { success: false });
          console.error(`Socket ${socket.id} authentication failed:`, error);
        }
      });

      // Student joins exam
      socket.on('join_exam', (data) => {
        try {
          const { examId, studentId } = data;
          
          // Join exam room
          socket.join(SocketRooms.EXAM(examId));
          socket.join(SocketRooms.STUDENT(studentId));
          
          console.log(`Student ${studentId} joined exam ${examId}`);
          
          // Notify supervisors
          socket.to(SocketRooms.SUPERVISOR(examId)).emit('student_joined', {
            examId,
            student: {
              id: studentId,
              studentCode: '', // TODO: Get from database
              fullName: '',   // TODO: Get from database
              questionNumber: 0, // TODO: Get from database
              status: 'waiting'
            }
          });
        } catch (error) {
          console.error('Join exam error:', error);
          socket.emit('error', { message: 'Lỗi tham gia kỳ thi' });
        }
      });

      // Start exam
      socket.on('start_exam', (data) => {
        try {
          const { examParticipantId } = data;
          
          // TODO: Update database status to 'in_progress'
          // TODO: Start timer
          
          socket.emit('exam_start', {
            examParticipantId,
            examDuration: 300 // TODO: Get from database
          });
          
          console.log(`Exam started for participant ${examParticipantId}`);
        } catch (error) {
          console.error('Start exam error:', error);
          socket.emit('error', { message: 'Lỗi bắt đầu bài thi' });
        }
      });

      // Submit exam
      socket.on('submit_exam', (data) => {
        try {
          const { examParticipantId } = data;
          
          // TODO: Update database status to 'completed'
          
          socket.emit('exam_status_update', {
            examParticipantId,
            status: 'completed'
          });
          
          console.log(`Exam submitted for participant ${examParticipantId}`);
        } catch (error) {
          console.error('Submit exam error:', error);
          socket.emit('error', { message: 'Lỗi nộp bài thi' });
        }
      });

      // Audio recording events
      socket.on('start_recording', (data) => {
        try {
          const { examParticipantId } = data;
          
          socket.emit('recording_started', { examParticipantId });
          console.log(`Recording started for participant ${examParticipantId}`);
        } catch (error) {
          console.error('Start recording error:', error);
          socket.emit('recording_error', { 
            examParticipantId: data.examParticipantId, 
            error: 'Lỗi bắt đầu ghi âm' 
          });
        }
      });

      socket.on('stop_recording', (data) => {
        try {
          const { examParticipantId } = data;
          
          socket.emit('recording_stopped', { examParticipantId });
          console.log(`Recording stopped for participant ${examParticipantId}`);
        } catch (error) {
          console.error('Stop recording error:', error);
          socket.emit('recording_error', { 
            examParticipantId: data.examParticipantId, 
            error: 'Lỗi dừng ghi âm' 
          });
        }
      });

      // Handle audio chunks (for real-time streaming if needed)
      socket.on('audio_chunk', (data) => {
        // TODO: Handle real-time audio streaming if required
        console.log(`Received audio chunk for participant ${data.examParticipantId}`);
      });

      // Ping/Pong for connection health
      socket.on('ping', () => {
        socket.emit('pong');
      });

      // Disconnect handler
      socket.on('disconnect', (reason) => {
        console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
      });
    });
  }

  /**
   * Khởi tạo server
   */
  async initialize(): Promise<void> {
    try {
      // Validate config
      validateConfig();
      console.log('Configuration validated successfully');

      // Setup database
      await setupDatabase();
      console.log('Database setup completed');

      // Initialize middleware
      this.initializeMiddleware();
      console.log('Middleware initialized');

      // Initialize static files
      this.initializeStaticFiles();
      console.log('Static files configured');

      // Initialize routes
      this.initializeRoutes();
      console.log('Routes initialized');

      // Initialize error handlers
      this.initializeErrorHandlers();
      console.log('Error handlers initialized');

      // Initialize Socket.IO
      this.initializeSocketIO();
      console.log('Socket.IO initialized');

      console.log('Server initialization completed successfully');
    } catch (error) {
      console.error('Server initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start server
   */
  start(): void {
    this.server.listen(config.port, config.host, () => {
      const protocol = this.useHttps ? 'https' : 'http';
      const securityBadge = this.useHttps ? '🔒 HTTPS' : '🔓 HTTP';
      
      console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                            EXAM SYSTEM SERVER                                ║
║                                                                               ║
║  Server running on: ${protocol}://${config.host}:${config.port}                      ║
║  Security: ${securityBadge}                                                   ║
║  Environment: ${process.env.NODE_ENV || 'development'}                        ║
║  Database: ${config.database.filename}                                       ║
║                                                                               ║
║  API Endpoints:                                                               ║
║  - Auth: ${protocol}://${config.host}:${config.port}/api/auth                       ║
║  - Student: ${protocol}://${config.host}:${config.port}/api/student                 ║
║  - Supervisor: ${protocol}://${config.host}:${config.port}/api/supervisor           ║
║  - System: ${protocol}://${config.host}:${config.port}/api/system                   ║
║                                                                               ║
║  LAN Access: ${protocol}://192.168.21.107:${config.port}                     ║
║  Socket.IO: Enabled                                                           ║
║  Audio Processing: Enabled                                                    ║
║  Excel Import/Export: Enabled                                                 ║
║  Microphone Access: ${this.useHttps ? '✅ Enabled (HTTPS)' : '❌ Blocked (HTTP only)'}  ║
╚═══════════════════════════════════════════════════════════════════════════════╝
      `);
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down server...');
    
    try {
      // Close Socket.IO
      this.io.close();
      console.log('Socket.IO closed');

      // Close HTTP server
      await new Promise<void>((resolve, reject) => {
        this.server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('HTTP server closed');

      // Close database
      await closeDatabase();
      console.log('Database connection closed');

      console.log('Server shutdown completed');
    } catch (error) {
      console.error('Error during shutdown:', error);
      throw error;
    }
  }
}

// Create and start server
const server = new ExamSystemServer();

// Initialize and start
(async () => {
  try {
    await server.initialize();
    server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT signal');
  try {
    await server.shutdown();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM signal');
  try {
    await server.shutdown();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default server;
