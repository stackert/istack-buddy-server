/**
 * Reusable mocks for Slack events and API responses
 */

export const mockSlackEvents = {
  // Basic Slack event structure
  appMention: (text: string = 'test message', options: Partial<any> = {}) => ({
    type: 'app_mention',
    text,
    ts: '1234567890.123456',
    user: 'test-user',
    channel: 'test-channel',
    ...options,
  }),

  message: (text: string = 'test message', options: Partial<any> = {}) => ({
    type: 'message',
    text,
    ts: '1234567890.123456',
    thread_ts: '1234567890.123455',
    user: 'test-user',
    channel: 'test-channel',
    ...options,
  }),

  // URL verification challenge
  urlVerification: (challenge: string = 'test-challenge') => ({
    challenge,
  }),

  // Request/response objects
  request: (event: any, eventId: string = 'test-event-id') => ({
    body: {
      event,
      event_id: eventId,
    },
  }),

  response: () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  }),
};

export const mockSlackApiResponses = {
  // Successful API responses
  success: (data: any = {}) => ({
    ok: true,
    ...data,
  }),

  // Error responses
  error: (error: string = 'invalid_auth') => ({
    ok: false,
    error,
    warning: 'missing_charset',
    response_metadata: {
      warnings: ['missing_charset'],
    },
  }),

  // Conversation creation response
  conversationCreated: (id: string = 'test-conversation-id') => ({
    id,
    createdBy: 'test-user',
    createdByRole: 'cx-customer',
    title: 'Slack Channel Conversation',
    description: 'Slack conversation from channel mention',
    initialParticipants: ['test-user'],
  }),
};

export const mockSlackServiceMethods = {
  // Mock service methods that are commonly used
  sendSlackMessage: jest.fn().mockResolvedValue(undefined),
  addSlackReaction: jest.fn().mockResolvedValue(undefined),
  getOrCreateConversation: jest.fn().mockResolvedValue({
    internalConversationId: 'test-conversation-id',
    slackConversationId: '1234567890.123456',
    sendConversationResponseToSlack: jest.fn(),
  }),
};

export const resetSlackMocks = () => {
  Object.values(mockSlackServiceMethods).forEach((method) => {
    if (jest.isMockFunction(method)) {
      method.mockClear();
    }
  });
};
