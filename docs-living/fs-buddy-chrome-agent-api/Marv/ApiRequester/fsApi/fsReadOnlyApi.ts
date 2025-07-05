import { IRequestConfig } from "../types";
import { TFsFormJson } from "../types-fs-mocks";
import { AbstractFsApi } from "./AbstractFsApi";

class fsReadOnlyApi extends AbstractFsApi {
  static #instance: fsReadOnlyApi;

  private constructor(apiKey?: string) {
    super(apiKey);
  }

  public static getInstance(): fsReadOnlyApi {
    if (!fsReadOnlyApi.#instance) {
      fsReadOnlyApi.#instance = new fsReadOnlyApi();
    }
    return fsReadOnlyApi.#instance;
  }
}

export { fsReadOnlyApi };
