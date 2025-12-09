// Application configuration

import path from 'path';

interface AppConfig {
  // Server config
  port: number;
  host: string;
  
  // Database config
  database: {
    path: string;
    filename: string;
  };
  
  // Session config
  session: {
    secret: string;
    maxAge: number; // milliseconds
    resave: boolean;
    saveUninitialized: boolean;
  };
  
  // File upload config
  upload: {
    maxFileSize: number; // bytes
    audioFormats: string[];
    excelFormats: string[];
    audioPath: string;
    tempPath: string;
  };
  
  // Audio processing config
  audio: {
    outputFormat: 'mp3' | 'wav';
    bitrate: string;
    sampleRate: number;
    volumeBoost: number; // Volume multiplier (1.0 = no change, 2.0 = double volume)
  };
  
  // Exam config
  exam: {
    defaultPreparationTime: number; // seconds
    defaultExamDuration: number;    // seconds
    maxQuestions: number;
    autoSubmitDelay: number;        // seconds after time up
  };
  
  // Security config
  security: {
    passwordMinLength: number;
    sessionTimeout: number; // minutes
    maxLoginAttempts: number;
  };
}

const isDevelopment = process.env.NODE_ENV !== 'production';

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  
  database: {
    path: path.join(process.cwd(), 'database'),
    filename: process.env.DB_NAME || 'exam_system.db'
  },
  
  session: {
    secret: process.env.SESSION_SECRET || 'exam-system-secret-key-2024',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (1 week)
    resave: false,
    saveUninitialized: false
  },
  
  upload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    audioFormats: ['.webm', '.mp3', '.wav'],
    excelFormats: ['.xlsx', '.xls'],
    audioPath: path.join(process.cwd(), 'uploads', 'audio'),
    tempPath: path.join(process.cwd(), 'uploads', 'temp')
  },
  
  audio: {
    outputFormat: 'mp3',
    bitrate: '128k',
    sampleRate: 44100,
    volumeBoost: 2.0  // Tăng âm lượng gấp đôi
  },
  
  exam: {
    defaultPreparationTime: 60,     // 1 minute
    defaultExamDuration: 300,       // 5 minutes
    maxQuestions: 100,
    autoSubmitDelay: 5              // 5 seconds
  },
  
  security: {
    passwordMinLength: 6,
    sessionTimeout: 7 * 24 * 60,    // 7 days (1 week) in minutes
    maxLoginAttempts: 5
  }
};

// Validate required environment variables
export function validateConfig(): void {
  const requiredEnvVars = [];
  
  if (!isDevelopment) {
    requiredEnvVars.push('SESSION_SECRET');
  }
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

// Helper functions
export function getDatabasePath(): string {
  return path.join(config.database.path, config.database.filename);
}

export function getAudioUploadPath(): string {
  return config.upload.audioPath;
}

export function getTempUploadPath(): string {
  return config.upload.tempPath;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isDev(): boolean {
  return !isProduction();
}
