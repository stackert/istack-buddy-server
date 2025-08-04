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
import { FormMarvSessionService } from './form-marv-session.service';
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

@Controller('public')
export class PublicInterfaceController {
  constructor(
    private readonly formMarvSessionService: FormMarvSessionService,
    private readonly authService: AuthenticationService,
    private readonly authPermissionsService: AuthorizationPermissionsService,
    private readonly chatManagerService: ChatManagerService,
    private readonly robotService: RobotService,
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
      // Create a temporary user profile for form-marv sessions
      const tempUserId = `form-marv-temp-${Date.now()}`;
      const tempUserProfile = {
        userId: tempUserId,
        email: `form-marv-${Date.now()}@example.com`,
        firstName: 'Form',
        lastName: 'Marv',
        groups: ['form-marv-users'],
      };

      // Create a JWT token for the temporary user
      const jwtToken = jwt.sign(
        {
          userId: tempUserId,
          email: `form-marv-${Date.now()}@example.com`,
          username: tempUserId,
          accountType: 'TEMPORARY',
        },
        'istack-buddy-secret-key-2024',
        { expiresIn: '8h' },
      );

      const session = this.formMarvSessionService.createSession(
        formId || '5375703',
      );

      const sessionData = this.formMarvSessionService.getSession(session);
      const conversationId = session; // The session IS the conversation ID

      // Add debug message to conversation
      try {
        await this.chatManagerService.addMessage({
          conversationId: session,
          fromUserId: 'form-marv-system',
          content: 'DEBUG - start of conversation',
          messageType: MessageType.SYSTEM,
          fromRole: UserRole.AGENT,
          toRole: UserRole.CUSTOMER,
        });
      } catch (error) {
        console.error('Failed to add debug message:', error);
      }
      const link = `${req.protocol}://${req.get('host')}/public/form-marv/${session}/${sessionData?.formId}?jwtToken=${sessionData?.jwtToken}`;

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
    <p><strong>Conversation ID:</strong> ${conversationId}</p>
    <p><strong>Form ID:</strong> ${sessionData?.formId}</p>
    <p><strong>JWT Token:</strong> ${sessionData?.jwtToken}</p>
    <p><strong>Link:</strong> <a href="${link}">${link}</a></p>
    <p><strong>Chat Messages Endpoint:</strong> ${req.protocol}://${req.get('host')}/public/form-marv/${conversationId}/${sessionData?.formId}/chat-messages</p>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      res.status(500).send('Error creating session');
    }
  }

  @Get('/form-marv/:conversationId/jwt-token')
  @UseGuards(AuthPermissionGuard)
  @RequirePermissions('cx-agent:form-marv:read')
  async getJwtToken(
    @Param('conversationId') conversationId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const session = this.formMarvSessionService.getSession(conversationId);
      if (!session) {
        res.status(404).json({ error: 'Session not found or expired' });
        return;
      }

      res.json({
        jwtToken: session.jwtToken,
        formId: session.formId,
        userId: session.userId,
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  @Get('/form-marv/:conversationId/session-data')
  @UseGuards(AuthPermissionGuard)
  @RequirePermissions('cx-agent:form-marv:read')
  async getSessionData(
    @Param('conversationId') conversationId: string,
    @Res() res: Response,
    @Req() req: any,
  ): Promise<void> {
    try {
      const session = this.formMarvSessionService.getSession(conversationId);
      if (!session) {
        res.status(404).json({ error: 'Session not found or expired' });
        return;
      }

      res.json({
        conversationId: conversationId,
        formId: session.formId,
        userId: session.userId,
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
        secureUrl: `${req.protocol}://${req.get('host')}/public/form-marv/${conversationId}/${session.formId}?jwtToken=${session.jwtToken}`,
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  @Get('/form-marv/:conversationId/debug-session')
  async debugSession(
    @Param('conversationId') conversationId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const session = this.formMarvSessionService.getSession(conversationId);
      if (!session) {
        res.status(404).json({ error: 'Session not found or expired' });
        return;
      }

      res.json({
        conversationId,
        session,
        exists: true,
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
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
      // If JWT token is provided in query, set it as a cookie and redirect
      if (jwtToken) {
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

      // Check if session exists
      const session = this.formMarvSessionService.getSession(conversationId);
      if (!session) {
        res.status(404).send('Session not found or expired');
        return;
      }

      // Validate that the formId in the URL matches the session's formId
      if (session.formId !== formId) {
        res.status(401).send('Invalid form ID for this session');
        return;
      }

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
    <p>Your session is active and ready for formId: ${session.formId}</p>
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
