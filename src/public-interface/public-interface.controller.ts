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
import { MessageType, UserRole } from '../chat-manager/dto/create-message.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuthPermissionGuard } from '../common/guards/auth-permission.guard';
import { RobotService } from '../robots/robot.service';
import { UserProfileService } from '../user-profile/user-profile.service';

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

  @Get('/form-marv')
  async handleFormMarvRoot(@Res() res: Response): Promise<void> {
    res.status(404).send('Form ID is required in the URL path');
  }

  @Get('/form-marv/debug-create')
  async createFormMarvSession(
    @Res() res: Response,
    @Req() req: any,
    @Query('formId') formId?: string,
  ): Promise<void> {
    try {
      // Validate formId parameter - must be present and numeric
      if (!formId) {
        res.status(400).send('formId parameter is required');
        return;
      }

      // Check if formId is numeric
      if (!/^\d+$/.test(formId)) {
        res.status(400).send('formId must be numeric');
        return;
      }

      // Generate a unique user ID for this session
      const userId = `form-marv-temp-${Date.now()}`;

      // Create a temporary user profile for form-marv sessions
      const tempUserProfile = {
        email: `form-marv-${Date.now()}@example.com`,
        username: userId,
        account_type_informal: 'TEMPORARY',
        first_name: 'Form',
        last_name: 'Marv',
      };

      // Let UserProfileService create the user
      this.userProfileService.addTemporaryUser(userId, tempUserProfile);

      // Create a JWT token for the temporary user
      const jwtToken = jwt.sign(
        {
          userId: userId,
          email: tempUserProfile.email,
          username: tempUserProfile.username,
          accountType: 'TEMPORARY',
        },
        'istack-buddy-secret-key-2024',
        { expiresIn: '8h' },
      );

      // Add user to permissions system
      this.authPermissionsService.addUser(
        userId,
        ['cx-agent:form-marv:read', 'cx-agent:form-marv:write'],
        [],
      );

      // Let ChatManagerService create the conversation and generate the conversation ID
      const conversation = await this.chatManagerService.startConversation({
        createdBy: userId,
        createdByRole: UserRole.CUSTOMER,
        title: 'Form Marv Conversation',
        description: `Form Marv conversation for form ${formId || '5375703'}`,
        initialParticipants: [userId],
      });

      // Store the formId with the conversation
      this.chatManagerService.setConversationFormId(
        conversation.id,
        formId || '5375703',
      );

      // Add debug messages to conversation
      try {
        await this.chatManagerService.addMessage({
          conversationId: conversation.id,
          fromUserId: userId,
          content: 'DEBUG - User Message II',
          messageType: MessageType.TEXT,
          fromRole: UserRole.CUSTOMER,
          toRole: UserRole.ROBOT,
        });

        await this.chatManagerService.addMessage({
          conversationId: conversation.id,
          fromUserId: 'AnthropicMarv',
          content: 'DEBUG - Conversation Message',
          messageType: MessageType.TEXT,
          fromRole: UserRole.ROBOT,
          toRole: UserRole.CUSTOMER,
        });
        await this.chatManagerService.addMessage({
          conversationId: conversation.id,
          fromUserId: 'AnthropicMarv',
          content: 'DEBUG - Conversation Message II',
          messageType: MessageType.TEXT,
          fromRole: UserRole.ROBOT,
          toRole: UserRole.CUSTOMER,
        });

        // demonstrate callback usage here
        const callbacks = this.chatManagerService.createConversationCallbacks(
          conversation.id,
        );

        // Demonstrate each callback being called
        await callbacks.onStreamStart({} as any);
        await callbacks.onStreamChunkReceived('test chunk');
        await callbacks.onStreamFinished('test content', 'assistant');
        await callbacks.onFullMessageReceived('test full message');
        await callbacks.onError(new Error('test error'));
      } catch (error) {
        console.error('Failed to add debug messages:', error);
      }

      const baseUrl = this.getBaseUrl();
      const link = `${baseUrl}/public/form-marv/${conversation.id}/${formId || '5375703'}?jwtToken=${jwtToken}`;

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Form Marv Session Created</title>
</head>
<body>
    <h1>Form Marv Session Created</h1>
    <p><strong>Conversation ID:</strong> ${conversation.id}</p>
    <p><strong>User ID:</strong> ${userId}</p>
    <p><strong>Form ID:</strong> ${formId || '5375703'}</p>
    <p><strong>JWT Token:</strong> ${jwtToken}</p>
    <p><strong>Link:</strong> <a href="${link}">${link}</a></p>
    <p><strong>Chat Messages Endpoint:</strong> ${baseUrl}/public/form-marv/${conversation.id}/${formId || '5375703'}/chat-messages</p>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      res.status(500).send('Error creating session');
    }
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
          console.error('JWT authentication error:', error);
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
        console.error('JWT authentication error:', error);
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
        console.error('Error serving static app:', error);
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
      console.error('Error getting chat messages:', error);
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

      // A) Add message to conversation
      const userMessage = await this.chatManagerService.addMessage({
        conversationId: conversationId,
        fromUserId: 'form-marv-user',
        content: messageData.content || messageData.message,
        messageType: MessageType.TEXT,
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
      });

      // C) Stream robot response via WebSocket and collect full response
      let fullResponse = '';
      console.log(
        `Starting streaming response for conversation: ${conversationId}`,
      );

      // Use conversation manager callbacks directly
      const callbacks =
        this.chatManagerService.createConversationCallbacks(conversationId);

      await this.chatManagerService.handleRobotStreamingResponse(
        conversationId,
        'AnthropicMarv',
        messageData.content || messageData.message,
        callbacks,
      );
      console.log(`Streaming complete. Full response: "${fullResponse}"`);

      // D) Add complete robot response to conversation
      if (fullResponse) {
        const robotMessage = await this.chatManagerService.addMessage({
          conversationId: conversationId,
          fromUserId: 'anthropic-marv-robot',
          content: fullResponse,
          messageType: MessageType.ROBOT,
          fromRole: UserRole.ROBOT,
          toRole: UserRole.CUSTOMER,
        });

        // E) Broadcast completion
        if (this.chatManagerService.getGateway()) {
          this.chatManagerService
            .getGateway()
            .broadcastToConversation(conversationId, 'robot_complete', {
              messageId: robotMessage.id,
            });
        }
      }

      return { success: true, messageId: userMessage.id };
    } catch (error) {
      console.error('Error posting chat message:', error);
      return { success: false };
    }
  }
}
