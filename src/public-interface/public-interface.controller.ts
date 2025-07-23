import {
  Controller,
  Get,
  Param,
  Res,
  Query,
  UseGuards,
  Req,
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

  @Get('/form-marv/:secretKey')
  async serveFormMarvContent(
    @Param('secretKey') secretKey: string,
    @Query('jwtToken') jwtToken: string,
    @Res() res: Response,
    @Req() req: any,
  ): Promise<void> {
    // Return 401 for root path - formId is required
    res.status(401).send('Form ID is required in the URL path');
  }

  @Get('/form-marv/:secretKey/:formId')
  async serveFormMarvContentWithFormId(
    @Param('secretKey') secretKey: string,
    @Param('formId') formId: string,
    @Query('jwtToken') jwtToken: string,
    @Res() res: Response,
    @Req() req: any,
  ): Promise<void> {
    try {
      // DEBUG: Log cookies for troubleshooting
      console.log(
        'DEBUG serveFormMarvContentWithFormId req.cookies:',
        req.cookies,
      );

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

      // Get JWT token from cookies
      const jwtTokenFromCookie = req.cookies?.jwtToken;

      // If JWT token is provided in cookie, validate it first
      if (jwtTokenFromCookie) {
        const isCookieTokenValid = await this.authService.isUserAuthenticated(
          session.userId,
          jwtTokenFromCookie,
        );
        if (!isCookieTokenValid) {
          res.status(401).send('Invalid or expired authentication token');
          return;
        }
      }

      // Use the token from cookie if provided and valid, otherwise use session token
      const tokenToUse = jwtTokenFromCookie || session.jwtToken;

      try {
        // Verify the token and check if user has the required permission
        const isAuthenticated = await this.authService.isUserAuthenticated(
          session.userId,
          tokenToUse,
        );
        if (!isAuthenticated) {
          res.status(401).send('Invalid or expired authentication token');
          return;
        }

        // Verify the user has the required permission
        const hasPermission = await this.authPermissionsService.hasPermission(
          session.userId,
          'cx-agent:form-marv:read',
        );
        if (!hasPermission) {
          res
            .status(403)
            .send(
              'Access denied. Required permissions: cx-agent:form-marv:read',
            );
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
      } catch (authError) {
        res.status(401).send('Authentication failed');
      }
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  }
}
