import { performMarvToolCall } from './performMarvToolCall';
import { FsRestrictedApiRoutesEnum } from '.';
import type { IMarvApiUniversalResponse } from '.';

// Mock the MarvService
const mockMarvServiceInstance = {
  fieldRemove: jest.fn(),
  formLiteAdd: jest.fn(),
  fieldLabelUniqueSlugAdd: jest.fn(),
  fieldLabelUniqueSlugRemove: jest.fn(),
  fieldLiteAdd: jest.fn(),
  fieldLogicRemove: jest.fn(),
  fieldLogicStashApply: jest.fn(),
  fieldLogicStashApplyAndRemove: jest.fn(),
  fieldLogicStashCreate: jest.fn(),
  fieldLogicStashRemove: jest.fn(),
  formDeveloperCopy: jest.fn(),
  formAndRelatedEntityOverview: jest.fn(),
  formLogicValidation: jest.fn(),
  formCalculationValidation: jest.fn(),
};

jest.mock('./marvService', () => {
  const mockInstance = {
    fieldRemove: jest.fn(),
    formLiteAdd: jest.fn(),
    fieldLabelUniqueSlugAdd: jest.fn(),
    fieldLabelUniqueSlugRemove: jest.fn(),
    fieldLiteAdd: jest.fn(),
    fieldLogicRemove: jest.fn(),
    fieldLogicStashApply: jest.fn(),
    fieldLogicStashApplyAndRemove: jest.fn(),
    fieldLogicStashCreate: jest.fn(),
    fieldLogicStashRemove: jest.fn(),
    formDeveloperCopy: jest.fn(),
    formAndRelatedEntityOverview: jest.fn(),
    formLogicValidation: jest.fn(),
    formCalculationValidation: jest.fn(),
  };
  return {
    MarvService: jest.fn().mockImplementation(() => mockInstance),
    marvService: mockInstance,
  };
});

// Get the mocked module to access the mock instance
const { MarvService: MockMarvService } = jest.mocked(
  require('./marvService'),
) as any;
const mockMarvService = new MockMarvService() as jest.Mocked<any>;

jest.mock('../../../common/logger/custom-logger.service', () => {
  const mockLogger = {
    debug: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };
  return {
    CustomLoggerService: jest.fn().mockImplementation(() => mockLogger),
  };
});

// Get the mocked logger instance
const {
  CustomLoggerService,
} = require('../../../common/logger/custom-logger.service');
const mockLogger = new CustomLoggerService();

describe('performMarvToolCall', () => {
  const mockSuccessResponse: IMarvApiUniversalResponse<any> = {
    isSuccess: true,
    response: { id: '123', message: 'Success' },
    errorItems: null,
  };

  const mockFailureResponse: IMarvApiUniversalResponse<any> = {
    isSuccess: false,
    response: null,
    errorItems: ['API Error'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should log function call details', async () => {
      mockMarvService.fieldRemove.mockResolvedValue(mockSuccessResponse);

      await performMarvToolCall('fieldRemove', '{"fieldId":"123"}');

      expect(mockLogger.debug).toHaveBeenCalledWith('Marv tool call log', {
        functionName: 'fieldRemove',
        fnParamsJson: { fieldId: '123' },
      });
    });

    it('should parse empty function arguments as empty object', async () => {
      mockMarvService.fieldRemove.mockResolvedValue(mockSuccessResponse);

      await performMarvToolCall('fieldRemove');

      expect(mockLogger.debug).toHaveBeenCalledWith('Marv tool call log', {
        functionName: 'fieldRemove',
        fnParamsJson: {},
      });
    });

    it('should parse empty string function arguments as empty object', async () => {
      mockMarvService.fieldRemove.mockResolvedValue(mockSuccessResponse);

      await performMarvToolCall('fieldRemove', '');

      expect(mockLogger.debug).toHaveBeenCalledWith('Marv tool call log', {
        functionName: 'fieldRemove',
        fnParamsJson: {},
      });
    });
  });

  describe('Special Function: fieldRemove', () => {
    it('should handle fieldRemove function', async () => {
      mockMarvService.fieldRemove.mockResolvedValue(mockSuccessResponse);

      const result = await performMarvToolCall(
        'fieldRemove',
        '{"fieldId":"456"}',
      );

      expect(mockMarvService.fieldRemove).toHaveBeenCalledWith('456');
      expect(result).toEqual(mockSuccessResponse);
    });

    it('should handle fieldRemove without fieldId parameter', async () => {
      mockMarvService.fieldRemove.mockResolvedValue(mockSuccessResponse);

      const result = await performMarvToolCall('fieldRemove', '{}');

      expect(mockMarvService.fieldRemove).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  describe('FsRestrictedApiRoutesEnum Functions', () => {
    describe('FormLiteAdd', () => {
      it('should handle FormLiteAdd with parameters', async () => {
        mockMarvService.formLiteAdd.mockResolvedValue(mockSuccessResponse);

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FormLiteAdd,
          '{"formName":"Test Form","fields":[{"label":"Name","field_type":"text"}]}',
        );

        expect(mockMarvService.formLiteAdd).toHaveBeenCalledWith('Test Form', [
          { label: 'Name', field_type: 'text' },
        ]);
        expect(result).toEqual(mockSuccessResponse);
      });

      it('should apply default parameters for FormLiteAdd when none provided', async () => {
        mockMarvService.formLiteAdd.mockResolvedValue(mockSuccessResponse);

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FormLiteAdd,
          '{}',
        );

        expect(mockMarvService.formLiteAdd).toHaveBeenCalledWith(
          'Default Form',
          [],
        );
        expect(result).toEqual(mockSuccessResponse);
      });

      it('should merge provided parameters with defaults for FormLiteAdd', async () => {
        mockMarvService.formLiteAdd.mockResolvedValue(mockSuccessResponse);

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FormLiteAdd,
          '{"formName":"Custom Form"}',
        );

        expect(mockMarvService.formLiteAdd).toHaveBeenCalledWith(
          'Custom Form',
          [],
        );
        expect(result).toEqual(mockSuccessResponse);
      });

      it('should handle FormLiteAdd failure and add error message', async () => {
        mockMarvService.formLiteAdd.mockResolvedValue(mockFailureResponse);

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FormLiteAdd,
          '{}',
        );

        expect(result.errorItems).toContain('API Error');
        expect(result.errorItems).toContain(
          `Function returned non-successful response. Function name: ${FsRestrictedApiRoutesEnum.FormLiteAdd}`,
        );
      });

      it('should handle FormLiteAdd with null errorItems and add error message', async () => {
        const responseWithNullErrors = {
          isSuccess: false,
          response: null,
          errorItems: null,
        };
        mockMarvService.formLiteAdd.mockResolvedValue(responseWithNullErrors);

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FormLiteAdd,
          '{}',
        );

        expect(result.errorItems).toEqual([
          `Function returned non-successful response. Function name: ${FsRestrictedApiRoutesEnum.FormLiteAdd}`,
        ]);
      });
    });

    describe('Field Label Slug Functions', () => {
      it('should handle FieldLabelUniqueSlugAdd', async () => {
        mockMarvService.fieldLabelUniqueSlugAdd.mockResolvedValue(
          mockSuccessResponse,
        );

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FieldLabelUniqueSlugAdd,
          '{"formId":"789"}',
        );

        expect(mockMarvService.fieldLabelUniqueSlugAdd).toHaveBeenCalledWith(
          '789',
        );
        expect(result).toEqual(mockSuccessResponse);
      });

      it('should handle FieldLabelUniqueSlugRemove', async () => {
        mockMarvService.fieldLabelUniqueSlugRemove.mockResolvedValue(
          mockSuccessResponse,
        );

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FieldLabelUniqueSlugRemove,
          '{"formId":"789"}',
        );

        expect(mockMarvService.fieldLabelUniqueSlugRemove).toHaveBeenCalledWith(
          '789',
        );
        expect(result).toEqual(mockSuccessResponse);
      });
    });

    describe('FieldLiteAdd', () => {
      it('should handle FieldLiteAdd with fields parameter', async () => {
        mockMarvService.fieldLiteAdd.mockResolvedValue(mockSuccessResponse);

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FieldLiteAdd,
          '{"formId":"123","fields":{"label":"Email","field_type":"email"}}',
        );

        expect(mockMarvService.fieldLiteAdd).toHaveBeenCalledWith('123', {
          label: 'Email',
          field_type: 'email',
        });
        expect(result).toEqual(mockSuccessResponse);
      });

      it('should handle FieldLiteAdd without fields parameter', async () => {
        mockMarvService.fieldLiteAdd.mockResolvedValue(mockSuccessResponse);

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FieldLiteAdd,
          '{"formId":"123"}',
        );

        expect(mockMarvService.fieldLiteAdd).toHaveBeenCalledWith('123', {
          formId: '123',
        });
        expect(result).toEqual(mockSuccessResponse);
      });
    });

    describe('Field Logic Functions', () => {
      it('should handle FieldLogicRemove', async () => {
        mockMarvService.fieldLogicRemove.mockResolvedValue(mockSuccessResponse);

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FieldLogicRemove,
          '{"formId":"456"}',
        );

        expect(mockMarvService.fieldLogicRemove).toHaveBeenCalledWith('456');
        expect(result).toEqual(mockSuccessResponse);
      });

      it('should handle FieldLogicStashApply', async () => {
        mockMarvService.fieldLogicStashApply.mockResolvedValue(
          mockSuccessResponse,
        );

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FieldLogicStashApply,
          '{"formId":"456"}',
        );

        expect(mockMarvService.fieldLogicStashApply).toHaveBeenCalledWith(
          '456',
        );
        expect(result).toEqual(mockSuccessResponse);
      });

      it('should handle FieldLogicStashApplyAndRemove', async () => {
        mockMarvService.fieldLogicStashApplyAndRemove.mockResolvedValue(
          mockSuccessResponse,
        );

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FieldLogicStashApplyAndRemove,
          '{"formId":"456"}',
        );

        expect(
          mockMarvService.fieldLogicStashApplyAndRemove,
        ).toHaveBeenCalledWith('456');
        expect(result).toEqual(mockSuccessResponse);
      });

      it('should handle FieldLogicStashCreate and log parameters', async () => {
        mockMarvService.fieldLogicStashCreate.mockResolvedValue(
          mockSuccessResponse,
        );

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FieldLogicStashCreate,
          '{"formId":"456"}',
        );

        expect(mockMarvService.fieldLogicStashCreate).toHaveBeenCalledWith(
          '456',
        );
        expect(result).toEqual(mockSuccessResponse);
      });

      it('should handle FieldLogicStashRemove', async () => {
        mockMarvService.fieldLogicStashRemove.mockResolvedValue(
          mockSuccessResponse,
        );

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FieldLogicStashRemove,
          '{"formId":"456"}',
        );

        expect(mockMarvService.fieldLogicStashRemove).toHaveBeenCalledWith(
          '456',
        );
        expect(result).toEqual(mockSuccessResponse);
      });
    });

    describe('FormDeveloperAdd', () => {
      it('should handle FormDeveloperAdd', async () => {
        mockMarvService.formDeveloperCopy.mockResolvedValue(
          mockSuccessResponse,
        );

        const result = await performMarvToolCall(
          FsRestrictedApiRoutesEnum.FormDeveloperAdd,
          '{"formId":"789"}',
        );

        expect(mockMarvService.formDeveloperCopy).toHaveBeenCalledWith('789');
        expect(result).toEqual(mockSuccessResponse);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON in function arguments', async () => {
      mockMarvService.fieldRemove.mockResolvedValue(mockSuccessResponse);

      const result = await performMarvToolCall('fieldRemove', 'invalid-json');

      expect(result).toEqual(mockSuccessResponse);
      expect(mockMarvService.fieldRemove).toHaveBeenCalledWith(undefined);
    });
  });

  describe('Parameter Parsing Edge Cases', () => {
    it('should handle nested JSON objects', async () => {
      mockMarvService.fieldRemove.mockResolvedValue(mockSuccessResponse);

      const result = await performMarvToolCall(
        'fieldRemove',
        '{"fieldId":"123","nested":{"key":"value"}}',
      );

      expect(mockMarvService.fieldRemove).toHaveBeenCalledWith('123');
      expect(result).toEqual(mockSuccessResponse);
    });

    it('should handle array parameters', async () => {
      mockMarvService.formLiteAdd.mockResolvedValue(mockSuccessResponse);

      const result = await performMarvToolCall(
        FsRestrictedApiRoutesEnum.FormLiteAdd,
        '{"formName":"Test","fields":[{"label":"Field1"},{"label":"Field2"}]}',
      );

      expect(mockMarvService.formLiteAdd).toHaveBeenCalledWith('Test', [
        { label: 'Field1' },
        { label: 'Field2' },
      ]);
      expect(result).toEqual(mockSuccessResponse);
    });

    it('should handle missing formId parameter', async () => {
      mockMarvService.fieldLogicRemove.mockResolvedValue(mockSuccessResponse);

      const result = await performMarvToolCall(
        FsRestrictedApiRoutesEnum.FieldLogicRemove,
        '{"otherParam":"value"}',
      );

      expect(mockMarvService.fieldLogicRemove).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  describe('Helper Functions Integration', () => {
    it('should correctly identify successful response', async () => {
      mockMarvService.formLiteAdd.mockResolvedValue(mockSuccessResponse);

      const result = await performMarvToolCall(
        FsRestrictedApiRoutesEnum.FormLiteAdd,
        '{"formName":"Test","fields":[]}',
      );

      expect(result.isSuccess).toBe(true);
      expect(result.response).toEqual({ id: '123', message: 'Success' });
    });

    it('should handle pushErrorMessage with null errorItems', async () => {
      const responseWithNullErrors = {
        isSuccess: false,
        response: null,
        errorItems: null,
      };
      mockMarvService.formLiteAdd.mockResolvedValue(responseWithNullErrors);

      const result = await performMarvToolCall(
        FsRestrictedApiRoutesEnum.FormLiteAdd,
        '{"formName":"Test","fields":[]}',
      );

      expect(result.errorItems).toEqual([
        'Function returned non-successful response. Function name: fsRestrictedApiFormLiteAdd',
      ]);
    });

    it('should correctly identify unsuccessful response', async () => {
      mockMarvService.formLiteAdd.mockResolvedValue(mockFailureResponse);

      const result = await performMarvToolCall(
        FsRestrictedApiRoutesEnum.FormLiteAdd,
        '{"formName":"Test","fields":[]}',
      );

      expect(result.isSuccess).toBe(false);
      expect(result.errorItems).toContain('API Error');
      expect(result.errorItems).toContain(
        'Function returned non-successful response. Function name: fsRestrictedApiFormLiteAdd',
      );
    });

    it('should handle response with null response but success true', async () => {
      const responseWithNullResponse = {
        isSuccess: true,
        response: null,
        errorItems: null,
      };
      mockMarvService.formLiteAdd.mockResolvedValue(responseWithNullResponse);

      const result = await performMarvToolCall(
        FsRestrictedApiRoutesEnum.FormLiteAdd,
        '{"formName":"Test","fields":[]}',
      );

      expect(result.isSuccess).toBe(true);
      expect(result.response).toBeNull();
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle complete form creation workflow', async () => {
      mockMarvService.formLiteAdd.mockResolvedValue(mockSuccessResponse);

      const result = await performMarvToolCall(
        FsRestrictedApiRoutesEnum.FormLiteAdd,
        '{"formName":"Contact Form","fields":[{"label":"Name","field_type":"text"},{"label":"Email","field_type":"email"}]}',
      );

      expect(mockMarvService.formLiteAdd).toHaveBeenCalledWith('Contact Form', [
        { label: 'Name', field_type: 'text' },
        { label: 'Email', field_type: 'email' },
      ]);
      expect(result).toEqual(mockSuccessResponse);
    });

    it('should handle field operations on existing form', async () => {
      mockMarvService.fieldLiteAdd.mockResolvedValue(mockSuccessResponse);

      const result = await performMarvToolCall(
        FsRestrictedApiRoutesEnum.FieldLiteAdd,
        '{"formId":"123","fields":{"label":"Phone","field_type":"phone","isRequired":true}}',
      );

      expect(mockMarvService.fieldLiteAdd).toHaveBeenCalledWith('123', {
        label: 'Phone',
        field_type: 'phone',
        isRequired: true,
      });
      expect(result).toEqual(mockSuccessResponse);
    });
  });
});
