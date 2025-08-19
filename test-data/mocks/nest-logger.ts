import { Logger } from '@nestjs/common';

export type MockNestLogger = jest.Mocked<Logger>;

export const mockNestLogger: MockNestLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

export const mockNestLoggerProvider = {
  provide: Logger,
  useValue: mockNestLogger,
};

export const resetNestLoggerMocks = () => {
  mockNestLogger.log.mockClear();
  mockNestLogger.error.mockClear();
  mockNestLogger.warn.mockClear();
  mockNestLogger.debug.mockClear();
  mockNestLogger.verbose.mockClear();
};

export const expectNestLoggerCalled = (
  method: keyof MockNestLogger,
  expectedMessage: string | RegExp,
): void => {
  if (typeof expectedMessage === 'string') {
    expect(mockNestLogger[method]).toHaveBeenCalledWith(expectedMessage);
  } else {
    expect(mockNestLogger[method]).toHaveBeenCalledWith(
      expect.stringMatching(expectedMessage),
    );
  }
};

export const expectNestLoggerCalledWithContext = (
  message: string | RegExp,
  context: string,
): void => {
  expect(mockNestLogger.log).toHaveBeenCalledWith(
    expect.stringMatching(message),
    context,
  );
};
