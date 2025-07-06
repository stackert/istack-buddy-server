import { fsApiClient } from './fsApiClient';
import { IMarvApiUniversalResponse } from '../../api/types';
import { FsRestrictedApiRoutesEnum } from './types';

// Main function to handle external API calls from the robot
const performMarvToolCall = async (
  apiKey: string,
  functionName: string,
  functionParametersJson?: string,
): Promise<IMarvApiUniversalResponse<any>> => {
  const api = fsApiClient.setApiKey(apiKey);

  // Parse function parameters
  const fnParamsJson = helpers.parseJson(functionParametersJson);
  helpers.pushLog({ functionName, fnParamsJson });

  // Handle all functions through the enum-based switch
  switch (functionName as FsRestrictedApiRoutesEnum) {
    case FsRestrictedApiRoutesEnum.FieldRemove:
      return api.fieldRemove(fnParamsJson?.fieldId);

    case FsRestrictedApiRoutesEnum.FormLiteAdd: {
      // Only apply defaults for FormLiteAdd
      const parameters = {
        formName: 'Default Form',
        fields: [],
        ...fnParamsJson,
      };
      const { formName, fields } = parameters;
      const formLiteAddResponse = await api.formLiteAdd(formName, fields);

      if (helpers.isSuccessfulResponse(formLiteAddResponse)) {
        return formLiteAddResponse;
      }

      helpers.pushErrorMessage(
        formLiteAddResponse,
        `Function returned non-successful response. Function name: ${functionName}`,
      );
      return formLiteAddResponse;
    }

    case FsRestrictedApiRoutesEnum.FieldLabelUniqueSlugAdd:
      return api.fieldLabelUniqueSlugAdd(fnParamsJson?.formId);

    case FsRestrictedApiRoutesEnum.FieldLabelUniqueSlugRemove:
      return api.fieldLabelUniqueSlugRemove(fnParamsJson?.formId);

    case FsRestrictedApiRoutesEnum.FieldLiteAdd:
      return api.fieldLiteAdd(
        fnParamsJson?.formId,
        fnParamsJson?.fields || fnParamsJson,
      );

    case FsRestrictedApiRoutesEnum.FieldLogicRemove:
      return api.fieldLogicRemove(fnParamsJson?.formId);

    case FsRestrictedApiRoutesEnum.FieldLogicStashApply:
      return api.fieldLogicStashApply(fnParamsJson?.formId);

    case FsRestrictedApiRoutesEnum.FieldLogicStashApplyAndRemove:
      return api.fieldLogicStashApplyAndRemove(fnParamsJson?.formId);

    case FsRestrictedApiRoutesEnum.FieldLogicStashCreate:
      console.log({ fieldLogicStashCreate: fnParamsJson });
      return api.fieldLogicStashCreate(fnParamsJson?.formId);

    case FsRestrictedApiRoutesEnum.FieldLogicStashRemove:
      return api.fieldLogicStashRemove(fnParamsJson?.formId);

    case FsRestrictedApiRoutesEnum.FormDeveloperAdd:
      return api.formDeveloperCopy(fnParamsJson?.formId);

    default:
      return {
        isSuccess: false,
        response: null,
        errorItems: [
          `External function name not found. Function name: '${functionName}'.`,
        ],
      } as IMarvApiUniversalResponse<any>;
  }
};

// Helper functions
const helpers = {
  isSuccessfulResponse: (apiResponse: IMarvApiUniversalResponse<any>) =>
    apiResponse.isSuccess && apiResponse.response !== null,

  pushErrorMessage: (
    apiResponse: IMarvApiUniversalResponse<any>,
    message: string,
  ) => {
    if (apiResponse.errorItems === null) {
      apiResponse.errorItems = [];
    }
    apiResponse.errorItems.push(message);
  },

  parseJson: (jsonString?: string) => {
    if (jsonString) {
      try {
        return JSON.parse(jsonString);
      } catch (e) {
        console.error('Error parsing JSON:', e);
      }
    }
    return {};
  },

  pushLog: (logObject: any) => {
    console.log(logObject);
  },
};

export { performMarvToolCall };
