import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

export enum STORAGE_CLASS {
  TEMP = 'temp',
  SHORT_TERM = 'short-term',
}

export interface FileMetaDetails {
  fileId: string;
  storageClass: STORAGE_CLASS;
  contentType: string;
  tokenSize: number;
  createdDate: Date;
  modifiedDate: Date;
  fileSize: number;
  extension: string;
}

export interface FileContent {
  content: string | Buffer;
  contentType?: string;
}

@Injectable()
export class FileManagerService {
  private readonly logger = new Logger(FileManagerService.name);
  private readonly basePath: string;
  private readonly tempPath: string;
  private readonly shortTermPath: string;

  constructor() {
    this.basePath = process.env.FILE_STORAGE_BASE_PATH || './storage';
    this.tempPath =
      process.env.FILE_STORAGE_TEMP_PATH || join(this.basePath, 'temp');
    this.shortTermPath =
      process.env.FILE_STORAGE_SHORT_TERM_PATH ||
      join(this.basePath, 'short-term');

    // Initialize directories synchronously - die hard if this fails
    this.initializeDirectories();
  }

  private initializeDirectories(): void {
    try {
      fsSync.mkdirSync(this.tempPath, { recursive: true });
      fsSync.mkdirSync(this.shortTermPath, { recursive: true });
      this.logger.log(`File storage directories initialized: ${this.basePath}`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize storage directories: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Store file content and return file ID
   * @param fileContent - The content to store
   * @param storageClass - Storage class (TEMP or SHORT_TERM)
   * @returns File ID
   */
  async put(
    fileContent: FileContent,
    storageClass: STORAGE_CLASS,
  ): Promise<string> {
    try {
      const fileId = this.generateFileId(fileContent.contentType);
      const filePath = this.getFilePath(fileId, storageClass);

      // Write file content
      const content = Buffer.isBuffer(fileContent.content)
        ? fileContent.content
        : Buffer.from(fileContent.content, 'utf8');

      await fs.writeFile(filePath, content);

      this.logger.debug(`File stored: ${fileId} in ${storageClass} storage`);
      return fileId;
    } catch (error) {
      this.logger.error(`Failed to store file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieve file content by ID
   * @param fileId - The file ID
   * @returns File content as Buffer
   */
  async get(fileId: string): Promise<Buffer> {
    try {
      const storageClass = this.extractStorageClass(fileId);
      const filePath = this.getFilePath(fileId, storageClass);

      const content = await fs.readFile(filePath);
      this.logger.debug(`File retrieved: ${fileId}`);
      return content;
    } catch (error) {
      this.logger.error(`Failed to retrieve file ${fileId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get metadata details for a file
   * @param fileId - The file ID
   * @returns File metadata
   */
  async getMetaDetails(fileId: string): Promise<FileMetaDetails> {
    try {
      const storageClass = this.extractStorageClass(fileId);
      const filePath = this.getFilePath(fileId, storageClass);

      const stats = await fs.stat(filePath);
      const extension = extname(fileId);
      const contentType = this.getContentTypeFromExtension(extension);

      // Get file content to calculate token size
      const content = await fs.readFile(filePath);
      const tokenSize = this.calculateTokenSize(content);

      const metaDetails: FileMetaDetails = {
        fileId,
        storageClass,
        contentType,
        tokenSize,
        createdDate: stats.birthtime,
        modifiedDate: stats.mtime,
        fileSize: stats.size,
        extension,
      };

      this.logger.debug(`Metadata retrieved for file: ${fileId}`);
      return metaDetails;
    } catch (error) {
      this.logger.error(
        `Failed to get metadata for file ${fileId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Delete a file by ID
   * @param fileId - The file ID
   */
  async delete(fileId: string): Promise<void> {
    try {
      const storageClass = this.extractStorageClass(fileId);
      const filePath = this.getFilePath(fileId, storageClass);

      await fs.unlink(filePath);
      this.logger.debug(`File deleted: ${fileId}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${fileId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if a file exists
   * @param fileId - The file ID
   * @returns True if file exists
   */
  async exists(fileId: string): Promise<boolean> {
    try {
      const storageClass = this.extractStorageClass(fileId);
      const filePath = this.getFilePath(fileId, storageClass);

      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List files in a storage class
   * @param storageClass - Storage class to list
   * @returns Array of file IDs
   */
  async listFiles(storageClass: STORAGE_CLASS): Promise<string[]> {
    try {
      const dirPath =
        storageClass === STORAGE_CLASS.TEMP
          ? this.tempPath
          : this.shortTermPath;
      const files = await fs.readdir(dirPath);

      // Filter out directories and return only files
      const fileIds: string[] = [];
      for (const file of files) {
        const filePath = join(dirPath, file);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          fileIds.push(file);
        }
      }

      return fileIds;
    } catch (error) {
      this.logger.error(
        `Failed to list files in ${storageClass}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Clean up old files based on age
   * @param storageClass - Storage class to clean
   * @param maxAgeMs - Maximum age in milliseconds
   */
  async cleanupOldFiles(
    storageClass: STORAGE_CLASS,
    maxAgeMs: number,
  ): Promise<number> {
    try {
      const files = await this.listFiles(storageClass);
      const now = Date.now();
      let deletedCount = 0;

      for (const fileId of files) {
        const metaDetails = await this.getMetaDetails(fileId);
        const age = now - metaDetails.createdDate.getTime();

        if (age > maxAgeMs) {
          await this.delete(fileId);
          deletedCount++;
        }
      }

      this.logger.log(
        `Cleaned up ${deletedCount} old files from ${storageClass} storage`,
      );
      return deletedCount;
    } catch (error) {
      this.logger.error(
        `Failed to cleanup old files in ${storageClass}: ${error.message}`,
      );
      throw error;
    }
  }

  private generateFileId(contentType?: string): string {
    const uuid = uuidv4();
    const extension = this.getExtensionFromContentType(contentType);
    return `${uuid}-${extension}`;
  }

  private getFilePath(fileId: string, storageClass: STORAGE_CLASS): string {
    const dirPath =
      storageClass === STORAGE_CLASS.TEMP ? this.tempPath : this.shortTermPath;
    return join(dirPath, fileId);
  }

  private extractStorageClass(fileId: string): STORAGE_CLASS {
    // For now, we'll determine storage class by checking which directory the file exists in
    // This could be enhanced to include storage class in the file ID format
    return STORAGE_CLASS.TEMP; // Default, will be determined by file existence
  }

  private getContentTypeFromExtension(extension: string): string {
    const contentTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.csv': 'text/csv',
      '.xml': 'application/xml',
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.md': 'text/markdown',
      '.log': 'text/plain',
    };

    return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  private getExtensionFromContentType(contentType?: string): string {
    if (!contentType) return '';

    const extensions: Record<string, string> = {
      'text/plain': '.txt',
      'application/json': '.json',
      'text/csv': '.csv',
      'application/xml': '.xml',
      'text/html': '.html',
      'application/javascript': '.js',
      'application/typescript': '.ts',
      'text/markdown': '.md',
    };

    return extensions[contentType] || '';
  }

  private calculateTokenSize(content: Buffer): number {
    // Simple token estimation: ~4 characters per token for English text
    // This is a rough approximation - for production, consider using a proper tokenizer
    const text = content.toString('utf8');
    return Math.ceil(text.length / 4);
  }
}
