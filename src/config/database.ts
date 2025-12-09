// Database configuration và schema setup

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config, getDatabasePath } from './config';

let dbInstance: Database.Database | null = null;

// SQL Schema definitions
const CREATE_TABLES_SQL = {
  students: `
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_code VARCHAR(20) UNIQUE NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      password VARCHAR(50) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  supervisors: `
    CREATE TABLE IF NOT EXISTS supervisors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username VARCHAR(50) UNIQUE NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      password VARCHAR(255) NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  exams: `
    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_name VARCHAR(100) NOT NULL,
      preparation_time INTEGER NOT NULL DEFAULT 60,
      exam_duration INTEGER NOT NULL DEFAULT 300,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,

  exam_questions: `
    CREATE TABLE IF NOT EXISTS exam_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL,
      question_code VARCHAR(50) NOT NULL,
      pdf_drive_url TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
      UNIQUE(exam_id, question_code)
    )
  `,

  exam_participants: `
    CREATE TABLE IF NOT EXISTS exam_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      question_id INTEGER,
      status TEXT CHECK(status IN ('waiting', 'in_progress', 'completed')) DEFAULT 'waiting',
      audio_file_path VARCHAR(255),
      start_time DATETIME,
      submit_time DATETIME,
      FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES exam_questions(id) ON DELETE SET NULL,
      UNIQUE(exam_id, student_id)
    )
  `
};

// Indexes for better performance
const CREATE_INDEXES_SQL = [
  'CREATE INDEX IF NOT EXISTS idx_students_code ON students(student_code)',
  'CREATE INDEX IF NOT EXISTS idx_supervisors_username ON supervisors(username)',
  'CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON exam_questions(exam_id)',
  'CREATE INDEX IF NOT EXISTS idx_exam_questions_code ON exam_questions(question_code)',
  'CREATE INDEX IF NOT EXISTS idx_exam_participants_exam ON exam_participants(exam_id)',
  'CREATE INDEX IF NOT EXISTS idx_exam_participants_student ON exam_participants(student_id)',
  'CREATE INDEX IF NOT EXISTS idx_exam_participants_question ON exam_participants(question_id)',
  'CREATE INDEX IF NOT EXISTS idx_exam_participants_status ON exam_participants(status)'
];

/**
 * Khởi tạo database connection
 */
export function initializeDatabase(): Promise<Database.Database> {
  return new Promise((resolve, reject) => {
    try {
      // Đảm bảo thư mục database tồn tại
      const dbDir = config.database.path;
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      const dbPath = getDatabasePath();
      console.log(`Kết nối database: ${dbPath}`);

      const db = new Database(dbPath);
      console.log('Kết nối SQLite database thành công');
      
      dbInstance = db;
      
      // Kích hoạt foreign keys
      db.pragma('foreign_keys = ON');
      
      resolve(db);

    } catch (error) {
      console.error('Lỗi khởi tạo database:', error);
      reject(error);
    }
  });
}

/**
 * Tạo tables và indexes
 */
export function createTables(db: Database.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const tableNames = Object.keys(CREATE_TABLES_SQL);
      
      // Tạo từng table
      tableNames.forEach(tableName => {
        const sql = CREATE_TABLES_SQL[tableName as keyof typeof CREATE_TABLES_SQL];
        db.exec(sql);
        console.log(`Tạo table ${tableName} thành công`);
      });
      
      createIndexes(db)
        .then(() => {
          console.log('Tạo tables và indexes thành công');
          resolve();
        })
        .catch(reject);
        
    } catch (error) {
      console.error('Lỗi tạo tables:', error);
      reject(error);
    }
  });
}

/**
 * Tạo indexes
 */
function createIndexes(db: Database.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      CREATE_INDEXES_SQL.forEach(sql => {
        db.exec(sql);
      });
      resolve();
    } catch (error) {
      console.error('Lỗi tạo index:', error);
      reject(error);
    }
  });
}

/**
 * Lấy database instance
 */
export function getDatabase(): Database.Database {
  if (!dbInstance) {
    throw new Error('Database chưa được khởi tạo. Gọi initializeDatabase() trước.');
  }
  return dbInstance;
}

/**
 * Đóng database connection
 */
export function closeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (!dbInstance) {
        resolve();
        return;
      }

      dbInstance.close();
      console.log('Đóng database connection thành công');
      dbInstance = null;
      resolve();
    } catch (error) {
      console.error('Lỗi đóng database:', error);
      reject(error);
    }
  });
}

/**
 * Setup database - khởi tạo và tạo tables
 */
export async function setupDatabase(): Promise<Database.Database> {
  try {
    const db = await initializeDatabase();
    await createTables(db);
    return db;
  } catch (error) {
    console.error('Lỗi setup database:', error);
    throw error;
  }
}

/**
 * Helper function để chạy SQL với Promise
 */
export function runQuery(db: Database.Database, sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const result = stmt.run(params);
      resolve({ id: result.lastInsertRowid, changes: result.changes });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Helper function để lấy một row
 */
export function getRow(db: Database.Database, sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const row = stmt.get(params);
      resolve(row);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Helper function để lấy nhiều rows
 */
export function getAllRows(db: Database.Database, sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const rows = stmt.all(params);
      resolve(rows || []);
    } catch (error) {
      reject(error);
    }
  });
}
