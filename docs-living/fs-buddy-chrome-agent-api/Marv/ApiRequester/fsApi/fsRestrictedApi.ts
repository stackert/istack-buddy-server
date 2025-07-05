import { MarvApiError } from '../MarvApiError';
import { IRequestConfig } from '../types';
import type {
  TFsFieldJson,
  TFsFormJson,
  TFsFieldType,
} from '../types-fs-mocks';
import { AbstractFsApi, TSendBatchResponse } from './AbstractFsApi';
import {
  IMarvApiUniversalResponse,
  MarvApiUniversalResponse,
} from './MarvApiUniversalResponse';

type TSimpleDictionary<T> = { [key: string]: T };
type TFsLiteField = {
  fieldType: TFsFieldType; // "text" | "number" | "date" | "phone" | "address" | "name";
  isHidden?: boolean;
  isRequired?: boolean;
  label: string;
};
type TFsLiteFormAddResponse = {
  editUrl: string;
  viewUrl: string;
  isSuccess: boolean;
  formId: string | null;
};

const transformers = {
  fieldJsonToUniqueLabelSlug: (field: TFsFieldJson) =>
    `|${(field.id || '').slice(-4)}|`,
  TFsLiteFieldToFormstackJson: (
    field: TFsLiteField | IAddFsLiteFieldProps
  ): Partial<TFsFieldJson> => {
    return {
      label: field.label,
      // @ts-ignore - this should be "fieldType" but it is coming through as 'type'
      field_type: field.field_type,
      hidden: field.isHidden ? '1' : '0',
      require: field.isRequired ? '1' : '0',
    };
  },
};

const labelWithOutSlug = (field: TFsFieldJson) => {
  const slug = transformers
    .fieldJsonToUniqueLabelSlug(field)
    .replace(/\|/g, `\\\|`);
  const slugRegExp = new RegExp(slug, 'g');
  const cleanedLabel = (field.label || '').replace(slugRegExp, '');
  return cleanedLabel;
};

class fsRestrictedApi extends AbstractFsApi {
  private ALLOWED_UPDATE_FIELD_PROPERTIES: (keyof TFsFieldJson)[] = [
    'label',
    'logic',
    'default',
    'default_value',
  ];
  static #instance: fsRestrictedApi;

  private constructor(apiKey?: string) {
    super(apiKey);
  }

  //  uniquelyLabelFieldAdd
  public async fieldLabelUniqueSlugAdd(
    formId: string
  ): Promise<IMarvApiUniversalResponse<{ isSuccessful: boolean }>> {
    const fields = await this.getFormFieldJson(formId);
    const fieldUpdateRequests = fields.map((field) => {
      return this.getApiRequestConfigUpdateField({
        id: field.id,
        label: transformers.fieldJsonToUniqueLabelSlug(field) + field.label,
      });
    });

    const fieldUpdateResponses = await this.sendBatchRequest<any>(
      fieldUpdateRequests,
      formId
    );
    return helpers.batchResponseToUniversalResponse(fieldUpdateResponses);
  }

  public async fieldLabelUniqueSlugRemove(
    formId: string
  ): Promise<IMarvApiUniversalResponse<{ isSuccessful: boolean }>> {
    const fields = await this.getFormFieldJson(formId);
    const fieldUpdateRequests = fields.map((field) => {
      return this.getApiRequestConfigUpdateField({
        id: field.id,
        label: labelWithOutSlug(field),
      });
    });

    const fieldUpdateResponse = await this.sendBatchRequest<any>(
      fieldUpdateRequests,
      formId
    );
    return helpers.batchResponseToUniversalResponse(fieldUpdateResponse);
  }

  public async fieldLiteAdd(
    formId: string,
    properties: IAddFsLiteFieldProps
  ): Promise<
    IMarvApiUniversalResponse<{ fieldId: string; fieldJson: TFsFieldJson }>
  > {
    //
    const sanitizedProperties =
      transformers.TFsLiteFieldToFormstackJson(properties);

    const apiRequest = this.apiRequestConfigFactory({
      url: `${AbstractFsApi.apiRootUrl}/form/${formId}/field.json`,
      httpMethod: 'POST',
      body: {
        ...{
          field_type: 'text',
          label: '',
          hidden: '0',
          require: '0',
        },
        ...sanitizedProperties,
      },
    });
    const response = await this.sendSingleRequest<TFsFieldJson>(
      apiRequest,
      formId
    );

    const fieldJson = response.response as TFsFieldJson;
    const fieldId = fieldJson.id + '';
    return {
      isSuccess: response.isSuccess,
      errorItems: response.errorItems,
      response: {
        fieldId,
        fieldJson,
      },

      // response.response as TFsFieldJson,
    } as IMarvApiUniversalResponse<{
      fieldId: string;
      fieldJson: TFsFieldJson;
    }>;
    // return response;
  }

  public async fieldLogicRemove(
    formId: string
  ): Promise<IMarvApiUniversalResponse<{ isSuccessful: boolean }>> {
    console.log('maybe add step to verify there is logic stashed');
    const stashField = await this.getLogicStashField(formId);
    const logicStash = this.parseLogicStashString(stashField.default || '');
    const fieldUpdateRequests = Object.entries(logicStash).map(
      ([fieldId, logic]) => {
        return this.getApiRequestConfigUpdateField({
          id: fieldId,
          logic: {},
        });
      }
    );

    const fieldUpdateResponse = await this.sendBatchRequest<any>(
      fieldUpdateRequests,
      formId
    );
    return helpers.batchResponseToUniversalResponse(fieldUpdateResponse);
  }

  // this should/maybe be broken up into two functions apply and remove
  public async fieldLogicStashApply(
    formId: string
  ): Promise<IMarvApiUniversalResponse<{ isSuccessful: boolean }>> {
    const stashField = await this.getLogicStashField(formId);
    const logicStash = this.parseLogicStashString(stashField.default || '');
    const fieldUpdateRequests = Object.entries(logicStash).map(
      ([fieldId, logic]) => {
        return this.getApiRequestConfigUpdateField({
          id: fieldId,
          logic: logic,
        });
      }
    );
    const fieldUpdateResponse = await this.sendBatchRequest<any>(
      fieldUpdateRequests,
      formId
    );
    return helpers.batchResponseToUniversalResponse(fieldUpdateResponse);
  }

  // this should/maybe be broken up into two functions apply and remove
  public async fieldLogicStashApplyAndRemove(
    formId: string
  ): Promise<IMarvApiUniversalResponse<{ isSuccessful: boolean }>> {
    const stashField = await this.getLogicStashField(formId);
    const logicStash = this.parseLogicStashString(stashField.default || '');
    const fieldUpdateRequests = Object.entries(logicStash).map(
      ([fieldId, logic]) => {
        return this.getApiRequestConfigUpdateField({
          id: fieldId,
          logic: logic,
        });
      }
    );
    const clearLogicStashRequest =
      this.removeLogicStashFieldRequest(stashField);
    fieldUpdateRequests.push(clearLogicStashRequest);

    const fieldUpdateResponse = await this.sendBatchRequest<any>(
      fieldUpdateRequests,
      formId
    );
    return helpers.batchResponseToUniversalResponse(fieldUpdateResponse);
  }

  public async fieldLogicStashCreate(
    formId: string
  ): Promise<IMarvApiUniversalResponse<TFsFieldJson>> {
    // *tmc* this is incomplete, should stash and remove.  The functions to remove are already written
    // does this check for existing stash?
    console.log('maybe add step to verify there is logic stashed (hash)');
    const fieldsWithLogicJson = (await this.getFormFieldJson(formId)).filter(
      (fieldJson) => fieldJson.logic
    );
    const logicStashString =
      this.stringifyLogicStashString(fieldsWithLogicJson);

    const insertLogicStashRequest = this.insertLogicStashEnableFieldRequest(
      logicStashString,
      formId
    );

    const response = await this.sendSingleRequest<any>(
      insertLogicStashRequest,
      formId
    );
    return {
      isSuccess: response.isSuccess,
      errorItems: response.errorItems,
      response: response.response as TFsFieldJson, //
    } as IMarvApiUniversalResponse<TFsFieldJson>;
  }

  public async fieldLogicStashRemove(
    formId: string
  ): Promise<IMarvApiUniversalResponse<any>> {
    const stashField = await this.getLogicStashField(formId);
    const clearLogicStashRequest =
      this.removeLogicStashFieldRequest(stashField);

    const apiResponse = await this.sendSingleRequest(
      clearLogicStashRequest,
      formId
    );
    // at this point we would want to verify it worked.
    // the Formstack API will report success even if the field did not get removed
    return {
      isSuccess: apiResponse.isSuccess,
      errorItems: apiResponse.errorItems,
      response: apiResponse.response as TFsFieldJson, //
    } as IMarvApiUniversalResponse<any>;
  }

  public async formDeveloperCopy(
    formId: string
  ): Promise<IMarvApiUniversalResponse<TFsFormJson>> {
    // this should also change url/name of the form to include original form id and marv and date/time (hex?)

    const requestConfig = this.apiRequestConfigFactory({
      url: `${AbstractFsApi.apiRootUrl}/form/${formId}/copy`,
      httpMethod: 'POST',
      body: null,
    });

    const formCopyResponse = await this.sendSingleRequest<TFsFormJson>(
      requestConfig,
      formId
    );
    const copyFormJson = formCopyResponse.response as TFsFormJson;

    await this.insertMarvEnableField(copyFormJson.id + '');

    // return copyFormJson;
    return {
      isSuccess: formCopyResponse.isSuccess,
      errorItems: null,
      response: copyFormJson,
    };
  }

  public async formLiteAdd(
    formName: string,
    fields: IAddFsLiteFieldProps[] = []
  ): Promise<IMarvApiUniversalResponse<TFsLiteFormAddResponse>> {
    // maybe consider throwing if required properties type and label are missing?
    const sanitizedField = fields.map((field) => {
      return transformers.TFsLiteFieldToFormstackJson(field);
    });
    const apiRequest = this.apiRequestConfigFactory({
      url: `${AbstractFsApi.apiRootUrl}/form.json`,
      httpMethod: 'POST',
      body: {
        name: formName,
        fields: sanitizedField,
      },
    });
    console.log({ rawFields: fields, sanitizedField, apiRequest });

    // we need bypass isMarvEnabled check ... create form can't be marv enabled
    const postResponse = await super.sendSingleRequest<TFsFormJson>(apiRequest);

    if (postResponse.isSuccess) {
      const formJson = postResponse.response as TFsFormJson;
      return {
        isSuccess: true,
        errorItems: null,
        response: {
          editUrl: formJson.edit_url,
          viewUrl: formJson.url,
          formId: formJson.id + '',
          isSuccess: true,
        },
      } as IMarvApiUniversalResponse<TFsLiteFormAddResponse>;
    } else {
      postResponse.pushError(
        "'formLiteAdd/sendSingleRequest' returned error response."
      );
      return {
        isSuccess: false,
        errorItems: postResponse.errorItems,
        response: null,
      } as IMarvApiUniversalResponse<TFsLiteFormAddResponse>;
    }
  }

  /**
   *
   * @param formId
   * @returns - most recent (biggest field.id) logic stash field
   */
  private async getLogicStashField(formId: string): Promise<TFsFieldJson> {
    const fieldsJson = await this.getFormFieldJson(formId);
    const logicStashField = fieldsJson
      .filter((field) => {
        return field.label === 'MARV_LOGIC_STASH';
      })
      .reduce((acc, field) => {
        if (field.id > acc.id) {
          return field;
        }
        return acc;
      });
    return logicStashField;
  }

  private getApiRequestConfigUpdateField(
    updatedFieldJson: Partial<TFsFieldJson>
  ): IRequestConfig {
    const effectiveUpdate = {} as Partial<TFsFieldJson>;
    this.ALLOWED_UPDATE_FIELD_PROPERTIES.forEach(
      (fieldPropertyName: keyof TFsFieldJson) => {
        if (fieldPropertyName in updatedFieldJson) {
          // @ts-ignore - Type 'string | boolean | object | null | undefined' is not assignable to type 'undefined'
          effectiveUpdate[fieldPropertyName] =
            updatedFieldJson[fieldPropertyName];
        }
      }
    );

    const { id: fieldId = '' } = updatedFieldJson;
    const apiRequestConfig = this.apiRequestConfigFactory({
      url: `${AbstractFsApi.apiRootUrl}/field/${fieldId}`,
      httpMethod: 'PUT',
      body: JSON.stringify(effectiveUpdate),
    });
    return apiRequestConfig;
  }

  private getApiRequestConfigDeleteField(
    updatedFieldJson: Partial<TFsFieldJson>
  ): IRequestConfig {
    const { id: fieldId = '' } = updatedFieldJson;
    const apiRequestConfig = this.apiRequestConfigFactory({
      url: `${AbstractFsApi.apiRootUrl}/field/${fieldId}`,
      // @ts-ignore  - we do not want to allow DELETE so I will ignore ts error
      httpMethod: 'DELETE',
    });
    return apiRequestConfig;
  }

  private insertLogicStashEnableFieldRequest(
    logicAsString: string,
    formId: string
  ): IRequestConfig {
    return this.apiRequestConfigFactory({
      url: `${AbstractFsApi.apiRootUrl}/form/${formId}/field.json`,
      httpMethod: 'POST',
      body: {
        field_type: 'text',
        hidden: true,
        default_value: logicAsString,
        default: logicAsString,
        label: 'MARV_LOGIC_STASH',
      },
    });

    // return true;
  }

  private async insertMarvEnableField(formId: string): Promise<boolean> {
    const apiRequest = this.apiRequestConfigFactory({
      url: `${AbstractFsApi.apiRootUrl}/form/${formId}/field.json`,
      httpMethod: 'POST',
      body: {
        field_type: 'text',
        hidden: true,
        default: 'MARV_ENABLED',
        default_value: 'MARV_ENABLED',
        label: 'MARV_ENABLED',
      },
    });
    await this.sendRequest(apiRequest).catch((e) => {
      throw new MarvApiError('Failed to add MARV_ENABLE field.', {
        originalError: e,
      });
    });

    return true;
  }

  private parseLogicStashString(
    logicStashString: string
  ): TSimpleDictionary<string> {
    const logicEnvelope = JSON.parse(logicStashString);
    const logicStash = JSON.parse(atob(logicEnvelope.base64));
    return logicStash;
  }

  private removeLogicStashFieldRequest(
    stashFieldJson: TFsFieldJson
  ): IRequestConfig {
    return this.getApiRequestConfigDeleteField(stashFieldJson);
    // return this.getApiRequestConfigUpdateField({
    //   id: stashFieldJson.id,
    //   default_value: "",
    //   default: "",
    // });
  }

  /**
   * @deprecated - use sendSingleRequest instead
   * @param requestConfig
   * @returns
   */
  protected override async sendRequest<T = any>(
    requestConfig: IRequestConfig
  ): Promise<MarvApiUniversalResponse<T>> {
    // const response = await super.sendSingleRequest<T>(requestConfig);
    return super.sendSingleRequest<T>(requestConfig);
  }

  // protected async sendBatchRequest<T>(
  //   requestConfigs: IRequestConfig[],
  //   formId: string
  // ): Promise<TSendBatchResponse<T>> {

  protected override async sendBatchRequest<T>(
    requestConfigs: IRequestConfig[],
    formId: string
  ): Promise<TSendBatchResponse<T>> {
    // Promise<PromiseSettledResult<Awaited<MarvApiUniversalResponse<T>>>[]> //
    const isMarvEnabled = await this.isFormMarvEnabled(formId);
    if (!isMarvEnabled) {
      throw new MarvApiError('Marv Api Error: form is not Marv enabled.');
    }
    // Promise<MarvApiUniversalResponse<T>>
    // const response = await
    return super.sendBatchRequest<T>(requestConfigs, formId);
  }

  protected override async sendSingleRequest<T = any>(
    requestConfig: IRequestConfig,
    formId: string
  ): Promise<MarvApiUniversalResponse<T>> {
    const isMarvEnabled = await this.isFormMarvEnabled(formId);
    if (!isMarvEnabled) {
      throw new MarvApiError('Marv Api Error: form is not Marv enabled.');
    }
    // const response = await super.sendSingleRequest<T>(requestConfig);
    return super.sendSingleRequest<T>(requestConfig);
  }

  private stringifyLogicStashString(fieldsWithLogic: TFsFieldJson[]) {
    const allFieldLogic = fieldsWithLogic.reduce((acc, field) => {
      acc[field.id] = field.logic;
      return acc;
    }, {} as TSimpleDictionary<any>);
    const logicAsBase64 = btoa(JSON.stringify(allFieldLogic));

    const logic = {
      // allFieldLogic: allFieldLogic,
      base64: logicAsBase64,
    };

    return JSON.stringify(logic);
  }

  public static getInstance(): fsRestrictedApi {
    if (!fsRestrictedApi.#instance) {
      fsRestrictedApi.#instance = new fsRestrictedApi();
    }
    return fsRestrictedApi.#instance;
  }
}

interface IAddFsLiteFieldProps {
  label: string;
  fieldType: TFsFieldType;
  isHidden?: boolean;
  isRequired?: boolean;
}

export type { IAddFsLiteFieldProps };
export { fsRestrictedApi };

const helpers = {
  batchResponseToUniversalResponse<T>(apiBatchResponse: TSendBatchResponse<T>) {
    const { fulfilled, rejected } = apiBatchResponse;
    return {
      isSuccess: rejected === null || rejected.length === 0,
      errorItems: rejected === null || rejected.length === 0 ? null : rejected,
      response: {
        isSuccessful: rejected === null || rejected.length === 0 ? true : false,
      },
    };
  },
};
