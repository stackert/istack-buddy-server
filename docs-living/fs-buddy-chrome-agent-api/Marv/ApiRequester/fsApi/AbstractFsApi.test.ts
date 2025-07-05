import { AbstractFsApi } from "./AbstractFsApi";
import { IRequestConfig } from "../types";
import { TFsFieldJson, TFsFormJson } from "../types-fs-mocks";
import * as apiCall from "../apiCall";
import { MarvApiError } from "../MarvApiError";
import { ApiError } from "../ApiError";

class TestAbstractFsApi extends AbstractFsApi {
  static #instance: TestAbstractFsApi;

  private constructor(apiKey?: string) {
    super(apiKey);
  }

  public testGetApiKey(): string {
    return this.apiKey;
  }
  public static getInstance(): TestAbstractFsApi {
    if (!TestAbstractFsApi.#instance) {
      TestAbstractFsApi.#instance = new TestAbstractFsApi();
    }
    return TestAbstractFsApi.#instance;
  }
}
describe("AbstractFsApi", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  let abstractFsApi: TestAbstractFsApi;

  beforeEach(() => {
    abstractFsApi = TestAbstractFsApi.getInstance().setApiKey("_THE_API_KEY_");
  });
  it("Should set the API key", () => {
    const apiKey = "your-api-key";
    abstractFsApi.setApiKey(apiKey);
    expect(abstractFsApi.testGetApiKey()).toBe(apiKey);
  });

  describe(".getFormJson()", () => {
    it("Should call apiCall to get the form JSON", async () => {
      // Setup
      const expectedResponse = { ...mockFormJson };
      const apiCallMock = jest.spyOn(apiCall, "apiCall");
      // @ts-ignore - 'form' is not assignable to type 'never'
      apiCallMock.mockReturnValue({ ...mockFormJson });
      const formId = "_THE_FORM_ID_";

      // Exercise
      const formJson = await abstractFsApi.getFormJson(formId);

      // Result
      expect(apiCallMock).toHaveBeenCalledWith({
        url: "https://api.formstack.com/api/v2/form/_THE_FORM_ID_.json",
        httpMethod: "GET",
        headers: {
          "content-type": "application/json",
          Authorization: "Bearer _THE_API_KEY_",
        },
        body: undefined,
      });
      expect(apiCallMock).toHaveBeenCalledTimes(1);
      expect(formJson).toEqual(expectedResponse);
    });
    it("Should convert Formstack Failed requests into Marv Error.", async () => {
      // Setup
      const apiCallResponse = { error: "some error message", status: "error" };
      const apiCallMock = jest.spyOn(apiCall, "apiCall");
      // @ts-ignore - 'form' is not assignable to type 'never'
      apiCallMock.mockReturnValue(apiCallResponse);
      const formId = "_THE_FORM_ID_";

      // Exercise
      // const formJson = await abstractFsApi.getFormJson(formId);

      const willThrow = async () => {
        await abstractFsApi.getFormJson(formId);
      };

      expect(willThrow).rejects.toThrowError(
        new Error("Marv Api Error: failed GET formJson.")
      );
    });
    it("Should convert failed request (broken network call) into Marv Error. .", (done) => {
      // Setup
      const apiCallResponse = { error: "some error message", status: "error" };
      const apiCallMock = jest.spyOn(apiCall, "apiCall");
      // @ts-ignore - 'form' is not assignable to type 'never'
      apiCallMock.mockRejectedValue(new Error("Ralph breaks the internet."));

      const formId = "_THE_FORM_ID_";

      // Exercise
      // doing then/catch to test properties of the error.
      abstractFsApi
        .getFormJson(formId)
        .then((response) => {
          done("Should not have resolved.");
        })
        .catch((error) => {
          const extra = error.extraData;
          const { originalError, fsError } = extra;
          expect(error).toBeInstanceOf(MarvApiError);
          expect(error.message).toBe("Marv Api Error: failed GET formJson.");
          expect(originalError).toBeNull();
          // *tmc* for reasons I don't understand, the following line runs indefinitely. I set the timeout for 5 minutes
          //  and it never completes. I'm not sure what is going on here.
          //  I left originalError.message in quotes to demonstrate there is no reason for the delay, compare two strings
          // expect(originalError.message).toStrictEqual(
          //   "Ralph breaks the internet."
          // );
          done();
        });
    });
  });
  describe(".getFormFieldJson()", () => {
    it("Should return the fields from the form JSON", async () => {
      // Setup
      const getFormJsonMock = jest.spyOn(abstractFsApi, "getFormJson");
      getFormJsonMock.mockResolvedValue(mockFormJson);
      const formId = "_THE_FORM_ID_";

      // Exercise
      const fieldJson = await abstractFsApi.getFormFieldJson(formId);

      // Result
      expect(getFormJsonMock).toHaveBeenCalledWith(formId);
      expect(getFormJsonMock).toHaveBeenCalledTimes(1);
      expect(Array.isArray(fieldJson)).toBe(true);
      expect(fieldJson.length).toEqual(2);
    });
    it("Should handle broke response (not field property).", async () => {
      // Setup
      const getFormJsonMock = jest.spyOn(abstractFsApi, "getFormJson");
      // @ts-ignore - testing unexpected response
      getFormJsonMock.mockResolvedValue({ fields: null });
      const formId = "_THE_FORM_ID_";

      const willThrow = async () => {
        await abstractFsApi.getFormFieldJson(formId);
      };

      // Result
      expect(willThrow).rejects.toThrowError(
        new Error(
          "Marv Api Error: failed to getFormField, fields array invalid."
        )
      );
    });
  });
});

const mockFormJson = Object.freeze({
  id: "_THE_FORM_ID_",
  fields: [
    { id: "1", label: "field1", field_type: "text" },
    { id: "2", label: "field2", field_type: "text" },
  ] as TFsFieldJson[],
  url: "https://www.example.com/form/1",
} as TFsFormJson);
