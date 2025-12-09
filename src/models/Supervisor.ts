// Supervisor model
import Database from 'better-sqlite3';
import { getDatabase, runQuery, getRow, getAllRows } from '../config/database';

export interface SupervisorData {
  id?: number;
  username: string;
  full_name: string;
  password: string;
  is_active?: boolean;
  created_at?: string;
}

export interface SupervisorLoginRequest {
  username: string;
  password: string;
}

export class SupervisorModel {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Đăng nhập supervisor
   */
  async login(credentials: SupervisorLoginRequest): Promise<SupervisorData | null> {
    try {
      const { username, password } = credentials;
      
      const supervisor = await getRow(
        this.db,
        `SELECT id, username, full_name, is_active, created_at 
         FROM supervisors 
         WHERE username = ? AND password = ? AND is_active = 1`,
        [username, password]
      );

      return supervisor || null;
    } catch (error) {
      console.error('Error in supervisor login:', error);
      throw error;
    }
  }

  /**
   * Tạo supervisor mới
   */
  async create(supervisorData: SupervisorData): Promise<number> {
    try {
      const { username, full_name, password, is_active = true } = supervisorData;
      
      const result = await runQuery(
        this.db,
        `INSERT INTO supervisors (username, full_name, password, is_active) 
         VALUES (?, ?, ?, ?)`,
        [username, full_name, password, is_active ? 1 : 0]
      );

      return result.id;
    } catch (error) {
      console.error('Error creating supervisor:', error);
      throw error;
    }
  }

  /**
   * Lấy supervisor theo username
   */
  async getByUsername(username: string): Promise<SupervisorData | null> {
    try {
      const supervisor = await getRow(
        this.db,
        `SELECT id, username, full_name, is_active, created_at 
         FROM supervisors 
         WHERE username = ?`,
        [username]
      );

      return supervisor || null;
    } catch (error) {
      console.error('Error getting supervisor by username:', error);
      throw error;
    }
  }

  /**
   * Lấy tất cả supervisors
   */
  async getAll(): Promise<SupervisorData[]> {
    try {
      const supervisors = await getAllRows(
        this.db,
        `SELECT id, username, full_name, is_active, created_at 
         FROM supervisors 
         ORDER BY created_at DESC`
      );

      return supervisors;
    } catch (error) {
      console.error('Error getting all supervisors:', error);
      throw error;
    }
  }

  /**
   * Cập nhật mật khẩu supervisor
   */
  async updatePassword(id: number, newPassword: string): Promise<boolean> {
    try {
      const result = await runQuery(
        this.db,
        `UPDATE supervisors SET password = ? WHERE id = ?`,
        [newPassword, id]
      );

      return result.changes > 0;
    } catch (error) {
      console.error('Error updating supervisor password:', error);
      throw error;
    }
  }

  /**
   * Kích hoạt/vô hiệu hóa supervisor
   */
  async updateStatus(id: number, isActive: boolean): Promise<boolean> {
    try {
      const result = await runQuery(
        this.db,
        `UPDATE supervisors SET is_active = ? WHERE id = ?`,
        [isActive ? 1 : 0, id]
      );

      return result.changes > 0;
    } catch (error) {
      console.error('Error updating supervisor status:', error);
      throw error;
    }
  }
}
