import { fsApiClient } from './fsApiClient';
import {
  IMarvApiUniversalResponse,
  FsRestrictedApiRoutesEnum,
  TFsRestrictedApiFunctionNames,
} from './types';

// Main function to handle external API calls from the robot
export const performExternalApiCall = async (
  fsApiKey: string,
  functionName: string,
  functionArgsAsJsonString?: string,
): Promise<IMarvApiUniversalResponse<any>> => {
  // Parse function arguments - don't apply defaults here
  const fnParamsJson = JSON.parse(functionArgsAsJsonString || '{}');

  console.log({
    performExternalApiCall: {
      functionName,
      functionArgsAsJsonString,
      parameters: fnParamsJson,
    },
  });

  // Set API key
  const api = fsApiClient.setApiKey(fsApiKey);

  // Route to appropriate API method
  switch (functionName as FsRestrictedApiRoutesEnum) {
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
};
