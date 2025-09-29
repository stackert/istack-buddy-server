import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { IStackInfoService } from './istack-info.service';
import { AuthPermissionGuard } from '../common/guards/auth-permission.guard';

@Controller('information-services/knowledge-bases')
export class KnowledgeBasesController {
  constructor(private readonly iStackInfoService: IStackInfoService) {}

  @Get('context-documents/:documentId')
  async getContextDocument(
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      // Fetch the context document from the information services API
      const contextDocument =
        await this.iStackInfoService.getContextDocument(documentId);

      // Return HTML instead of JSON
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Context Document - ${contextDocument.title || 'Untitled'}</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            margin: 0; 
            padding: 40px; 
            background: #f5f5f5; 
            line-height: 1.6;
        }
        .container { 
            background: white; 
            border-radius: 8px; 
            padding: 40px; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 { 
            color: #2c3e50; 
            margin-bottom: 20px; 
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }
        .metadata {
            background: #ecf0f1;
            padding: 20px;
            border-radius: 4px;
            margin: 20px 0;
            font-size: 14px;
        }
            .content {
                white-space: pre-wrap;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                background: #f8f9fa;
                padding: 20px;
                border-radius: 4px;
                border-left: 4px solid #3498db;
                word-wrap: break-word;
                overflow-wrap: break-word;
                max-width: 100%;
            }
            .keywords, .nouns, .proper-nouns, .domains {
                white-space: pre-wrap;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                background: #f8f9fa;
                padding: 20px;
                border-radius: 4px;
                border-left: 4px solid #3498db;
                word-wrap: break-word;
                overflow-wrap: break-word;
                max-width: 100%;
                overflow: hidden;
            }
    </style>
</head>
<body>
    <div class="container">
        <h1>📄 ${contextDocument.title || 'Context Document'}</h1>
        
        <div class="metadata">
            <strong>Document ID:</strong> ${contextDocument.context_document_id}<br>
            <strong>File Path:</strong> ${contextDocument.file_path || 'N/A'}<br>
            <strong>Created:</strong> ${new Date(contextDocument.created_at).toLocaleString()}<br>
            <strong>Updated:</strong> ${new Date(contextDocument.updated_at).toLocaleString()}<br>
            <strong>Token Count:</strong> ${contextDocument.estimated_token_count || 'N/A'}<br>
        </div>
        
        <h2>🏷️ Keywords</h2>
        <div class="keywords">${contextDocument.keywords ? contextDocument.keywords.join(', ') : 'No keywords available'}</div>
        
        <h2>📝 Nouns</h2>
        <div class="nouns">${contextDocument.nouns ? contextDocument.nouns.join(', ') : 'No nouns available'}</div>
        
        <h2>🔤 Proper Nouns</h2>
        <div class="proper-nouns">${contextDocument.proper_nouns ? contextDocument.proper_nouns.join(', ') : 'No proper nouns available'}</div>
        
        <h2>🌐 Domains</h2>
        <div class="domains">${contextDocument.domains ? contextDocument.domains.join(', ') : 'No domains available'}</div>
        
        <h2>📄 Original Text</h2>
        <div class="content">${contextDocument.context_document_text}</div>
        
        <h2>📝 Normalized Text</h2>
        <div class="content">${contextDocument.context_document_text_normalized ? contextDocument.context_document_text_normalized.replace(/-/g, ' - ').replace(/\s+/g, ' ').trim() : 'No normalized text available'}</div>
    </div>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(html);
    } catch (error) {
      if (error.response?.status === 404) {
        res.status(404).json({ error: 'Context document not found' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
}
