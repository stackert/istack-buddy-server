import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  Body,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthPermissionGuard } from '../common/guards/auth-permission.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuthenticationService } from '../authentication/authentication.service';
import { AuthorizationPermissionsService } from '../authorization-permissions/authorization-permissions.service';
import { ChatManagerService } from '../chat-manager/chat-manager.service';
import { RobotService } from '../robots/robot.service';
import {
  CreateMessageDto,
  MessageType,
  UserRole,
} from '../chat-manager/dto/create-message.dto';
import { AnthropicMarv } from '../robots/AnthropicMarv';
import * as path from 'path';
import * as fs from 'fs';
import * as jwt from 'jsonwebtoken';
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

      // Add debug message to conversation
      try {
        await this.chatManagerService.addMessage({
          conversationId: conversation.id,
          fromUserId: 'form-marv-system',
          content: 'DEBUG - start of conversation',
          messageType: MessageType.SYSTEM,
          fromRole: UserRole.AGENT,
          toRole: UserRole.CUSTOMER,
        });
      } catch (error) {
        console.error('Failed to add debug message:', error);
      }

      const link = `${req.protocol}://${req.get('host')}/public/form-marv/${conversation.id}/${formId || '5375703'}?jwtToken=${jwtToken}`;

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
    <p><strong>Chat Messages Endpoint:</strong> ${req.protocol}://${req.get('host')}/public/form-marv/${conversation.id}/${formId || '5375703'}/chat-messages</p>
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
  @UseGuards(AuthPermissionGuard)
  @RequirePermissions('cx-agent:form-marv:read')
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
        // Authenticate the user using the authentication service
        const authResult = await this.authService.authenticateUser(
          conversationId,
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

        // Redirect to the same URL without the jwtToken query parameter
        res.redirect(`/public/form-marv/${conversationId}/${formId}`);
        return;
      }

      // For subsequent requests, the JWT token should be in the cookie
      // The AuthPermissionGuard will handle authentication using the cookie
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Forms Marv</title>
</head>
<body>
    <h1>Welcome to Forms Marv!</h1>
    <p>Your session is active and ready for formId: ${formId}</p>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
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
      // A) Add message to conversation
      const userMessage = await this.chatManagerService.addMessage({
        conversationId: conversationId,
        fromUserId: 'form-marv-user',
        content: messageData.content || messageData.message,
        messageType: MessageType.TEXT,
        fromRole: UserRole.CUSTOMER,
        toRole: UserRole.AGENT,
      });

      // B) Send to robot (AnthropicMarv)
      const robot =
        this.robotService.getRobotByName<AnthropicMarv>('AnthropicMarv');
      if (robot) {
        const messageEnvelope = {
          messageId: `msg-${Date.now()}`,
          requestOrResponse: 'request' as const,
          envelopePayload: {
            messageId: `msg-${Date.now()}`,
            author_role: 'user',
            content: {
              type: 'text/plain' as const,
              payload: messageData.content || messageData.message,
            },
            created_at: new Date().toISOString(),
            estimated_token_count: 50,
          },
        };

        // C) Get robot response and add to conversation
        const robotResponse =
          await robot.acceptMessageImmediateResponse(messageEnvelope);

        if (robotResponse && robotResponse.envelopePayload.content.payload) {
          await this.chatManagerService.addMessage({
            conversationId: conversationId,
            fromUserId: 'anthropic-marv-robot',
            content: robotResponse.envelopePayload.content.payload,
            messageType: MessageType.ROBOT,
            fromRole: UserRole.ROBOT,
            toRole: UserRole.CUSTOMER,
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
