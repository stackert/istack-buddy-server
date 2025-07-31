import { marvToolSet, FsRestrictedApiRoutesEnum } from './index';
import { performMarvToolCall } from './performMarvToolCall';
import { marvToolDefinitions } from './marvToolDefinitions';

// Mock the performMarvToolCall function
jest.mock('./performMarvToolCall', () => ({
  performMarvToolCall: jest.fn(),
}));

describe('marvToolSet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('toolDefinitions', () => {
    it('should contain all marv tool definitions', () => {
      expect(marvToolSet.toolDefinitions).toBe(marvToolDefinitions);
    });
  });

  describe('executeToolCall', () => {
    it('should execute tool call for valid tool name', async () => {
      const mockResponse = { isSuccess: true, response: { formId: '123' } };
      (performMarvToolCall as jest.Mock).mockResolvedValue(mockResponse);

      const result = await marvToolSet.executeToolCall(
        FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview,
        { formId: '123' },
      );

      expect(performMarvToolCall).toHaveBeenCalledWith(
        FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview,
        { formId: '123' },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should return undefined for tool not in definitions', async () => {
      const result = await marvToolSet.executeToolCall('non-existent-tool', {
        someParam: 'value',
      });

      expect(performMarvToolCall).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should check if tool exists in definitions', async () => {
      // Test with a tool that doesn't exist in marvToolDefinitions
      const result = await marvToolSet.executeToolCall(
        'some-random-tool-name',
        {},
      );

      expect(performMarvToolCall).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });
});
