/**
 * Reusable logger mocks for testing
 */

export interface MockLoggerService {
  log: jest.MockedFunction<any>;
  error: jest.MockedFunction<any>;
  warn: jest.MockedFunction<any>;
  debug: jest.MockedFunction<any>;
  logWithContext: jest.MockedFunction<any>;
}

/**
 * Create a mock logger service
 */
export const createMockLogger = (): MockLoggerService => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  logWithContext: jest.fn(),
});

/**
 * Pre-configured mock logger instance
 */
export const mockLogger = createMockLogger();

/**
 * Mock logger service provider for NestJS testing
 */
export const mockLoggerProvider = {
  provide: 'CustomLoggerService',
  useValue: mockLogger,
};

/**
 * Reset all logger mocks
 */
export const resetLoggerMocks = (): void => {
  mockLogger.log.mockClear();
  mockLogger.error.mockClear();
  mockLogger.warn.mockClear();
  mockLogger.debug.mockClear();
  mockLogger.logWithContext.mockClear();
};

/**
 * Setup logger mock implementations for common patterns
 */
export const setupLoggerMockImplementations = (): void => {
  // Most tests just need these to not throw
  mockLogger.log.mockImplementation(() => {});
  mockLogger.error.mockImplementation(() => {});
  mockLogger.warn.mockImplementation(() => {});
  mockLogger.debug.mockImplementation(() => {});
  mockLogger.logWithContext.mockImplementation(() => {});
};

/**
 * Assert logger was called with specific message
 */
export const expectLoggerCalled = (
  method: keyof MockLoggerService,
  expectedMessage: string | RegExp,
): void => {
  if (typeof expectedMessage === 'string') {
    expect(mockLogger[method]).toHaveBeenCalledWith(expectedMessage);
  } else {
    expect(mockLogger[method]).toHaveBeenCalledWith(
      expect.stringMatching(expectedMessage),
    );
  }
};

/**
 * Assert logger was called with specific message and context
 */
export const expectLoggerCalledWithContext = (
  expectedMessage: string,
  expectedContext?: any,
): void => {
  if (expectedContext) {
    expect(mockLogger.logWithContext).toHaveBeenCalledWith(
      'log',
      expectedMessage,
      expect.any(String),
      undefined,
      expectedContext,
    );
  } else {
    expect(mockLogger.logWithContext).toHaveBeenCalledWith(
      'log',
      expectedMessage,
      expect.any(String),
      undefined,
      expect.any(Object),
    );
  }
};

/**
 * Mock specific logger responses for testing error paths
 */
export const mockLoggerResponses = {
  success: () => {
    mockLogger.log.mockReturnValue(undefined);
  },

  error: (error: Error) => {
    mockLogger.error.mockImplementation((message, err) => {
      throw err || error;
    });
  },

  warn: (warning: string) => {
    mockLogger.warn.mockReturnValue(warning);
  },
};
