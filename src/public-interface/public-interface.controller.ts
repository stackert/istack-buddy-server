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
import * as path from 'path';
import * as fs from 'fs';

@Controller('public')
export class PublicInterfaceController {
  constructor(
    private readonly formMarvSessionService: FormMarvSessionService,
    private readonly authService: AuthenticationService,
    private readonly authPermissionsService: AuthorizationPermissionsService,
  ) {}

  @Get('/')
  @UseGuards(AuthPermissionGuard)
  @RequirePermissions('cx-agent:form-marv:read')
  async serveRootContent(@Res() res: Response): Promise<void> {
    try {
      const filePath = path.join(
        process.cwd(),
        'public-content',
        'hello-world.html',
      );
      const content = fs.readFileSync(filePath, 'utf8');
      res.setHeader('Content-Type', 'text/html');
      res.send(content);
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  }

  @Get('/form-marv')
  async handleFormMarvRoot(@Res() res: Response): Promise<void> {
    res.status(404).send('Not Found');
  }

  @Get('/form-marv/debug-create')
  async createFormMarvSession(
    @Res() res: Response,
    @Req() req: any,
  ): Promise<void> {
    try {
      const secretKey = this.formMarvSessionService.createSession();
      const session = this.formMarvSessionService.getSession(secretKey);
      if (!session) {
        res.status(500).send('Failed to create session');
        return;
      }

      const link = `${req.protocol}://${req.get('host')}/public/form-marv/${secretKey}/${session.formId}?jwtToken=${session.jwtToken}`;

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Form Marv Session Created</title>
</head>
<body>
    <h1>Thank you!</h1>
    <p>Your form session has been created successfully.</p>
    <p>Form ID: ${session.formId}</p>
    <p>Here is your link: <a href="${link}">${link}</a></p>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  }

  @Get('/form-marv/:secretKey/debug-session')
  async debugSession(
    @Param('secretKey') secretKey: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const session = this.formMarvSessionService.getSession(secretKey);

      if (!session) {
        res.status(404).json({
          error: 'Session not found',
          secretKey: secretKey,
          message: 'No session exists for the provided secret key',
        });
        return;
      }

      // Return the complete session data as JSON
      res.setHeader('Content-Type', 'application/json');
      res.json({
        secretKey: secretKey,
        sessionData: session,
        timestamp: new Date().toISOString(),
        note: 'This is debug information for development purposes only',
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message || 'An unexpected error occurred',
      });
    }
  }

  @Get('/form-marv/:secretKey')
  async serveFormMarvContent(
    @Param('secretKey') secretKey: string,
    @Res() res: Response,
    @Req() req: any,
  ): Promise<void> {
    // Return 401 for root path - formId is required
    res.status(401).send('Form ID is required in the URL path');
  }

  @Get('/form-marv/:secretKey/:formId')
  @UseGuards(AuthPermissionGuard)
  @RequirePermissions('cx-agent:form-marv:read')
  async serveFormMarvContentWithFormId(
    @Param('secretKey') secretKey: string,
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
        res.redirect(`/public/form-marv/${secretKey}/${formId}`);
        return;
      }

      // Check if session exists
      const session = this.formMarvSessionService.getSession(secretKey);
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

  @Get('/form-marv/:secretKey/:formId/chat-messages')
  @UseGuards(AuthPermissionGuard)
  @RequirePermissions('cx-agent:form-marv:read')
  async getChatMessages(
    @Param('secretKey') secretKey: string,
    @Param('formId') formId: string,
    @Req() req: any,
    @Query('dtSinceMs') dtSinceMs?: string,
  ): Promise<any[]> {
    // For now, return empty array
    return [];
  }

  @Post('/form-marv/:secretKey/:formId/chat-messages')
  @UseGuards(AuthPermissionGuard)
  @RequirePermissions('cx-agent:form-marv:write')
  async postChatMessage(
    @Param('secretKey') secretKey: string,
    @Param('formId') formId: string,
    @Body() messageData: any,
    @Req() req: any,
  ): Promise<{ success: boolean; messageId?: string }> {
    // For now, return success with a placeholder messageId
    return {
      success: true,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }
}
