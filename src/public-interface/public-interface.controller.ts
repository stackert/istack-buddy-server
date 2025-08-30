import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthenticationService } from '../authentication/authentication.service';
import { AuthorizationPermissionsService } from '../authorization-permissions/authorization-permissions.service';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuthPermissionGuard } from '../common/guards/auth-permission.guard';
import { RobotService } from '../robots/robot.service';
import { UserProfileService } from '../user-profile/user-profile.service';
import { fsApiClient } from '../robots/tool-definitions/marv/fsApiClient';

@Controller('public')
export class PublicInterfaceController {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly authPermissionsService: AuthorizationPermissionsService,
    private readonly chatManagerService: ChatManagerService,
    private readonly robotService: RobotService,
    private readonly userProfileService: UserProfileService,
  ) {}

  /**
   * Get the base URL for generating links with proper fallbacks
   */
  private getBaseUrl(): string {
    // Priority 1: NGROK_URL environment variable
    if (process.env.NGROK_URL) {
      return process.env.NGROK_URL.replace(/\/$/, ''); // Remove trailing slash if present
    }

    // Priority 2: ISTACK_BUDDY_FRONT_END_HOST environment variable
    if (process.env.ISTACK_BUDDY_FRONT_END_HOST) {
      return process.env.ISTACK_BUDDY_FRONT_END_HOST.replace(/\/$/, ''); // Remove trailing slash if present
    }

    // Priority 3: Fallback to relative path
    return '';
  }

  @Get('/')
  async serveRootContent(@Res() res: Response): Promise<void> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>iStackBuddy Public Interface</title>
</head>
<body>
    <h1>Welcome to iStackBuddy Public Interface</h1>
    <p>This is the public interface for iStackBuddy services.</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  /**
   * Debug endpoint to create a test session
   * Used for testing form-marv without going through Slack
   */
  @Get('/form-marv/debug-create')
  async debugCreateSession(
    @Query('formId') formId: string,
    @Res() res: Response
  ): Promise<void> {
    try {
      if (!formId) {
        res.status(400).json({
          error: 'Form ID is required',
          message: 'Must provide formId as query parameter: /form-marv/debug-create?formId=YOUR_FORM_ID'
        });
        return;
      }

      this.logger.debug('Creating test session...');
      
      // Generate a unique session ID
      const sessionId = require('uuid').v4();
      
      // Create the session using the same logic as slacky
      const sessionResult = this.authPermissionsService.createTempUserAndSession(
        sessionId,
        formId,
      );
      
      // Create a conversation for this session
      await this.chatManagerService.getOrCreateExternalConversation(
        sessionResult.sessionId,
        'marv-debug-session',
        'form-marv-session',
      );
      
      // Set the formId in the conversation metadata
      this.chatManagerService.setConversationFormId(
        sessionResult.sessionId,
        formId,
      );
      
      // Generate the session URL
      const baseUrl = this.getBaseUrl();
      const sessionUrl = `${baseUrl}/public/form-marv/${sessionResult.sessionId}/${formId}?jwtToken=${sessionResult.jwtToken}`;
      
      // Return HTML response similar to what slacky sends to Slack
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Form Marv Session Created</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .success { color: #28a745; }
        .info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .link { background: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
        .link:hover { background: #0056b3; }
    </style>
</head>
<body>
    <h1 class="success">✅ Thank you!</h1>
    <p>Your form session has been created successfully.</p>
    
    <div class="info">
        <p><strong>Form ID:</strong> ${formId}</p>
        <p><strong>Session ID:</strong> ${sessionResult.sessionId}</p>
        <p><strong>Created:</strong> ${new Date().toLocaleString()}</p>
    </div>
    
    <p>Click the link below to access your form session:</p>
    <a href="${sessionUrl}" class="link" target="_blank">Open Form Session</a>
    
    <p><small>This session will remain active for several hours. You can bookmark this link for future testing.</small></p>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
      
    } catch (error) {
      this.logger.error('Error creating debug session:', error);
      res.status(500).json({
        error: 'Failed to create debug session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Debug endpoint to get session information
   * Used for inspecting session data during testing
   */
  @Get('/form-marv/:secretKey/debug-session')
  async debugGetSession(
    @Param('secretKey') secretKey: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      // Find the session by looking through all active sessions
      const sessions = this.authPermissionsService.getAllFormMarvSessions();
      const session = sessions.find(s => s.sessionId === secretKey);
      
      if (!session) {
        res.status(404).json({
          error: 'Session not found',
          secretKey,
          message: `No active session found with secret key: ${secretKey}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      
      // Return session debug information
      res.json({
        secretKey,
        sessionData: {
          secretKey: session.sessionId,
          formId: session.formId,
          userId: session.userId,
          jwtToken: session.jwtToken.substring(0, 20) + '...', // Truncate for security
          createdAt: session.createdAt,
          lastActivityAt: session.lastActivityAt,
          expiresInMs: session.expiresInMs,
          conversationId: session.conversationId,
        },
        timestamp: new Date().toISOString(),
        note: 'This is debug information for testing purposes only',
      });
      
    } catch (error) {
      this.logger.error('Error getting debug session:', error);
      res.status(500).json({
        error: 'Failed to get session debug info',
        secretKey,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  @Get('/form-marv')
  async handleFormMarvRoot(@Res() res: Response): Promise<void> {
    res.status(404).send('Form ID is required in the URL path');
  }

  @Get('/form-marv/:conversationId')
  async serveFormMarvContent(
    @Param('conversationId') conversationId: string,
    @Res() res: Response,
    @Req() req: any,
  ): Promise<void> {
    // Return 401 for root path - formId is required
    res.status(401).send('Form ID is required in the URL path');
  }

  @Get('/form-marv/:conversationId/:formId')
  async serveFormMarvContentWithFormId(
    @Param('conversationId') conversationId: string,
    @Param('formId') formId: string,
    @Query('jwtToken') jwtToken: string,
    @Res() res: Response,
    @Req() req: any,
  ): Promise<void> {
    try {
      // If JWT token is provided in query, authenticate and set it as a cookie
      if (jwtToken) {
        try {
          // Decode JWT to get userId
          const decoded = jwt.verify(
            jwtToken,
            'istack-buddy-secret-key-2024',
          ) as any;
          const userId = decoded.userId;

          // Authenticate the user using the authentication service
          const authResult = await this.authService.authenticateUser(
            userId,
            jwtToken,
          );

          if (!authResult.success) {
            res.status(401).send('Invalid JWT token');
            return;
          }

          // Set JWT token as cookie
          res.cookie('jwtToken', jwtToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
          });

          // Redirect to the same URL without the jwtToken parameter
          res.redirect(`/public/form-marv/${conversationId}/${formId}`);
          return;
        } catch (error) {
          this.logger.error('JWT authentication error:', error);
          res.status(401).send('Invalid JWT token');
          return;
        }
      }

      // Check if JWT token exists in cookie (required for authenticated access)
      const cookieJwtToken = req.cookies?.jwtToken;
      if (!cookieJwtToken) {
        res
          .status(401)
          .send('Authentication required - JWT token not found in cookie');
        return;
      }

      try {
        // Verify JWT token from cookie
        const decoded = jwt.verify(
          cookieJwtToken,
          'istack-buddy-secret-key-2024',
        ) as any;
        const userId = decoded.userId;

        // Authenticate the user using the authentication service
        const authResult = await this.authService.authenticateUser(
          userId,
          cookieJwtToken,
        );
        if (!authResult.success) {
          res.status(401).send('Invalid JWT token in cookie');
          return;
        }
      } catch (error) {
        this.logger.error('JWT authentication error:', error);
        res.status(401).send('Invalid JWT token in cookie');
        return;
      }

      // Validate that the conversation exists (sessionId = conversationId)
      const conversations = await this.chatManagerService.getConversations();
      const conversation = conversations.find(
        (conv) => conv.id === conversationId,
      );
      if (!conversation) {
        res.status(404).send('Session not found');
        return;
      }

      // Validate that the conversation has the correct formId
      if (
        !this.chatManagerService.validateConversationFormId(
          conversationId,
          formId,
        )
      ) {
        res.status(400).json({ message: 'Session and formId mismatch' });
        return;
      }

      // Serve the static Next.js app
      const fs = require('fs');
      const path = require('path');

      try {
        const staticFilePath = path.join(
          __dirname,
          '../../../public-content/form-marv/public/form-marv/[session-token]/[formId]/index.html',
        );
        const staticContent = fs.readFileSync(staticFilePath, 'utf8');

        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.send(staticContent);
      } catch (error) {
        this.logger.error('Error serving static app:', error);
        res.status(500).send('Error loading application');
      }
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  }

  @Get('/form-marv/:conversationId/:formId/chat-messages')
  @UseGuards(AuthPermissionGuard)
  @RequirePermissions('cx-agent:form-marv:read')
  async getChatMessages(
    @Param('conversationId') conversationId: string,
    @Param('formId') formId: string,
    @Req() req: any,
    @Query('dtSinceMs') dtSinceMs?: string,
  ): Promise<any[]> {
    try {
      // Validate that the conversation exists and has the correct formId
      if (
        !this.chatManagerService.validateConversationFormId(
          conversationId,
          formId,
        )
      ) {
        throw new Error('Session not found or form ID does not match');
      }

      // Get messages from the conversation (conversationId is the conversation ID)
      const messages = await this.chatManagerService.getMessages(
        conversationId,
        {
          limit: 100,
          offset: 0,
        },
      );

      return messages;
    } catch (error) {
      this.logger.error('Error getting chat messages:', error);
      return [];
    }
  }

  @Post('/form-marv/:conversationId/:formId/chat-messages')
  @UseGuards(AuthPermissionGuard)
  @RequirePermissions('cx-agent:form-marv:write')
  async postChatMessage(
    @Param('conversationId') conversationId: string,
    @Param('formId') formId: string,
    @Body() messageData: any,
    @Req() req: any,
  ): Promise<{ success: boolean; messageId?: string }> {
    try {
      // Validate that the conversation exists and has the correct formId
      if (
        !this.chatManagerService.validateConversationFormId(
          conversationId,
          formId,
        )
      ) {
        return { success: false };
      }

      // Add message to conversation and trigger robot response
      const userMessage =
        await this.chatManagerService.addMessageFromMarvSession(
          conversationId,
          { type: 'text', payload: messageData.content || messageData.message },
        );

      return { success: true, messageId: userMessage.id };
    } catch (error) {
      this.logger.error('Error posting chat message:', error);
      return { success: false };
    }
  }

  @Get('/form-marv/:conversationId/:formId/formJson')
  @UseGuards(AuthPermissionGuard)
  @RequirePermissions('cx-agent:form-marv:read')
  async getFormJson(
    @Param('conversationId') conversationId: string,
    @Param('formId') formId: string,
    @Req() req: any,
  ): Promise<any> {
    try {
      // Validate that the conversation exists and has the correct formId
      if (
        !this.chatManagerService.validateConversationFormId(
          conversationId,
          formId,
        )
      ) {
        throw new Error('Session not found or form ID does not match');
      }

      // Get form JSON using the fsApiClient
      const formJsonResponse = await fsApiClient.getFormJson(formId);
      
      if (!formJsonResponse.isSuccess) {
        throw new Error(
          formJsonResponse.errorItems?.join(', ') || 'Failed to get form JSON',
        );
      }

      return formJsonResponse.response;
    } catch (error) {
      this.logger.error('Error getting form JSON:', error);
      throw error;
    }
  }
}
