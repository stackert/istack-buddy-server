import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { createHmac } from 'crypto';

@Injectable()
export class SlackSignatureGuard implements CanActivate {
  private readonly logger = new Logger(SlackSignatureGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Skip verification if no signing secret is configured
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (!signingSecret) {
      this.logger.warn(
        'SLACK_SIGNING_SECRET not configured, skipping signature verification',
      );
      return true;
    }

    // Get the raw body that was captured in main.ts
    const rawBody = request.rawBody;
    if (!rawBody) {
      this.logger.error('Raw body not available for signature verification');
      throw new UnauthorizedException('Invalid request signature');
    }

    // Get Slack signature headers
    const slackSignature = request.headers['x-slack-signature'];
    const slackTimestamp = request.headers['x-slack-request-timestamp'];

    if (!slackSignature || !slackTimestamp) {
      this.logger.error('Missing Slack signature headers', {
        hasSignature: !!slackSignature,
        hasTimestamp: !!slackTimestamp,
      });
      throw new UnauthorizedException('Missing Slack signature headers');
    }

    // Verify timestamp is within 5 minutes (replay attack protection)
    const currentTime = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(slackTimestamp, 10);
    const timeDiff = Math.abs(currentTime - requestTime);

    if (timeDiff > 300) {
      // 5 minutes = 300 seconds
      this.logger.error('Request timestamp too old', {
        currentTime,
        requestTime,
        timeDiff,
      });
      throw new UnauthorizedException('Request timestamp too old');
    }

    // Create the signature base string
    const signatureBase = `v0:${slackTimestamp}:${rawBody}`;

    // Create the expected signature
    const expectedSignature =
      'v0=' +
      createHmac('sha256', signingSecret).update(signatureBase).digest('hex');

    // Compare signatures
    if (slackSignature !== expectedSignature) {
      this.logger.error('Invalid Slack signature', {
        received: slackSignature,
        expected: expectedSignature,
        timestamp: slackTimestamp,
      });
      throw new UnauthorizedException('Invalid request signature');
    }

    this.logger.log('Slack signature verified successfully');

    // Set the authenticated user for Slack service
    request.user = {
      userId: 'slack-integration-internal-user',
      email: 'slack-service@istack-buddy.com',
      username: 'slack-integration-internal-user',
      accountType: 'SERVICE',
    };

    return true;
  }
}
