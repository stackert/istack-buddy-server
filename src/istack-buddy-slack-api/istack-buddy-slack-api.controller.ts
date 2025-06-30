import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { IstackBuddySlackApiService } from './istack-buddy-slack-api.service';

@Controller()
export class IstackBuddySlackApiController {
  constructor(
    private readonly istackBuddySlackApiService: IstackBuddySlackApiService,
  ) {}

  @Get('istack-buddy/slack-integration/health')
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('istack-buddy/slack-integration/debug')
  getDebugInfo(): {
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
  async handleSlackEvents(@Req() req: Request, @Res() res: Response) {
    // Delegate to the Slack service to handle the event
    return this.istackBuddySlackApiService.handleSlackEvent(req, res);
  }
}
