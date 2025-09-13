import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { FileManagerService, STORAGE_CLASS } from './file-manager.service';
import { Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';

@Controller('files')
export class FileController {
  private readonly logger = new Logger(FileController.name);

  constructor(private readonly fileManagerService: FileManagerService) {}

  /**
   * Serve session-public files
   * Route: GET /files/session-public/:conversationId/:filename
   *
   * IMPORTANT: This endpoint is specifically for session-public files only.
   * It does NOT interfere with any Marv endpoints which use /public/form-marv paths.
   */
  @Get('session-public/:conversationId/:filename')
  async serveSessionPublicFile(
    @Param('conversationId') conversationId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Serving session-public file: ${conversationId}/${filename}`,
      );

      // Construct the file path directly (works with existing file structure)
      const filePath = join(
        'file-storage-server',
        'session-public',
        conversationId,
        filename,
      );

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        this.logger.warn(`Session-public file not found: ${filePath}`);
        throw new NotFoundException(`File not found: ${filename}`);
      }

      // Read file content
      const fileBuffer = await fs.readFile(filePath);

      // Determine content type from extension
      const contentType = filename.endsWith('.json')
        ? 'application/json'
        : 'application/octet-stream';

      // Set appropriate headers
      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.setHeader('Content-Length', fileBuffer.length.toString());

      // Send the file
      res.send(fileBuffer);

      this.logger.debug(`Successfully served session-public file: ${filePath}`);
    } catch (error) {
      this.logger.error(
        `Failed to serve session-public file ${conversationId}/${filename}: ${error.message}`,
      );

      if (error instanceof NotFoundException) {
        res.status(404).json({
          error: 'File not found',
          message: `File ${filename} not found in conversation ${conversationId}`,
        });
      } else {
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to serve file',
        });
      }
    }
  }
}
