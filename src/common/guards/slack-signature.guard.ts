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

    // DEBUG: Log all request details for debugging
    this.logger.log('=== SLACK SIGNATURE GUARD DEBUG ===');
    this.logger.log(`URL: ${request.method} ${request.url}`);
    this.logger.log(`Headers: ${JSON.stringify(request.headers, null, 2)}`);
    this.logger.log(`Raw body available: ${!!request.rawBody}`);
    this.logger.log(`Raw body string available: ${!!request.rawBodyString}`);
    this.logger.log(`Body keys: ${Object.keys(request.body || {})}`);
    this.logger.log('===================================');

    // Skip verification if no signing secret is configured
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (!signingSecret) {
      this.logger.warn(
        'SLACK_SIGNING_SECRET not configured, skipping signature verification',
      );
      return true;
    }

    // TEMPORARY: Skip signature verification in development for debugging
    const isDevelopment = process.env.NODE_ENV !== 'production';
    if (
      isDevelopment &&
      process.env.SKIP_SLACK_SIGNATURE_VERIFICATION === 'true'
    ) {
      this.logger.warn(
        'DEVELOPMENT MODE: Skipping Slack signature verification',
      );
      return true;
    }

    // Get the raw body that was captured in main.ts
    const rawBody = request.rawBody;
    if (!rawBody) {
      this.logger.error('Raw body not available for signature verification');
      this.logger.error(
        'This usually means the raw body middleware in main.ts is not working properly',
      );

      // TEMPORARY: Allow through in development if raw body is missing
      if (isDevelopment) {
        this.logger.warn(
          'DEVELOPMENT MODE: Allowing request through despite missing raw body',
        );
        return true;
      }

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
