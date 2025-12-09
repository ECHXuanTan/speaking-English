// Excel processing utilities

import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { 
  ExcelStudentRow, 
  ImportResult, 
  Student, 
  CreateStudentDto,
  ExamParticipantWithDetails 
} from '../types/models';

/**
 * Truncate tên sheet để không vượt quá giới hạn 31 ký tự của Excel
 */
function truncateSheetName(prefix: string, name: string, maxLength: number = 31): string {
  const fullName = `${prefix}${name}`;
  
  if (fullName.length <= maxLength) {
    return fullName;
  }
  
  // Tính toán độ dài tối đa cho name
  const maxNameLength = maxLength - prefix.length;
  
  if (maxNameLength <= 0) {
    // Nếu prefix quá dài, chỉ lấy prefix
    return prefix.substring(0, maxLength);
  }
  
  // Cắt name và thêm "..." nếu cần
  if (maxNameLength <= 3) {
    return `${prefix}${name.substring(0, maxNameLength)}`;
  } else {
    return `${prefix}${name.substring(0, maxNameLength - 3)}...`;
  }
}

/**
 * Đọc file Excel và parse students data
 */
export async function parseStudentExcel(filePath: string): Promise<ExcelStudentRow[]> {
  try {
    // Kiểm tra file tồn tại
    if (!fs.existsSync(filePath)) {
      throw new Error('File Excel không tồn tại');
    }

    // Đọc file Excel
    const workbook = XLSX.readFile(filePath);
    const worksheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[worksheetName];

    // Convert sang JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: ''
    }) as any[][];

    // Lấy header row
    const headers = jsonData[0];
    if (!headers || headers.length < 2) {
      throw new Error('File Excel phải có ít nhất 2 cột: Mã học sinh và Họ tên');
    }

    // Validate headers
    const expectedHeaders = ['Mã học sinh', 'Họ và tên', 'Mật khẩu'];
    const headerMap: { [key: string]: number } = {};
    
    headers.forEach((header, index) => {
      const normalizedHeader = header.toString().trim();
      if (expectedHeaders.includes(normalizedHeader)) {
        headerMap[normalizedHeader] = index;
      }
    });

    if (headerMap['Mã học sinh'] === undefined || headerMap['Họ và tên'] === undefined) {
      throw new Error('File Excel phải có cột "Mã học sinh" và "Họ và tên"');
    }

    // Parse data rows
    const students: ExcelStudentRow[] = [];
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.length === 0) continue;

      const studentCode = row[headerMap['Mã học sinh']]?.toString().trim();
      const fullName = row[headerMap['Họ và tên']]?.toString().trim();
      const password = headerMap['Mật khẩu'] !== undefined ? row[headerMap['Mật khẩu']]?.toString().trim() : undefined;

      // Skip empty rows
      if (!studentCode || !fullName) continue;

      students.push({
        'Mã học sinh': studentCode,
        'Họ và tên': fullName,
        'Mật khẩu': password && password.length > 0 ? password : undefined
      });
    }

    return students;
  } catch (error: any) {
    console.error('Error parsing Excel file:', error);
    throw new Error(`Lỗi đọc file Excel: ${error.message}`);
  }
}

/**
 * Validate student data từ Excel
 */
export function validateStudentData(students: ExcelStudentRow[]): { valid: CreateStudentDto[]; errors: any[] } {
  const valid: CreateStudentDto[] = [];
  const errors: any[] = [];

  students.forEach((student, index) => {
    const rowNumber = index + 2; // +2 vì index 0 là header, và Excel bắt đầu từ 1
    const rowErrors: string[] = [];

    // Validate mã học sinh
    const studentCode = student['Mã học sinh'];
    if (!studentCode) {
      rowErrors.push('Mã học sinh không được để trống');
    } else if (studentCode.length < 3 || studentCode.length > 20) {
      rowErrors.push('Mã học sinh phải từ 3-20 ký tự');
    } else if (!/^[A-Za-z0-9]+$/.test(studentCode)) {
      rowErrors.push('Mã học sinh chỉ chứa chữ cái và số');
    }

    // Validate họ tên
    const fullName = student['Họ và tên'];
    if (!fullName) {
      rowErrors.push('Họ tên không được để trống');
    } else if (fullName.length < 2 || fullName.length > 100) {
      rowErrors.push('Họ tên phải từ 2-100 ký tự');
    }

    // Validate mật khẩu (nếu có)
    const password = student['Mật khẩu'];
    if (password && (password.length < 6 || password.length > 50)) {
      rowErrors.push('Mật khẩu phải từ 6-50 ký tự');
    }

    if (rowErrors.length > 0) {
      errors.push({
        row: rowNumber,
        error: rowErrors.join(', '),
        data: student
      });
    } else {
      valid.push({
        student_code: studentCode,
        full_name: fullName,
        password: password || undefined
      });
    }
  });

  return { valid, errors };
}

/**
 * Tạo file Excel template cho import students
 */
export function createStudentImportTemplate(): Buffer {
  try {
    // Tạo workbook
    const workbook = XLSX.utils.book_new();
    
    // Tạo data với header và example
    const data = [
      ['Mã học sinh', 'Họ và tên', 'Mật khẩu'],
      ['SV001', 'Nguyễn Văn A', 'password123'],
      ['SV002', 'Trần Thị B', ''],
      ['SV003', 'Lê Văn C', 'mypass456']
    ];

    // Tạo worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    
    // Thêm vào workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách học sinh');
    
    // Convert sang buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  } catch (error: any) {
    console.error('Error creating template:', error);
    throw new Error(`Lỗi tạo file template: ${error.message}`);
  }
}

/**
 * Export danh sách students ra Excel
 */
export function exportStudentsToExcel(students: Student[]): Buffer {
  try {
    // Chuẩn bị data
    const data = [
      ['STT', 'Mã học sinh', 'Họ và tên', 'Ngày tạo']
    ];

    students.forEach((student, index) => {
      data.push([
        (index + 1).toString(),
        student.student_code,
        student.full_name,
        new Date(student.created_at).toLocaleDateString('vi-VN')
      ]);
    });

    // Tạo workbook và worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    
    // Thiết lập độ rộng cột
    worksheet['!cols'] = [
      { width: 5 },   // STT
      { width: 15 },  // Mã học sinh
      { width: 30 },  // Họ và tên
      { width: 15 }   // Ngày tạo
    ];

    // Thêm vào workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách học sinh');
    
    // Convert sang buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  } catch (error: any) {
    console.error('Error exporting students:', error);
    throw new Error(`Lỗi export danh sách học sinh: ${error.message}`);
  }
}

/**
 * Export kết quả thi ra Excel
 */
export function exportExamResultsToExcel(
  examName: string,
  participants: ExamParticipantWithDetails[]
): Buffer {
  try {
    // Chuẩn bị data
    const data = [
      [
        'STT',
        'Mã học sinh',
        'Họ và tên',
        'Số đề',
        'Trạng thái',
        'Thời gian bắt đầu',
        'Thời gian nộp',
        'Thời gian làm bài',
        'File audio'
      ]
    ];

    participants.forEach((participant, index) => {
      let duration = '';
      if (participant.start_time && participant.submit_time) {
        const start = new Date(participant.start_time).getTime();
        const submit = new Date(participant.submit_time).getTime();
        const durationSec = (submit - start) / 1000;
        const minutes = Math.floor(durationSec / 60);
        const seconds = Math.floor(durationSec % 60);
        duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }

      const statusMap = {
        'waiting': 'Chờ thi',
        'in_progress': 'Đang thi',
        'completed': 'Đã nộp'
      };

      data.push([
        (index + 1).toString(),
        participant.student.student_code,
        participant.student.full_name,
        participant.question_number.toString(),
        statusMap[participant.status] || participant.status,
        participant.start_time ? new Date(participant.start_time).toLocaleString('vi-VN') : '',
        participant.submit_time ? new Date(participant.submit_time).toLocaleString('vi-VN') : '',
        duration,
        participant.audio_file_path ? path.basename(participant.audio_file_path) : ''
      ]);
    });

    // Tạo workbook và worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    
    // Thiết lập độ rộng cột
    worksheet['!cols'] = [
      { width: 5 },   // STT
      { width: 15 },  // Mã học sinh
      { width: 25 },  // Họ và tên
      { width: 8 },   // Số đề
      { width: 12 },  // Trạng thái
      { width: 20 },  // Thời gian bắt đầu
      { width: 20 },  // Thời gian nộp
      { width: 15 },  // Thời gian làm bài
      { width: 30 }   // File audio
    ];

    // Thêm vào workbook với tên sheet được truncate để không vượt quá 31 ký tự
    const sheetName = truncateSheetName('Kết quả - ', examName);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    // Convert sang buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  } catch (error: any) {
    console.error('Error exporting exam results:', error);
    throw new Error(`Lỗi export kết quả thi: ${error.message}`);
  }
}

/**
 * Validate file Excel format
 */
export function isValidExcelFormat(mimetype: string): boolean {
  const allowedFormats = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel' // .xls
  ];
  return allowedFormats.includes(mimetype);
}

/**
 * Get file extension từ mimetype
 */
export function getExcelExtension(mimetype: string): string {
  const extensions: { [key: string]: string } = {
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-excel': '.xls'
  };
  return extensions[mimetype] || '.xlsx';
}

/**
 * Generate filename cho Excel export
 */
export function generateExcelFilename(prefix: string, suffix?: string): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  const suffixStr = suffix ? `_${suffix}` : '';
  return `${prefix}${suffixStr}_${timestamp}.xlsx`;
}

/**
 * Cleanup temporary Excel files
 */
export async function cleanupExcelFiles(filePaths: string[]): Promise<void> {
  for (const filePath of filePaths) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted Excel file: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error deleting Excel file ${filePath}:`, error);
    }
  }
}

/**
 * Kiểm tra file Excel có hợp lệ không
 */
export function validateExcelFile(filePath: string): boolean {
  try {
    const workbook = XLSX.readFile(filePath);
    return workbook.SheetNames.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Get số lượng rows trong Excel file
 */
export function getExcelRowCount(filePath: string): number {
  try {
    const workbook = XLSX.readFile(filePath);
    const worksheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[worksheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    return jsonData.length - 1; // -1 để bỏ header row
  } catch (error) {
    return 0;
  }
}
