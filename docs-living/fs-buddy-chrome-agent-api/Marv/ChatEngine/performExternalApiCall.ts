// *tmc* is there a good reason this is not a method of ChatEngine?

import { fsRestrictedApi } from '../ApiRequester/fsApi';
import { IMarvApiUniversalResponse } from '../ApiRequester/fsApi/MarvApiUniversalResponse';
import { TFsRestrictedApiFunctionNames } from '../robot-instruction-set/marv/openai-spec';
import { FsRestrictedApiRoutesEnum } from '../robot-instruction-set/marv/openai-spec/FsRestrictedApiRoutesEnum';

// I think it probably should be
const performExternalApiCall = async (
  fsApiKey: string,
  functionName: TFsRestrictedApiFunctionNames,
  functionArgsAsJsonString?: string
  // parameters: any = {}
): Promise<IMarvApiUniversalResponse<any>> => {
  // throw new Error("FAKE ERROR TO SEE WHAT MARV DOES");
  // const parameters = JSON.parse(functionArgsAsJsonStrong as string);
  const fnParamsJson = JSON.parse(functionArgsAsJsonString || ('' as string));
  const parameters = {
    ...{ formName: 'test', fields: [] },
    ...fnParamsJson,
  };
  console.log({
    performExternalApiCall: {
      functionName,
      functionArgsAsJsonString,
      parameters,
    },
  });

  const api = fsRestrictedApi.getInstance().setApiKey(fsApiKey);
  // .setApiKey("cc17435f8800943cc1abd3063a8fe44f");
  let response: any;

  switch (functionName as FsRestrictedApiRoutesEnum) {
    //
    case FsRestrictedApiRoutesEnum.FormLiteAdd: {
      const { formName, fields } = parameters;
      const formLiteAddResponse = await api.formLiteAdd(formName, fields);
      if (helpers.isSuccessfulResponse(formLiteAddResponse)) {
        // @ts-ignore - doesn't like the typing here, nor do I
        return formLiteAddResponse.response as IMarvApiUniversalResponse<TFsLiteFormAddResponse>;
      }

      // really should set pattern now to  pushError happen after fall-through from switch?
      // see what it looks like after you map one
      helpers.pushErrorMessage(
        formLiteAddResponse,
        // *tmc* vscode linter - said wrap this in 'String()' - why?
        `function returned non successful response. function name: ${String(
          functionName
        )}`
      );
      return formLiteAddResponse;
    }
    case FsRestrictedApiRoutesEnum.FieldLabelUniqueSlugAdd:
      return api.fieldLabelUniqueSlugAdd(parameters?.formId);
    case FsRestrictedApiRoutesEnum.FieldLabelUniqueSlugRemove:
      return api.fieldLabelUniqueSlugRemove(parameters?.formId);
    case FsRestrictedApiRoutesEnum.FieldLiteAdd:
      return api.fieldLiteAdd(parameters?.formId, parameters?.fields);
    case FsRestrictedApiRoutesEnum.FieldLogicRemove:
      return api.fieldLogicRemove(parameters?.formId);
    case FsRestrictedApiRoutesEnum.FieldLogicStashApply:
      return api.fieldLogicStashApply(parameters?.formId);
    case FsRestrictedApiRoutesEnum.FieldLogicStashApplyAndRemove:
      return api.fieldLogicStashApplyAndRemove(parameters?.formId);
    case FsRestrictedApiRoutesEnum.FieldLogicStashCreate:
      return api.fieldLogicStashCreate(parameters?.formId);
    case FsRestrictedApiRoutesEnum.FieldLogicStashRemove:
      return api.fieldLogicStashRemove(parameters?.formId);
    case FsRestrictedApiRoutesEnum.FormDeveloperAdd:
      return api.formDeveloperCopy(parameters?.formId);

    default:
      return {
        isSuccess: false,
        response: null,
        errorItems: [
          // *tmc* vscode linter - said wrap this in 'String()' - why?
          // something about symbol not available at run time.
          `External function name not found. function name: '${String(
            functionName
          )}'.`,
        ],
      } as IMarvApiUniversalResponse<any>;
  }
};
const helpers = {
  isSuccessfulResponse: (apiResponse: IMarvApiUniversalResponse<any>) =>
    apiResponse.isSuccess && apiResponse.response !== null,

  pushErrorMessage: (
    apiResponse: IMarvApiUniversalResponse<any>,
    message: string
  ) => {
    if (apiResponse.errorItems === null) {
      apiResponse.errorItems = [];
    }
    apiResponse.errorItems.push(message);
  },
};

export { performExternalApiCall };
