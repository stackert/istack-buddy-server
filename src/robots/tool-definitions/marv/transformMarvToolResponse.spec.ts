import {
  transformMarvToolResponse,
  ToolResponse,
} from './transformMarvToolResponse';
import { FsRestrictedApiRoutesEnum } from './types';

describe('transformMarvToolResponse', () => {
  const mockSuccessResponse = {
    isSuccess: true,
    response: { data: 'test data' },
    errorItems: null,
  };

  const mockLargeResponse = {
    isSuccess: true,
    response: { data: 'x'.repeat(1500) }, // Over 1000 chars when stringified
    errorItems: null,
  };

  describe('large response functions', () => {
    it('should return robot and chat responses for FormAndRelatedEntityOverview', () => {
      const result = transformMarvToolResponse(
        FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview,
        mockSuccessResponse,
      );

      expect(result.robotResponse.status).toBe('ok');
      expect(result.robotResponse.message).toContain('completed successfully');
      expect(result.robotResponse.message).toContain(
        'Results have been sent to the conversation',
      );
      expect(result.chatResponse).toBeDefined();
      expect(result.chatResponse?.status).toBe('ok');
      expect(result.chatResponse?.message).toContain('{"isSuccess":true');
    });

    it('should return robot and chat responses for FormLogicValidation', () => {
      const result = transformMarvToolResponse(
        FsRestrictedApiRoutesEnum.FormLogicValidation,
        mockSuccessResponse,
      );

      expect(result.robotResponse.status).toBe('ok');
      expect(result.robotResponse.message).toContain('completed successfully');
      expect(result.robotResponse.message).toContain(
        'Results have been sent to the conversation',
      );
      expect(result.chatResponse).toBeDefined();
      expect(result.chatResponse?.status).toBe('ok');
    });

    it('should return robot and chat responses for FormCalculationValidation', () => {
      const result = transformMarvToolResponse(
        FsRestrictedApiRoutesEnum.FormCalculationValidation,
        mockSuccessResponse,
      );

      expect(result.robotResponse.status).toBe('ok');
      expect(result.robotResponse.message).toContain('completed successfully');
      expect(result.robotResponse.message).toContain(
        'Results have been sent to the conversation',
      );
      expect(result.chatResponse).toBeDefined();
      expect(result.chatResponse?.status).toBe('ok');
    });
  });

  describe('large response by size', () => {
    it('should return robot and chat responses when response is over 1000 characters', () => {
      const result = transformMarvToolResponse(
        'someFunction',
        mockLargeResponse,
      );

      expect(result.robotResponse.status).toBe('ok');
      expect(result.robotResponse.message).toContain('completed successfully');
      expect(result.robotResponse.message).toContain(
        'Results have been sent to the conversation',
      );
      expect(result.chatResponse).toBeDefined();
      expect(result.chatResponse?.status).toBe('ok');
      expect(result.chatResponse?.message).toContain('x'.repeat(1500));
    });

    it('should handle null response in large response check', () => {
      const nullResponse = {
        isSuccess: true,
        response: null,
        errorItems: null,
      };

      const result = transformMarvToolResponse('someFunction', nullResponse);

      expect(result.robotResponse.status).toBe('ok');
      expect(result.chatResponse).toBeUndefined();
    });
  });

  describe('small response functions', () => {
    it('should return only robot response for small responses', () => {
      const result = transformMarvToolResponse(
        'fieldRemove',
        mockSuccessResponse,
      );

      expect(result.robotResponse.status).toBe('ok');
      expect(result.robotResponse.message).toContain('completed successfully');
      expect(result.robotResponse.message).toContain('<pre><code>');
      expect(result.robotResponse.message).toContain('"debug"');
      expect(result.chatResponse).toBeUndefined();
    });

    it('should return only robot response for FieldLiteAdd', () => {
      const result = transformMarvToolResponse(
        FsRestrictedApiRoutesEnum.FieldLiteAdd,
        mockSuccessResponse,
      );

      expect(result.robotResponse.status).toBe('ok');
      expect(result.robotResponse.message).toContain('completed successfully');
      expect(result.robotResponse.message).toContain('<pre><code>');
      expect(result.chatResponse).toBeUndefined();
    });

    it('should return only robot response for FormLiteAdd', () => {
      const result = transformMarvToolResponse(
        FsRestrictedApiRoutesEnum.FormLiteAdd,
        mockSuccessResponse,
      );

      expect(result.robotResponse.status).toBe('ok');
      expect(result.robotResponse.message).toContain('completed successfully');
      expect(result.robotResponse.message).toContain('<pre><code>');
      expect(result.chatResponse).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty response object', () => {
      const emptyResponse = {
        isSuccess: true,
        response: {},
        errorItems: null,
      };

      const result = transformMarvToolResponse('someFunction', emptyResponse);

      expect(result.robotResponse.status).toBe('ok');
      expect(result.chatResponse).toBeUndefined();
    });

    it('should handle response with error items', () => {
      const errorResponse = {
        isSuccess: false,
        response: null,
        errorItems: ['error1', 'error2'],
      };

      const result = transformMarvToolResponse('someFunction', errorResponse);

      expect(result.robotResponse.status).toBe('ok');
      expect(result.robotResponse.message).toContain('completed successfully');
    });

    it('should handle undefined response', () => {
      const undefinedResponse = {
        isSuccess: true,
        response: undefined as any,
        errorItems: null,
      };

      const result = transformMarvToolResponse(
        'someFunction',
        undefinedResponse,
      );

      expect(result.robotResponse.status).toBe('ok');
      expect(result.chatResponse).toBeUndefined();
    });

    it('should handle function name with special characters', () => {
      const result = transformMarvToolResponse(
        'function-with-dashes',
        mockSuccessResponse,
      );

      expect(result.robotResponse.status).toBe('ok');
      expect(result.robotResponse.message).toContain('function-with-dashes');
      expect(result.chatResponse).toBeUndefined();
    });
  });

  describe('response formatting', () => {
    it('should format small response with debug wrapper', () => {
      const result = transformMarvToolResponse(
        'testFunction',
        mockSuccessResponse,
      );

      expect(result.robotResponse.message).toContain('"debug"');
      expect(result.robotResponse.message).toContain('"isSuccess": true');
      expect(result.robotResponse.message).toContain('"data": "test data"');
      expect(result.robotResponse.message).toContain('"errorItems": null');
    });

    it('should format large response as JSON string', () => {
      const result = transformMarvToolResponse(
        'testFunction',
        mockLargeResponse,
      );

      expect(result.chatResponse?.message).toContain(
        '{"isSuccess":true,"response":{"data":"',
      );
      expect(result.chatResponse?.message).toContain('x'.repeat(1500));
    });

    it('should handle response with nested objects', () => {
      const nestedResponse = {
        isSuccess: true,
        response: {
          user: {
            name: 'John',
            details: {
              age: 30,
              city: 'New York',
            },
          },
        },
        errorItems: null,
      };

      const result = transformMarvToolResponse('testFunction', nestedResponse);

      expect(result.robotResponse.message).toContain('"debug"');
      expect(result.robotResponse.message).toContain('"user"');
      expect(result.robotResponse.message).toContain('"John"');
    });
  });
});
