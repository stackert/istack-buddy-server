import { MarvApiError } from "../MarvApiError";
import { IRequestConfig } from "../types";
import { TFsFieldJson, TFsFormJson } from "../types-fs-mocks";
import { MarvApiUniversalResponse } from "./MarvApiUniversalResponse";
import { fsApiCallWrapper } from "./fsApiCallWrapper";
import { filterMarvEnabledFields, isMarvEnabledFormJson } from "./functions";

export type TSendBatchResponse<T> = {
  fulfilled: MarvApiUniversalResponse<T>[] | null;
  rejected: MarvApiUniversalResponse<any>[] | null;
};

const isFulfilled = <T>(
  p: PromiseSettledResult<T>
): p is PromiseFulfilledResult<T> => p.status === "fulfilled";
const isRejected = <T>(
  p: PromiseSettledResult<T>
): p is PromiseRejectedResult => p.status === "rejected";

abstract class AbstractFsApi {
  static #instance: AbstractFsApi;
  static #apiRootUrl: string = "https://api.formstack.com/api/v2";
  #apiKey!: string;
  #formId!: string;

  protected constructor(apiKey?: string) {
    if (apiKey) {
      this.#apiKey = apiKey;
    }
  }

  static get apiRootUrl(): string {
    return AbstractFsApi.#apiRootUrl;
  }

  async isFormMarvEnabled(formId: string): Promise<boolean> {
    const formJson = await this.getFormJson(formId);
    if (!formJson.fields || !Array.isArray(formJson.fields)) {
      return false;
    }
    return isMarvEnabledFormJson(formJson);
  }

  public async getFormFieldJson(formId: string): Promise<TFsFieldJson[]> {
    const formJson = await this.getFormJson(formId);
    if (!formJson.fields || !Array.isArray(formJson.fields)) {
      throw new MarvApiError(
        "Marv Api Error: failed to getFormField, fields array invalid."
      );
    }

    return formJson.fields;
  }

  public async getFormJson(formId: string): Promise<TFsFormJson> {
    const apiRequest: IRequestConfig = {
      url: `${AbstractFsApi.apiRootUrl}/form/${formId}.json`,
      httpMethod: "GET",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      // body: undefined,
    };
    const response = await this.makeRequest<TFsFormJson>(apiRequest);

    // const formJson = await this.makeRequest<TFsFormJson>(apiRequest).catch(
    //   (e) => {
    //     throw new MarvApiError("Marv Api Error: failed GET formJson.", {
    //       originalError: e,
    //     });
    //   }
    // );
    if (!response.isSuccess) {
      throw new MarvApiError("Marv Api Error: failed GET formJson.", {
        originalError: response.response,
      });
    }
    return response.response as TFsFormJson;
  }

  /**
   * @deprecated - use send request instead
   * @param requestConfig
   * @returns
   */
  protected makeRequest<T>(
    requestConfig: IRequestConfig
  ): Promise<MarvApiUniversalResponse<T>> {
    return fsApiCallWrapper<T>(requestConfig);
  }

  /**
   * @deprecated - use sendSingleRequest instead
   * @param requestConfig
   * @returns
   */
  protected sendRequest<T>(
    requestConfig: IRequestConfig
  ): Promise<MarvApiUniversalResponse<T>> {
    return fsApiCallWrapper<T>(requestConfig);
  }

  protected sendSingleRequest<T>(
    requestConfig: IRequestConfig,
    formId?: string
  ): Promise<MarvApiUniversalResponse<T>> {
    return fsApiCallWrapper(requestConfig);
  }

  protected async sendBatchRequest<T>(
    requestConfigs: IRequestConfig[],
    formId: string
  ): Promise<TSendBatchResponse<T>> {
    // Promise<PromiseSettledResult<Awaited<MarvApiUniversalResponse<T>>>[]>
    const requestPromises = (requestConfigs || []).map((requestConfig) => {
      return fsApiCallWrapper<T>(requestConfig);
    });

    const settledPromises = await Promise.allSettled<
      MarvApiUniversalResponse<T>
    >(requestPromises);
    const fulfilled = settledPromises.filter(isFulfilled).map((p) => p.value);
    const rejected = settledPromises.filter(isRejected).map((p) => p.reason);
    return {
      fulfilled: fulfilled.length > 0 ? fulfilled : null,
      rejected: rejected.length > 0 ? rejected : null,
    };
    // return Promise.allSettled<MarvApiUniversalResponse<T>>(requestPromises);
  }
  /**
   *
   * @param apiKey
   * @returns this
   */
  public setApiKey(apiKey: string) {
    this.#apiKey = apiKey;
    return this;
  }

  protected get apiKey(): string {
    return this.#apiKey;
  }

  protected apiRequestConfigFactory(
    partialRequest: Partial<IRequestConfig>
  ): IRequestConfig {
    const request: IRequestConfig = {
      ...{
        url: "",
        // url: `${AbstractFsApi.apiRootUrl}/form/${this.#formId}.json`,
        httpMethod: "GET",
        headers: {
          ...{
            "content-type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          ...partialRequest.headers,
        },
        // body: undefined,
      },
      ...partialRequest,
    };

    return request;
  }
}
export default AbstractFsApi;
export { AbstractFsApi };
