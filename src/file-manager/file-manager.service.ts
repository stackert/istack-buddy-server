import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import { join, extname, dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';

export enum STORAGE_CLASS {
  TEMP = 'temp',
  SHORT_TERM = 'short-term',
  SESSION_PUBLIC = 'session-public',
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
  filename?: string; // Optional custom filename for session-public files
}

@Injectable()
export class FileManagerService {
  private readonly logger = new Logger(FileManagerService.name);
  private readonly basePath: string;
  private readonly tempPath: string;
  private readonly shortTermPath: string;
  private readonly sessionPublicPath: string;

  constructor() {
    this.basePath =
      process.env.FILE_STORAGE_BASE_PATH || './file-storage-server';

    // All paths are relative to basePath
    const tempSubPath = process.env.FILE_STORAGE_TEMP_PATH || 'tmp';
    const shortTermSubPath =
      process.env.FILE_STORAGE_SHORT_TERM_PATH || 'short-term';
    const sessionPublicSubPath =
      process.env.FILE_STORAGE_SESSION_PUBLIC_PATH || 'session-public';

    this.tempPath = join(this.basePath, tempSubPath.replace(/^\//, ''));
    this.shortTermPath = join(
      this.basePath,
      shortTermSubPath.replace(/^\//, ''),
    );
    this.sessionPublicPath = join(
      this.basePath,
      sessionPublicSubPath.replace(/^\//, ''),
    );

    // Initialize directories synchronously - die hard if this fails
    this.initializeDirectories();
  }

  private initializeDirectories(): void {
    try {
      fsSync.mkdirSync(this.tempPath, { recursive: true });
      fsSync.mkdirSync(this.shortTermPath, { recursive: true });
      fsSync.mkdirSync(this.sessionPublicPath, { recursive: true });
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
    customPath?: string,
  ): Promise<string> {
    try {
      // Use custom filename for session-public files, otherwise generate UUID
      const fileId =
        fileContent.filename || this.generateFileId(fileContent.contentType);

      // For session-public with custom path, combine them
      const finalFileId = customPath ? `${customPath}/${fileId}` : fileId;
      const filePath = this.getFilePath(finalFileId, storageClass);

      // Write file content
      const content = Buffer.isBuffer(fileContent.content)
        ? fileContent.content
        : Buffer.from(fileContent.content, 'utf8');

      // Ensure directory exists for nested paths
      await fs.mkdir(dirname(filePath), { recursive: true });

      await fs.writeFile(filePath, content);

      this.logger.debug(
        `File stored: ${finalFileId} in ${storageClass} storage`,
      );
      return finalFileId;
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
    let dirPath: string;
    switch (storageClass) {
      case STORAGE_CLASS.TEMP:
        dirPath = this.tempPath;
        break;
      case STORAGE_CLASS.SHORT_TERM:
        dirPath = this.shortTermPath;
        break;
      case STORAGE_CLASS.SESSION_PUBLIC:
        dirPath = this.sessionPublicPath;
        break;
      default:
        dirPath = this.tempPath;
    }
    return join(dirPath, fileId);
  }

  private extractStorageClass(fileId: string): STORAGE_CLASS {
    // Check which directory the file exists in
    const tempPath = this.getFilePath(fileId, STORAGE_CLASS.TEMP);
    const shortTermPath = this.getFilePath(fileId, STORAGE_CLASS.SHORT_TERM);
    const sessionPublicPath = this.getFilePath(
      fileId,
      STORAGE_CLASS.SESSION_PUBLIC,
    );

    try {
      // Check session-public first (most likely for our use case)
      if (fsSync.existsSync(sessionPublicPath)) {
        return STORAGE_CLASS.SESSION_PUBLIC;
      }
      // Check short-term
      if (fsSync.existsSync(shortTermPath)) {
        return STORAGE_CLASS.SHORT_TERM;
      }
      // Default to temp
      return STORAGE_CLASS.TEMP;
    } catch (error) {
      // If there's an error checking, default to temp
      return STORAGE_CLASS.TEMP;
    }
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
