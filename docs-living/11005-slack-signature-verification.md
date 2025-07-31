# Slack Signature Verification

## Overview

The Slack events endpoint (`/istack-buddy/slack-integration/slack/events`) now implements proper signature verification to ensure requests actually come from Slack.

## Implementation Details

### 1. SlackSignatureGuard

- **Location**: `src/common/guards/slack-signature.guard.ts`
- **Purpose**: Validates Slack request signatures using the `SLACK_SIGNING_SECRET`
- **Applied to**: Slack events endpoint via `@UseGuards(SlackSignatureGuard)`

### 2. Security Features

#### Signature Verification

- Uses HMAC-SHA256 to verify request signatures
- Compares received signature with expected signature
- Format: `v0=<signature>`

#### Timestamp Validation

- Prevents replay attacks by checking request timestamp
- Allows requests within ±5 minutes of current time
- Uses `x-slack-request-timestamp` header

#### Required Headers

- `x-slack-signature`: The HMAC signature
- `x-slack-request-timestamp`: Unix timestamp of request

### 3. Environment Configuration

```bash
# Required in .env.live
SLACK_SIGNING_SECRET=your_slack_signing_secret_here
```

### 4. Fallback Behavior

- If `SLACK_SIGNING_SECRET` is not configured, signature verification is skipped
- Logs a warning but allows the request to proceed
- This enables development without requiring the secret

### 5. Error Handling

The guard throws `UnauthorizedException` for:

- Missing raw body (required for signature calculation)
- Missing Slack signature headers
- Timestamp too old (>5 minutes)
- Invalid signature

### 6. Logging

Comprehensive logging for security events:

- Successful signature verification
- Failed verification attempts with details
- Missing headers or configuration issues

## Testing

Run the test suite:

```bash
npm test -- --testPathPattern=slack-signature.guard.spec.ts
```

Tests cover:

- Valid signature verification
- Invalid signatures
- Missing headers
- Timestamp validation
- Configuration fallbacks

## Integration

The guard is automatically applied to the Slack events endpoint:

```typescript
@Post('istack-buddy/slack-integration/slack/events')
@UseGuards(SlackSignatureGuard)
public async handleSlackEvents(@Req() req: Request, @Res() res: Response) {
  // Only reached if signature verification passes
}
```

## Security Benefits

1. **Request Origin Verification**: Ensures requests come from Slack
2. **Replay Attack Prevention**: Timestamp validation prevents old requests
3. **Data Integrity**: Signature verification ensures request body hasn't been tampered with
4. **Audit Trail**: Comprehensive logging for security monitoring

## Configuration in Slack App

Make sure your Slack app has:

1. **Signing Secret** configured in the app settings
2. **Event Subscriptions** pointing to your endpoint
3. **Request URL** verified with Slack

The signing secret from your Slack app settings should match the `SLACK_SIGNING_SECRET` environment variable.
