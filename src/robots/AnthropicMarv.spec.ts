import { AnthropicMarv } from './AnthropicMarv';
import { IConversationMessage } from '../chat-manager/interfaces/message.interface';
import { TConversationMessageContentString } from './types';
import { UserRole, MessageType } from '../chat-manager/dto/create-message.dto';

describe('AnthropicMarv', () => {
  let robot: AnthropicMarv;

  beforeEach(() => {
    robot = new AnthropicMarv();
  });

  it('estimates tokens ~ length/4', () => {
    expect(robot.estimateTokens('abcd')).toBe(1);
    expect(robot.estimateTokens('abcdefgh')).toBe(2);
  });

  it('acceptMessageImmediateResponse composes content from streaming callbacks', async () => {
    const message: IConversationMessage<TConversationMessageContentString> = {
      id: 'id-1',
      conversationId: 'conv-1',
      authorUserId: 'u1',
      fromRole: UserRole.CUSTOMER,
      toRole: UserRole.AGENT,
      messageType: MessageType.TEXT,
      content: { type: 'text/plain', payload: 'Hello' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Spy on streaming method to simulate chunks
    const spy = jest
      .spyOn(robot as any, 'acceptMessageStreamResponse')
      .mockImplementation(async (_msg, callbacks: any) => {
        callbacks.onStreamStart?.(message);
        callbacks.onStreamChunkReceived?.('Part1 ');
        callbacks.onStreamChunkReceived?.('Part2');
        callbacks.onStreamFinished?.(message as any);
      });

    const result = await robot.acceptMessageImmediateResponse(message);
    expect(result.content.type).toBe('text/plain');
    expect(result.content.payload).toBe('Part1 Part2');

    spy.mockRestore();
  });

  it('acceptMessageStreamResponse calls onError when client fails (env missing)', async () => {
    const errSpy = jest.fn();
    const msg: IConversationMessage<TConversationMessageContentString> = {
      id: 'id-1',
      conversationId: 'conv-1',
      authorUserId: 'u1',
      fromRole: UserRole.CUSTOMER,
      toRole: UserRole.AGENT,
      messageType: MessageType.TEXT,
      content: { type: 'text/plain', payload: 'Hello' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Ensure env key is not present
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    await robot.acceptMessageStreamResponse(msg, {
      onStreamChunkReceived: jest.fn(),
      onStreamStart: jest.fn(),
      onStreamFinished: jest.fn(),
      onFullMessageReceived: jest.fn(),
      onError: errSpy,
    });

    expect(errSpy).toHaveBeenCalled();
    // restore
    if (original) process.env.ANTHROPIC_API_KEY = original;
  });
});
