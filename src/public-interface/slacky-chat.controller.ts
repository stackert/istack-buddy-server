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

      this.logger.debug(
        `Found ${messages.length} messages in conversation ${conversationId}`,
      );

      // Find the specific message
      const message = messages.find((msg) => msg.id === messageId);

      if (!message) {
        // Log available message IDs for debugging
        const availableIds = messages.map((msg) => msg.id);
        this.logger.warn(
          `Message ${messageId} not found in memory. Available message IDs: ${availableIds.join(', ')}`,
        );

        // Try to find the message in the log file as a fallback
        try {
          const fs = require('fs');
          const path = require('path');

          const logFilePath = path.join(
            'logs',
            'dev-debug-conversations',
            `messages-${conversationId}.json`,
          );

          if (fs.existsSync(logFilePath)) {
            const logData = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
            const logMessage = logData.messages?.find(
              (msg: any) => msg.id === messageId,
            );

            if (logMessage) {
              this.logger.debug(`Found message ${messageId} in log file`);
              const html = this.generateMessageHtml(logMessage, conversationId);
              res.setHeader('Content-Type', 'text/html');
              res.send(html);
              return;
            }
          }
        } catch (logError) {
          this.logger.warn(`Error reading log file: ${logError.message}`);
        }

        res
          .status(404)
          .send(
            `Message with ID ${messageId} not found in conversation ${conversationId}. Found ${messages.length} messages in memory. Available IDs: ${availableIds.slice(0, 5).join(', ')}${availableIds.length > 5 ? '...' : ''}`,
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
   * Generate HTML for displaying a message with full debug details
   */
  private generateMessageHtml(message: any, conversationId: string): string {
    const timeStr = new Date(message.createdAt).toLocaleString();
    const contentType = message.content?.type || 'unknown';

    // Format content properly - convert \n to actual line breaks
    let displayContent = '';
    const rawContent =
      message.content?.payload || message.content || 'No content';

    // Handle different content types
    if (
      message.content?.type === 'text/plain' ||
      message.content?.type === 'system/robot-prompt' ||
      typeof rawContent === 'string'
    ) {
      // Convert to HTML with basic markdown support
      displayContent = this.convertMarkdownToHtml(String(rawContent));
    } else {
      displayContent = JSON.stringify(rawContent, null, 2);
    }

    // Generate full message details for debugging
    const fullMessageDetails = JSON.stringify(message, null, 2);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Message Debug View - ${message.id}</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: #f5f5f5; 
        }
        .container { 
            background: white; 
            border-radius: 8px; 
            padding: 30px; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            max-width: 1200px;
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
            font-family: inherit;
            line-height: 1.6;
        }
        .content h1, .content h2, .content h3 {
            margin: 20px 0 10px 0;
            color: #495057;
        }
        .content h1 { font-size: 24px; }
        .content h2 { font-size: 20px; }
        .content strong { font-weight: 600; color: #212529; }
        .content em { font-style: italic; color: #6c757d; }
        .content code { 
            background: #e9ecef; 
            padding: 2px 6px; 
            border-radius: 3px; 
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.9em;
        }
        .content a { 
            color: #007bff; 
            text-decoration: none; 
        }
        .content a:hover { 
            text-decoration: underline; 
        }
        .json-content { 
            background: #fff3cd; 
            border-left-color: #ffc107;
        }
        .debug-section {
            margin-top: 30px;
            border-top: 2px solid #e9ecef;
            padding-top: 20px;
        }
        .debug-title {
            font-size: 18px;
            font-weight: 600;
            color: #495057;
            margin-bottom: 15px;
        }
        .debug-content {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 4px;
            border: 1px solid #dee2e6;
            white-space: pre-wrap;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 12px;
            line-height: 1.4;
            overflow-x: auto;
        }
        .back-link { 
            color: #007bff; 
            text-decoration: none; 
            font-weight: 500; 
        }
        .back-link:hover { 
            text-decoration: underline; 
        }
        .tabs {
            display: flex;
            margin-bottom: 20px;
            border-bottom: 1px solid #dee2e6;
        }
        .tab {
            padding: 10px 20px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            color: #6c757d;
        }
        .tab.active {
            color: #007bff;
            border-bottom-color: #007bff;
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
    </style>
    <script>
        function showTab(tabName) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            // Remove active class from all tabs
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            // Show selected tab content
            document.getElementById(tabName).classList.add('active');
            // Add active class to clicked tab
            event.target.classList.add('active');
        }
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="message-id">Message ID: ${message.id}</div>
            <h1>Message Debug View</h1>
            <div class="message-meta">
                <strong>From:</strong> ${message.fromRole || 'unknown'} → <strong>To:</strong> ${message.toRole || 'unknown'}<br>
                <strong>Conversation:</strong> ${conversationId}<br>
                <strong>Content Type:</strong> ${contentType}<br>
                <strong>Created:</strong> ${timeStr}
            </div>
        </div>
        
        <div class="tabs">
            <div class="tab active" onclick="showTab('content-tab')">Content</div>
            <div class="tab" onclick="showTab('debug-tab')">Full Debug</div>
        </div>
        
        <div id="content-tab" class="tab-content active">
            <div class="content ${contentType === 'application/json' ? 'json-content' : ''}">
                ${displayContent}
            </div>
        </div>
        
        <div id="debug-tab" class="tab-content">
            <div class="debug-section">
                <div class="debug-title">Full Message Object (Debug)</div>
                <div class="debug-content">${fullMessageDetails}</div>
            </div>
        </div>
        
        <div style="margin-top: 30px; text-align: center;">
            <a href="javascript:history.back()" class="back-link">← Back to Previous Page</a>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Convert basic markdown to HTML
   */
  private convertMarkdownToHtml(text: string): string {
    let html = text;

    // Convert line breaks to <br>
    html = html.replace(/\n/g, '<br>');

    // Convert **bold** to <strong>
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Convert *italic* to <em>
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Convert ## headers to <h2>
    html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');

    // Convert # headers to <h1>
    html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

    // Convert [link text](url) to <a href="url">link text</a>
    html = html.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank">$1</a>',
    );

    // Convert `code` to <code>
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    return html;
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
