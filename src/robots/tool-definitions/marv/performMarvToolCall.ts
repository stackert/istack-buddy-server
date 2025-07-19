import { MarvService } from './marvService';
import { IMarvApiUniversalResponse, FsRestrictedApiRoutesEnum } from '.';

// Main function to handle external API calls from the robot
const performMarvToolCall = async (
  functionName: string,
  functionParametersJson?: any,
): Promise<IMarvApiUniversalResponse<any>> => {
  const marvService = new MarvService(
    new (await import('./fsApiClient')).FsApiClient(),
  );

  // Parse function parameters
  const fnParamsJson =
    typeof functionParametersJson === 'string'
      ? helpers.parseJson(functionParametersJson)
      : functionParametersJson || {};
  helpers.pushLog({ functionName, fnParamsJson });

  // Handle all functions through the enum-based switch
  switch (functionName as FsRestrictedApiRoutesEnum) {
    case FsRestrictedApiRoutesEnum.FieldRemove:
      return marvService.fieldRemove(fnParamsJson?.fieldId);

    case FsRestrictedApiRoutesEnum.FormLiteAdd: {
      // Only apply defaults for FormLiteAdd
      const parameters = {
        formName: 'Default Form',
        fields: [],
        ...fnParamsJson,
      };
      const { formName, fields } = parameters;
      const formLiteAddResponse = await marvService.formLiteAdd(
        formName,
        fields,
      );

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
      return marvService.fieldLabelUniqueSlugAdd(fnParamsJson?.formId);

    case FsRestrictedApiRoutesEnum.FieldLabelUniqueSlugRemove:
      return marvService.fieldLabelUniqueSlugRemove(fnParamsJson?.formId);

    case FsRestrictedApiRoutesEnum.FieldLiteAdd:
      return marvService.fieldLiteAdd(
        fnParamsJson?.formId,
        fnParamsJson?.fields || fnParamsJson,
      );

    case FsRestrictedApiRoutesEnum.FieldLogicRemove:
      return marvService.fieldLogicRemove(fnParamsJson?.formId);

    case FsRestrictedApiRoutesEnum.FieldLogicStashApply:
      return marvService.fieldLogicStashApply(fnParamsJson?.formId);

    case FsRestrictedApiRoutesEnum.FieldLogicStashApplyAndRemove:
      return marvService.fieldLogicStashApplyAndRemove(fnParamsJson?.formId);

    case FsRestrictedApiRoutesEnum.FieldLogicStashCreate:
      console.log({ fieldLogicStashCreate: fnParamsJson });
      return marvService.fieldLogicStashCreate(fnParamsJson?.formId);

    case FsRestrictedApiRoutesEnum.FieldLogicStashRemove:
      return marvService.fieldLogicStashRemove(fnParamsJson?.formId);

    case FsRestrictedApiRoutesEnum.FormDeveloperAdd:
      return marvService.formDeveloperCopy(fnParamsJson?.formId);

    case FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview:
      return marvService.formAndRelatedEntityOverview(fnParamsJson?.formId);

    case FsRestrictedApiRoutesEnum.FormLogicValidation:
      return marvService.formLogicValidation(fnParamsJson?.formId);

    case FsRestrictedApiRoutesEnum.FormCalculationValidation:
      return marvService.formCalculationValidation(fnParamsJson?.formId);
  }
  // No default - let other tool catalogs handle unknown tools
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
