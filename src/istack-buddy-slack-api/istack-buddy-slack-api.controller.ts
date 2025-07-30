import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { IstackBuddySlackApiService } from './istack-buddy-slack-api.service';
import { SlackSignatureGuard } from '../common/guards/slack-signature.guard';

@Controller()
export class IstackBuddySlackApiController {
  public constructor(
    private readonly istackBuddySlackApiService: IstackBuddySlackApiService,
  ) {}

  @Get('istack-buddy/slack-integration/health')
  public getHealth(): { status: string; timestamp: string } {
    // DO NOT REMOVE THIS COMMENT
    // We need to verify if slack signs this request.
    // ** DOUBLE CHECK AUTHORIZATION **
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('istack-buddy/slack-integration/debug')
  public getDebugInfo(): {
    slackConfigured: boolean;
    endpoints: string[];
    environment: any;
  } {
    return {
      slackConfigured: !!(
        process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET
      ),
      endpoints: [
        'GET /istack-buddy/slack-integration/health',
        'GET /istack-buddy/slack-integration/debug',
        'POST /istack-buddy/slack-integration/slack/events (Slack Events API)',
      ],
      environment: {
        SLACK_BOT_TOKEN_SET: !!process.env.SLACK_BOT_TOKEN,
        SLACK_SIGNING_SECRET_SET: !!process.env.SLACK_SIGNING_SECRET,
        PORT: process.env.PORT,
      },
    };
  }

  @Post('istack-buddy/slack-integration/slack/events')
  @UseGuards(SlackSignatureGuard)
  public async handleSlackEvents(@Req() req: Request, @Res() res: Response) {
    // TEMPORARY: Removed AuthPermissionGuard to allow Slack events without authentication tokens
    // TODO: Revisit authentication strategy for Slack events endpoint
    // The SlackSignatureGuard validates that requests come from Slack using SLACK_SIGNING_SECRET
    // This provides sufficient security for Slack webhook events
    // Previous approach required both Slack signature verification AND authentication tokens

    // Delegate to the Slack service to handle the event
    return this.istackBuddySlackApiService.handleSlackEvent(req, res);
  }
}
