import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SlackSignatureGuard } from './slack-signature.guard';
import { createHmac } from 'crypto';

describe('SlackSignatureGuard', () => {
  let guard: SlackSignatureGuard;
  let mockExecutionContext: ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SlackSignatureGuard],
    }).compile();

    guard = module.get<SlackSignatureGuard>(SlackSignatureGuard);
  });

  beforeEach(() => {
    // Mock execution context
    mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          rawBody: Buffer.from('{"test":"data"}'),
          headers: {},
        }),
      }),
    } as ExecutionContext;
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.SLACK_SIGNING_SECRET;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow requests when SLACK_SIGNING_SECRET is not configured', () => {
    const result = guard.canActivate(mockExecutionContext);
    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException when raw body is missing', () => {
    process.env.SLACK_SIGNING_SECRET = 'test-secret';

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          rawBody: null,
          headers: {},
        }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when Slack signature headers are missing', () => {
    process.env.SLACK_SIGNING_SECRET = 'test-secret';

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          rawBody: Buffer.from('{"test":"data"}'),
          headers: {},
        }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when timestamp is too old', () => {
    process.env.SLACK_SIGNING_SECRET = 'test-secret';

    const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 6+ minutes old

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          rawBody: Buffer.from('{"test":"data"}'),
          headers: {
            'x-slack-signature': 'v0=test',
            'x-slack-request-timestamp': oldTimestamp.toString(),
          },
        }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when signature is invalid', () => {
    process.env.SLACK_SIGNING_SECRET = 'test-secret';

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = '{"test":"data"}';

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          rawBody: Buffer.from(body),
          headers: {
            'x-slack-signature': 'v0=invalid-signature',
            'x-slack-request-timestamp': timestamp,
          },
        }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
  });

  it('should allow requests with valid signature', () => {
    process.env.SLACK_SIGNING_SECRET = 'test-secret';

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = '{"test":"data"}';

    // Generate valid signature
    const signatureBase = `v0:${timestamp}:${body}`;
    const validSignature =
      'v0=' +
      createHmac('sha256', 'test-secret').update(signatureBase).digest('hex');

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          rawBody: Buffer.from(body),
          headers: {
            'x-slack-signature': validSignature,
            'x-slack-request-timestamp': timestamp,
          },
        }),
      }),
    } as ExecutionContext;

    const result = guard.canActivate(mockContext);
    expect(result).toBe(true);
  });

  it('should handle future timestamps within acceptable range', () => {
    process.env.SLACK_SIGNING_SECRET = 'test-secret';

    const timestamp = Math.floor(Date.now() / 1000) + 60; // 1 minute in future
    const body = '{"test":"data"}';

    // Generate valid signature
    const signatureBase = `v0:${timestamp}:${body}`;
    const validSignature =
      'v0=' +
      createHmac('sha256', 'test-secret').update(signatureBase).digest('hex');

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          rawBody: Buffer.from(body),
          headers: {
            'x-slack-signature': validSignature,
            'x-slack-request-timestamp': timestamp.toString(),
          },
        }),
      }),
    } as ExecutionContext;

    const result = guard.canActivate(mockContext);
    expect(result).toBe(true);
  });
});
