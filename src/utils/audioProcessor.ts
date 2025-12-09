// Audio processing utilities

import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import { config, getAudioUploadPath, getTempUploadPath } from '../config/config';
import { AudioProcessingResult } from '../types/models';

// Set FFmpeg path to the bundled binary
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
  console.log('✅ FFmpeg path set to bundled binary:', ffmpegStatic);
} else {
  console.warn('⚠️ FFmpeg static binary not found, using system FFmpeg');
}

/**
 * Convert audio file sang MP3 (hỗ trợ tất cả định dạng: WebM, WAV, etc.)
 */
export async function convertAudioToMP3(inputPath: string, outputPath?: string): Promise<AudioProcessingResult> {
  return new Promise((resolve) => {
    try {
      // Kiểm tra file input tồn tại
      if (!fs.existsSync(inputPath)) {
        resolve({
          success: false,
          originalPath: inputPath,
          error: 'File đầu vào không tồn tại'
        });
        return;
      }

      // Tạo output path nếu không có
      if (!outputPath) {
        const basename = path.basename(inputPath, path.extname(inputPath));
        outputPath = path.join(getAudioUploadPath(), `${basename}.mp3`);
      }

      // Đảm bảo thư mục output tồn tại
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      console.log(`Converting audio with ffmpeg-static: ${inputPath} -> ${outputPath}`);
      console.log(`Volume boost: ${config.audio.volumeBoost}x (${config.audio.volumeBoost === 1 ? 'no change' : config.audio.volumeBoost > 1 ? 'louder' : 'quieter'})`);

      ffmpeg(inputPath)
        .toFormat('mp3')
        .audioCodec('libmp3lame')
        .audioBitrate(config.audio.bitrate)
        .audioFrequency(config.audio.sampleRate)
        .audioChannels(2)
        .audioFilters([
          `volume=${config.audio.volumeBoost}` // Tăng âm lượng
        ])
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          console.log(`Processing: ${Math.round(progress.percent || 0)}% done`);
        })
        .on('end', () => {
          console.log('Audio conversion completed successfully');
          
          // Kiểm tra file output
          if (!fs.existsSync(outputPath!)) {
            resolve({
              success: false,
              originalPath: inputPath,
              error: 'Output file was not created'
            });
            return;
          }

          const stats = fs.statSync(outputPath!);
          if (stats.size === 0) {
            resolve({
              success: false,
              originalPath: inputPath,
              error: 'Output file is empty'
            });
            return;
          }

          console.log(`Conversion successful: ${stats.size} bytes`);
          
          resolve({
            success: true,
            originalPath: inputPath,
            convertedPath: outputPath,
            format: 'mp3'
          });
        })
        .on('error', (err) => {
          console.error('FFmpeg conversion error:', err.message);
          resolve({
            success: false,
            originalPath: inputPath,
            error: `Lỗi convert audio: ${err.message}`
          });
        })
        .save(outputPath);

    } catch (error: any) {
      console.error('Audio processing error:', error);
      resolve({
        success: false,
        originalPath: inputPath,
        error: error.message || 'Lỗi không xác định'
      });
    }
  });
}

/**
 * Lấy thông tin metadata của audio file
 */
export async function getAudioMetadata(filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error('File does not exist'));
      return;
    }

    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(metadata);
    });
  });
}

/**
 * Validate audio file format
 */
export function isValidAudioFormat(mimetype: string): boolean {
  const allowedFormats = [
    'audio/webm',
    'audio/mp3',
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav'
  ];
  return allowedFormats.includes(mimetype);
}

/**
 * Generate unique filename for audio
 */
export function generateAudioFilename(originalName: string, studentId: number, examId: number, questionNumber: number): string {
  const timestamp = Date.now();
  const ext = path.extname(originalName) || '.webm';
  return `exam_${examId}_student_${studentId}_q${questionNumber}_${timestamp}${ext}`;
}

/**
 * Generate output filename for converted audio
 */
export function generateOutputFilename(inputFilename: string): string {
  const basename = path.basename(inputFilename, path.extname(inputFilename));
  return `${basename}.mp3`;
}

/**
 * Cleanup temporary files
 */
export async function cleanupTempFiles(filePaths: string[]): Promise<void> {
  for (const filePath of filePaths) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted temp file: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error deleting temp file ${filePath}:`, error);
    }
  }
}

/**
 * Move file từ temp directory sang upload directory
 */
export async function moveFileToUploadDir(tempPath: string, finalFilename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadDir = getAudioUploadPath();
    const finalPath = path.join(uploadDir, finalFilename);

    // Đảm bảo upload directory tồn tại
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Move file
    fs.rename(tempPath, finalPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log(`Moved file: ${tempPath} -> ${finalPath}`);
      resolve(finalPath);
    });
  });
}

/**
 * Process uploaded audio file (move + convert if needed)
 */
export async function processUploadedAudio(
  tempFilePath: string,
  studentId: number,
  examId: number,
  questionNumber: number
): Promise<AudioProcessingResult> {
  try {
    // Generate final filename với extension gốc
    const originalName = path.basename(tempFilePath);
    const finalFilename = generateAudioFilename(originalName, studentId, examId, questionNumber);
    
    // Move file to upload directory
    const uploadedPath = await moveFileToUploadDir(tempFilePath, finalFilename);
    
    // Luôn convert về MP3 để đảm bảo tính nhất quán
    const ext = path.extname(uploadedPath).toLowerCase();
    
    if (ext === '.mp3') {
      // File đã là MP3, không cần convert
      return {
        success: true,
        originalPath: uploadedPath,
        convertedPath: uploadedPath,
        format: 'mp3'
      };
    } else {
      // Convert tất cả định dạng khác về MP3
      const mp3Filename = generateOutputFilename(finalFilename);
      const mp3Path = path.join(getAudioUploadPath(), mp3Filename);
      
      const result = await convertAudioToMP3(uploadedPath, mp3Path);
      
      if (result.success) {
        // Delete original file after successful conversion
        await cleanupTempFiles([uploadedPath]);
        return result;
      } else {
        // If conversion failed, still return original file but log the error
        console.warn(`Failed to convert ${ext} to MP3, keeping original file`);
        return {
          success: true,
          originalPath: uploadedPath,
          convertedPath: uploadedPath,
          format: ext.substring(1),
          warning: `Không thể convert ${ext} sang MP3, giữ file gốc`
        };
      }
    }
  } catch (error: any) {
    console.error('Error processing uploaded audio:', error);
    return {
      success: false,
      originalPath: tempFilePath,
      error: error.message || 'Lỗi xử lý file audio'
    };
  }
}

/**
 * Get audio file size in bytes
 */
export function getAudioFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

/**
 * Format file size to human readable
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration to MM:SS
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Check if FFmpeg is available and working
 */
export async function checkFFmpegAvailability(): Promise<boolean> {
  return new Promise((resolve) => {
    // Simple test - just check if ffprobe can run
    ffmpeg.ffprobe(__filename, (err) => {
      // We expect an error since we're probing a JS file, but ffprobe should run
      if (err && err.message.includes('Invalid data found')) {
        // This means ffprobe ran but couldn't parse the file - FFmpeg is working
        resolve(true);
      } else if (err && (err.message.includes('not found') || err.message.includes('ENOENT'))) {
        // FFmpeg binary not found
        resolve(false);
      } else {
        // Unexpected success or other error - assume working
        resolve(true);
      }
    });
  });
}

/**
 * Detect actual audio format based on file content (magic bytes)
 */
export async function detectAudioFormat(filePath: string): Promise<{format: string, codec: string, needsConversion: boolean, error?: string}> {
  try {
    if (!fs.existsSync(filePath)) {
      return { format: 'unknown', codec: 'unknown', needsConversion: true, error: 'File does not exist' };
    }

    // Read first 32 bytes to check magic bytes
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(32);
    fs.readSync(fd, buffer, 0, 32, 0);
    fs.closeSync(fd);

    const header = buffer.toString('hex');
    const textHeader = buffer.toString('ascii');

    // Check magic bytes for different formats
    if (header.startsWith('494433') || header.startsWith('fffb') || header.startsWith('fff3') || header.startsWith('fff2')) {
      // MP3 file (ID3 tag or MPEG frame sync)
      return { format: 'mp3', codec: 'mp3', needsConversion: false };
    }
    
    if (header.startsWith('1a45dfa3') || textHeader.includes('webm') || buffer.includes(Buffer.from('webm'))) {
      // WebM/Matroska file
      return { format: 'webm', codec: 'opus', needsConversion: true };
    }
    
    if (header.startsWith('52494646') && textHeader.includes('WAVE')) {
      // WAV file
      return { format: 'wav', codec: 'pcm', needsConversion: true };
    }
    
    if (header.startsWith('4f676753')) {
      // OGG file
      return { format: 'ogg', codec: 'vorbis', needsConversion: true };
    }

    // Check file extension as fallback
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.mp3') {
      return { format: 'mp3', codec: 'mp3', needsConversion: false };
    }
    
    if (ext === '.webm') {
      return { format: 'webm', codec: 'opus', needsConversion: true };
    }
    
    if (ext === '.wav') {
      return { format: 'wav', codec: 'pcm', needsConversion: true };
    }
    
    if (ext === '.ogg') {
      return { format: 'ogg', codec: 'vorbis', needsConversion: true };
    }

    // Unknown format, assume conversion needed
    return { format: 'unknown', codec: 'unknown', needsConversion: true };

  } catch (error: any) {
    return { format: 'unknown', codec: 'unknown', needsConversion: true, error: error.message };
  }
}

/**
 * Validate MP3 file integrity using magic bytes
 */
export async function validateMP3File(filePath: string): Promise<{isValid: boolean, error?: string, duration?: number}> {
  try {
    if (!fs.existsSync(filePath)) {
      return { isValid: false, error: 'File does not exist' };
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return { isValid: false, error: 'File is empty' };
    }

    // Check minimum file size (MP3 should be at least 1KB for a valid recording)
    if (stats.size < 1024) {
      return { isValid: false, error: 'File too small to be a valid MP3' };
    }

    // Read first 32 bytes to check magic bytes
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(32);
    fs.readSync(fd, buffer, 0, 32, 0);
    fs.closeSync(fd);

    const header = buffer.toString('hex');
    const textHeader = buffer.toString('ascii');

    // Check for MP3 magic bytes
    const isMP3 = header.startsWith('494433') || // ID3 tag
                  header.startsWith('fffb') ||   // MPEG frame sync
                  header.startsWith('fff3') ||   // MPEG frame sync
                  header.startsWith('fff2');     // MPEG frame sync

    // Check for WebM/Matroska signature (should not be in MP3)
    const isWebM = header.startsWith('1a45dfa3') || 
                   textHeader.includes('webm') || 
                   buffer.includes(Buffer.from('webm'));

    if (isWebM) {
      return { isValid: false, error: 'WebM file detected - not a valid MP3' };
    }

    if (!isMP3) {
      return { isValid: false, error: 'Invalid MP3 file signature' };
    }

    return { 
      isValid: true,
      duration: undefined // Duration would require full parsing
    };

  } catch (error: any) {
    return { isValid: false, error: error.message };
  }
}
