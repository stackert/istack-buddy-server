import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { FileManagerService } from '../file-manager/file-manager.service';
import { CustomLoggerService } from '../common/logger/custom-logger.service';

@Controller('public/slacky/chat')
export class SlackyChatController {
  constructor(
    private readonly chatManagerService: ChatManagerService,
    private readonly fileManagerService: FileManagerService,
    private readonly logger: CustomLoggerService,
  ) {}

  /**
   * GET /public/slacky/chat/{conversationId}/view-message
   * Returns the message indicated by conversationId and messageId
   */
  @Get(':conversationId/view-message')
  async viewMessage(
    @Param('conversationId') conversationId: string,
    @Query('messageId') messageId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Viewing message: conversationId=${conversationId}, messageId=${messageId}`,
      );

      if (!messageId) {
        res.status(400).send('messageId query parameter is required');
        return;
      }

      // Get all messages from the conversation
      const messages = await this.chatManagerService.getMessages(
        conversationId,
        {
          limit: 1000, // Get a large number to find the specific message
          offset: 0,
        },
      );

      // Find the specific message
      const message = messages.find((msg) => msg.id === messageId);

      if (!message) {
        res
          .status(404)
          .send(
            `Message with ID ${messageId} not found in conversation ${conversationId}`,
          );
        return;
      }

      // Return the message as HTML
      const html = this.generateMessageHtml(message, conversationId);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      this.logger.error(
        `Error viewing message ${messageId} in conversation ${conversationId}:`,
        error,
      );
      res.status(500).send('Internal server error');
    }
  }

  /**
   * GET /public/slacky/chat/{conversationId}/view-file
   * Returns the file indicated by conversationId and fileId
   */
  @Get(':conversationId/view-file')
  async viewFile(
    @Param('conversationId') conversationId: string,
    @Query('fileId') fileId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Viewing file: conversationId=${conversationId}, fileId=${fileId}`,
      );

      if (!fileId) {
        res.status(400).send('fileId query parameter is required');
        return;
      }

      // Try to get the file from the file manager
      try {
        const fileContent = await this.fileManagerService.get(fileId);
        const fileMetadata =
          await this.fileManagerService.getMetaDetails(fileId);

        // Determine content type
        const contentType = this.getContentTypeFromFilename(
          fileMetadata.fileId,
        );

        // Set appropriate headers
        res.setHeader('Content-Type', contentType);
        res.setHeader(
          'Content-Disposition',
          `inline; filename="${fileMetadata.fileId}"`,
        );
        res.setHeader('Content-Length', fileContent.length.toString());

        // Send the file content
        res.send(fileContent);
      } catch (fileError) {
        this.logger.warn(
          `File ${fileId} not found in file manager, checking session-public directory`,
        );

        // Try to find the file in session-public directory
        try {
          const fs = require('fs');
          const path = require('path');

          const filePath = path.join(
            'file-storage-server',
            'session-public',
            conversationId,
            fileId,
          );

          const fileBuffer = await fs.promises.readFile(filePath);

          // Determine content type from file extension
          const contentType = this.getContentTypeFromFilename(fileId);

          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Disposition', `inline; filename="${fileId}"`);
          res.setHeader('Content-Length', fileBuffer.length.toString());

          res.send(fileBuffer);
        } catch (sessionFileError) {
          res
            .status(404)
            .send(
              `File with ID ${fileId} not found in conversation ${conversationId}`,
            );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error viewing file ${fileId} in conversation ${conversationId}:`,
        error,
      );
      res.status(500).send('Internal server error');
    }
  }

  /**
   * GET /public/slacky/chat/{conversationId}/view-context-document
   * Returns a stubbed response for context documents (not yet implemented)
   */
  @Get(':conversationId/view-context-document')
  async viewContextDocument(
    @Param('conversationId') conversationId: string,
    @Query('documentId') documentId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Viewing context document: conversationId=${conversationId}, documentId=${documentId}`,
      );

      if (!documentId) {
        res.status(400).send('documentId query parameter is required');
        return;
      }

      // Stubbed response as requested
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Context Document - Not Available</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            margin: 0; 
            padding: 40px; 
            background: #f5f5f5; 
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .container { 
            background: white; 
            border-radius: 8px; 
            padding: 40px; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 600px;
        }
        .icon { 
            font-size: 48px; 
            margin-bottom: 20px; 
            color: #6c757d; 
        }
        h1 { 
            color: #495057; 
            margin-bottom: 20px; 
        }
        .info { 
            background: #e9ecef; 
            padding: 20px; 
            border-radius: 4px; 
            margin: 20px 0; 
            font-family: monospace;
            font-size: 14px;
        }
        .note { 
            color: #6c757d; 
            font-size: 14px; 
            margin-top: 20px; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">📄</div>
        <h1>Context Document Not Available</h1>
        <p>The context document feature is not yet implemented.</p>
        
        <div class="info">
            <strong>Request Details:</strong><br>
            Conversation ID: ${conversationId}<br>
            Document ID: ${documentId}
        </div>
        
        <div class="note">
            This endpoint is currently stubbed out and will be implemented in a future release.
        </div>
    </div>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      this.logger.error(
        `Error viewing context document ${documentId} in conversation ${conversationId}:`,
        error,
      );
      res.status(500).send('Internal server error');
    }
  }

  /**
   * Generate HTML for displaying a message
   */
  private generateMessageHtml(message: any, conversationId: string): string {
    const timeStr = new Date(message.createdAt).toLocaleString();
    const contentType = message.content?.type || 'unknown';

    let displayContent = '';
    if (message.content?.type === 'text/plain') {
      displayContent = message.content.payload || 'No content';
    } else {
      displayContent = JSON.stringify(
        message.content?.payload || message.content || 'No content',
        null,
        2,
      );
    }

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Message View - ${message.id}</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            margin: 0; 
            padding: 40px; 
            background: #f5f5f5; 
        }
        .container { 
            background: white; 
            border-radius: 8px; 
            padding: 30px; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            max-width: 800px;
            margin: 0 auto;
        }
        .header { 
            border-bottom: 2px solid #e9ecef; 
            padding-bottom: 20px; 
            margin-bottom: 20px; 
        }
        .message-id { 
            font-family: monospace; 
            background: #f8f9fa; 
            padding: 8px 12px; 
            border-radius: 4px; 
            font-size: 14px;
            display: inline-block;
            margin-bottom: 10px;
        }
        .message-meta { 
            color: #6c757d; 
            font-size: 14px; 
            margin-bottom: 20px; 
        }
        .content { 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 4px; 
            border-left: 4px solid #007bff;
            white-space: pre-wrap;
            font-family: inherit;
        }
        .json-content { 
            background: #fff3cd; 
            border-left-color: #ffc107;
        }
        .back-link { 
            color: #007bff; 
            text-decoration: none; 
            font-weight: 500; 
        }
        .back-link:hover { 
            text-decoration: underline; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="message-id">Message ID: ${message.id}</div>
            <h1>Message Content</h1>
            <div class="message-meta">
                <strong>From:</strong> ${message.fromRole || 'unknown'} → <strong>To:</strong> ${message.toRole || 'unknown'}<br>
                <strong>Conversation:</strong> ${conversationId}<br>
                <strong>Content Type:</strong> ${contentType}<br>
                <strong>Created:</strong> ${timeStr}
            </div>
        </div>
        
        <div class="content ${contentType === 'application/json' ? 'json-content' : ''}">
${displayContent}
        </div>
        
        <div style="margin-top: 30px; text-align: center;">
            <a href="javascript:history.back()" class="back-link">← Back to Previous Page</a>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Determine content type from filename
   */
  private getContentTypeFromFilename(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();

    const contentTypes: { [key: string]: string } = {
      json: 'application/json',
      txt: 'text/plain',
      csv: 'text/csv',
      html: 'text/html',
      xml: 'application/xml',
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
    };

    return contentTypes[ext || ''] || 'application/octet-stream';
  }
}
