import { formOverviewToolSet } from './formOverviewToolSet';
import { FsRestrictedApiRoutesEnum } from './types';
import { performMarvToolCall } from './performMarvToolCall';

// Mock the performMarvToolCall function
jest.mock('./performMarvToolCall', () => ({
  performMarvToolCall: jest.fn(),
}));

describe('formOverviewToolSet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('toolDefinitions', () => {
    it('should contain only FormAndRelatedEntityOverview tool', () => {
      expect(formOverviewToolSet.toolDefinitions).toHaveLength(1);
      expect(formOverviewToolSet.toolDefinitions[0].name).toBe(
        FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview,
      );
    });

    it('should filter tools correctly', () => {
      const toolNames = formOverviewToolSet.toolDefinitions.map(
        (tool) => tool.name,
      );
      expect(toolNames).toEqual([
        FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview,
      ]);
    });
  });

  describe('executeToolCall', () => {
    it('should execute FormAndRelatedEntityOverview tool', async () => {
      const mockResponse = { isSuccess: true, response: { formId: '123' } };
      (performMarvToolCall as jest.Mock).mockResolvedValue(mockResponse);

      const result = await formOverviewToolSet.executeToolCall(
        FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview,
        { formId: '123' },
      );

      expect(performMarvToolCall).toHaveBeenCalledWith(
        FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview,
        { formId: '123' },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should return undefined for non-FormAndRelatedEntityOverview tools', async () => {
      const result = await formOverviewToolSet.executeToolCall(
        FsRestrictedApiRoutesEnum.FieldRemove,
        { fieldId: '456' },
      );

      expect(performMarvToolCall).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should return undefined for unknown tool names', async () => {
      const result = await formOverviewToolSet.executeToolCall('unknown-tool', {
        someParam: 'value',
      });

      expect(performMarvToolCall).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });
});
