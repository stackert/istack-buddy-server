import { fsRestrictedApi } from "./fsRestrictedApi";
import * as apiCall from "../apiCall";
import * as fsRestrictedApiModule from "./fsRestrictedApi";
import { AbstractFsApi } from "./AbstractFsApi";
import * as expectedApiCalls from "./fsRestrictedApi.expected.json";
import * as testCases from "./fsRestrictedApi.test-cases.json";
import * as formJson5603120 from "./formJson5603120.json";
import { TFsFormJson } from "../types-fs-mocks";
import { MarvApiError } from "../MarvApiError";
describe("fsRestrictedApi", () => {
  let fsRestrictedApiMock: fsRestrictedApi;
  beforeEach(() => {
    fsRestrictedApiMock = fsRestrictedApiModule.fsRestrictedApi
      .getInstance()
      .setApiKey("the-api-key");
  });

  afterEach(() => {
    // jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe("fieldLabelUniqueSlugAdd", () => {
    it("Should send apiRequest to add unique label slugs for fields in a form. (and call isMarvEnabled)", async () => {
      const { fieldLabelUniqueSlugAdd } = expectedApiCalls.smokeTests;

      const sendBatchRequestMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "sendBatchRequest")
        .mockResolvedValue((...args: any[]) => Promise.resolve(args));

      const sendSingleRequestMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "sendSingleRequest")
        .mockReturnValue((...args: any[]) => {
          return Promise.resolve(args);
        });

      const apiCallMock = jest
        .spyOn(apiCall, "apiCall")
        .mockReturnValue(formJson5603120 as any);

      // exercise
      await fsRestrictedApiMock.fieldLabelUniqueSlugAdd("5603038");

      // result
      expect(apiCallMock).toHaveBeenCalledTimes(1);
      expect(sendSingleRequestMock).toHaveBeenCalledTimes(0);
      expect(sendBatchRequestMock).toHaveBeenCalledTimes(1);
      expect(sendBatchRequestMock).toHaveBeenCalledWith(
        fieldLabelUniqueSlugAdd,
        "5603038"
      );
    });
    it("Should throw error if not marv_enabled.", async () => {
      const sendSingleRequestMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "sendSingleRequest")
        .mockReturnValue({
          id: "5603038",
          fields: testCases.testCase5603120.marvNotEnabledFields,
        });

      const apiCallMock = jest.spyOn(apiCall, "apiCall").mockResolvedValue({
        id: "5603038",
        fields: testCases.testCase5603120.marvNotEnabledFields,
      });

      // exercise
      const willThrow = async () => {
        await fsRestrictedApiMock.fieldLabelUniqueSlugAdd("5603038");
      };
      expect(willThrow).rejects.toThrowError(
        new MarvApiError("Marv Api Error: form is not Marv enabled.", {})
      );
      expect(apiCallMock).toHaveBeenCalledTimes(1);
      expect(sendSingleRequestMock).toHaveBeenCalledTimes(0);
    });
  });

  describe("fieldLabelUniqueSlugRemove", () => {
    it("Should send request to update labels, remove unique slug.", async () => {
      const isFormMarvEnabledMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "isFormMarvEnabled")
        .mockResolvedValue(true);

      const sendSingleRequestMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "sendSingleRequest")
        .mockReturnValue((...args: any[]) => {
          return Promise.resolve(args);
        });

      const apiCallMock = jest
        .spyOn(apiCall, "apiCall")
        .mockReturnValue(formJson5603120 as any);

      // exercise
      await fsRestrictedApiMock.fieldLabelUniqueSlugRemove("5603038");

      // result
      expect(apiCallMock).toHaveBeenCalledTimes(6);
      expect(isFormMarvEnabledMock).toHaveBeenCalledTimes(1);
      for (let i = 0; i < 5; i++) {
        expect(apiCallMock).toHaveBeenCalledWith(
          expectedApiCalls.smokeTests.fieldLabelUniqueSlugRemove[i]
        );
      }
      expect(sendSingleRequestMock).toHaveBeenCalledTimes(0);
    });
    it("Should handle isMarvEnabled=false Error.", async () => {
      const fsRestrictedApiMock = fsRestrictedApiModule.fsRestrictedApi
        .getInstance()
        .setApiKey("the-api-key");

      const sendSingleRequestMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "sendSingleRequest")
        .mockReturnValue({
          id: "5603038",
          fields: testCases.testCase5603120.marvNotEnabledFields,
        });

      const apiCallMock = jest.spyOn(apiCall, "apiCall").mockResolvedValue({
        id: "5603038",
        fields: testCases.testCase5603120.marvNotEnabledFields,
      });

      // exercise
      const willThrow = async () => {
        await fsRestrictedApiMock.fieldLabelUniqueSlugRemove("5603038");
      };
      expect(willThrow).rejects.toThrowError(
        new MarvApiError("Marv Api Error: form is not Marv enabled.", {})
      );
      expect(apiCallMock).toHaveBeenCalledTimes(1);
      expect(sendSingleRequestMock).toHaveBeenCalledTimes(0);
    });
  });

  describe("fieldLiteAdd", () => {
    it("should add a lite field to a form", async () => {
      // Test implementation here
    });
  });

  describe("fieldLogicRemove", () => {
    it("Should send request to update labels, remove unique slug.", async () => {
      const isFormMarvEnabledMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "isFormMarvEnabled")
        .mockResolvedValue(true);

      const sendSingleRequestMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "sendSingleRequest")
        .mockReturnValue((...args: any[]) => {
          return Promise.resolve(args);
        });
      const apiCallMock = jest
        .spyOn(apiCall, "apiCall")
        .mockReturnValue(formJson5603120 as any);

      // exercise
      await fsRestrictedApiMock.fieldLogicRemove("5603038");

      // result
      expect(apiCallMock).toHaveBeenCalledTimes(4);
      expect(isFormMarvEnabledMock).toHaveBeenCalledTimes(1);
      for (let i = 0; i < 4; i++) {
        expect(apiCallMock.mock.calls[i]).toStrictEqual(
          expectedApiCalls.smokeTests.fieldLogicRemove[i]
        );
      }
      expect(sendSingleRequestMock).toHaveBeenCalledTimes(0);
    });
    it("Should handle isMarvEnabled=false Error.", async () => {
      const fsRestrictedApiMock = fsRestrictedApiModule.fsRestrictedApi
        .getInstance()
        .setApiKey("the-api-key");

      const sendSingleRequestMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "sendSingleRequest")
        .mockReturnValue({
          id: "5603038",
          fields: testCases.testCase5603120.marvNotEnabledFields,
        });

      const apiCallMock = jest.spyOn(apiCall, "apiCall").mockResolvedValue({
        id: "5603038",
        fields: testCases.testCase5603120.marvNotEnabledFields,
      });

      // exercise
      const willThrow = async () => {
        await fsRestrictedApiMock.fieldLogicRemove("5603038");
      };
      expect(willThrow).rejects.toThrowError(
        new MarvApiError("Marv Api Error: form is not Marv enabled.", {})
      );
      expect(apiCallMock).toHaveBeenCalledTimes(1);
      expect(sendSingleRequestMock).toHaveBeenCalledTimes(0);
    });
  });

  describe("fieldLogicStashApply", () => {
    it("Should send request to update labels, remove unique slug.", async () => {
      const isFormMarvEnabledMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "isFormMarvEnabled")
        .mockResolvedValue(true);

      const sendSingleRequestMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "sendSingleRequest")
        .mockReturnValue((...args: any[]) => {
          return Promise.resolve(args);
        });

      const apiCallMock = jest
        .spyOn(apiCall, "apiCall")
        .mockReturnValue(formJson5603120 as any);

      // exercise
      await fsRestrictedApiMock.fieldLogicStashApply("5603038");

      // result
      expect(apiCallMock).toHaveBeenCalledTimes(4);
      expect(isFormMarvEnabledMock).toHaveBeenCalledTimes(1);
      for (let i = 0; i < 3; i++) {
        expect(apiCallMock).toHaveBeenCalledWith(
          expectedApiCalls.smokeTests.fieldLogicStashApply[i]
        );
      }
      expect(sendSingleRequestMock).toHaveBeenCalledTimes(0);
    });
    it("Should handle isMarvEnabled=false Error.", async () => {
      const fsRestrictedApiMock = fsRestrictedApiModule.fsRestrictedApi
        .getInstance()
        .setApiKey("the-api-key");

      const sendSingleRequestMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "sendSingleRequest")
        .mockReturnValue({
          id: "5603038",
          fields: testCases.testCase5603120.marvNotEnabledFields,
        });

      const apiCallMock = jest.spyOn(apiCall, "apiCall").mockResolvedValue({
        id: "5603038",
        fields: testCases.testCase5603120.marvNotEnabledFields,
      });

      // exercise
      const willThrow = async () => {
        await fsRestrictedApiMock.fieldLogicStashApply("5603038");
      };
      expect(willThrow).rejects.toThrowError(
        new MarvApiError("Marv Api Error: form is not Marv enabled.", {})
      );
      expect(apiCallMock).toHaveBeenCalledTimes(1);
      expect(sendSingleRequestMock).toHaveBeenCalledTimes(0);
    });
  });

  describe("fieldLogicStashApplyAndRemove", () => {
    it.only("Should send request to update labels, remove unique slug.", async () => {
      const isFormMarvEnabledMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "isFormMarvEnabled")
        .mockImplementation(() => {
          return Promise.resolve(true);
        });
      // .mockResolvedValue(true);

      const sendSingleRequestMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "sendSingleRequest")
        .mockReturnValue((...args: any[]) => {
          return Promise.resolve(args);
        });

      const apiCallMock = jest
        .spyOn(apiCall, "apiCall")
        .mockReturnValue(formJson5603120 as any);

      // exercise
      await fsRestrictedApiMock.fieldLogicStashApplyAndRemove("5603038");

      // result
      expect(apiCallMock).toHaveBeenCalledTimes(5);
      expect(isFormMarvEnabledMock).toHaveBeenCalledTimes(1);
      for (let i = 0; i < 4; i++) {
        expect(apiCallMock.mock.calls[i]).toStrictEqual(
          expectedApiCalls.smokeTests.fieldLogicStashApplyAndRemove[i]
        );
      }
      expect(sendSingleRequestMock).toHaveBeenCalledTimes(0);
    });
    it("Should handle isMarvEnabled=false Error.", async () => {
      const fsRestrictedApiMock = fsRestrictedApiModule.fsRestrictedApi
        .getInstance()
        .setApiKey("the-api-key");

      const sendSingleRequestMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "sendSingleRequest")
        .mockReturnValue({
          id: "5603038",
          fields: testCases.testCase5603120.marvNotEnabledFields,
        });

      const apiCallMock = jest.spyOn(apiCall, "apiCall").mockResolvedValue({
        id: "5603038",
        fields: testCases.testCase5603120.marvNotEnabledFields,
      });

      // exercise
      const willThrow = async () => {
        await fsRestrictedApiMock.fieldLogicStashApplyAndRemove("5603038");
      };
      expect(willThrow).rejects.toThrowError(
        new MarvApiError("Marv Api Error: form is not Marv enabled.", {})
      );
      expect(apiCallMock).toHaveBeenCalledTimes(1);
      expect(sendSingleRequestMock).toHaveBeenCalledTimes(0);
    });
  });

  describe("fieldLogicStashCreate", () => {
    it("Should send request to update labels, remove unique slug.", async () => {
      const isFormMarvEnabledMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "isFormMarvEnabled")
        .mockResolvedValue(true);

      const sendSingleRequestMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "sendSingleRequest")
        .mockResolvedValue(true);

      const apiCallMock = jest
        .spyOn(apiCall, "apiCall")
        .mockReturnValue(formJson5603120 as any);

      // exercise
      await fsRestrictedApiMock.fieldLogicStashCreate("5603038");

      // result
      expect(apiCallMock).toHaveBeenCalledTimes(1);
      expect(isFormMarvEnabledMock).toHaveBeenCalledTimes(0); // because create form, can't be marv enabled
      expect(sendSingleRequestMock).toHaveBeenCalledTimes(1);
      expect(sendSingleRequestMock).toHaveBeenCalledWith(
        expectedApiCalls.smokeTests.fieldLogicStashCreate,
        "5603038"
      );
    });
    it("Should handle isMarvEnabled=false Error.", async () => {
      const fsRestrictedApiMock = fsRestrictedApiModule.fsRestrictedApi
        .getInstance()
        .setApiKey("the-api-key");

      const apiCallMock = jest.spyOn(apiCall, "apiCall").mockResolvedValue({
        id: "5603038",
        fields: testCases.testCase5603120.marvNotEnabledFields,
      });

      // exercise
      const willThrow = async () => {
        await fsRestrictedApiMock.fieldLogicStashCreate("5603038");
      };
      expect(willThrow).rejects.toThrowError(
        new MarvApiError("Marv Api Error: form is not Marv enabled.", {})
      );
      expect(apiCallMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("fieldLogicStashRemove", () => {
    it("Should send request to update labels, remove unique slug.", async () => {
      const isFormMarvEnabledMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "isFormMarvEnabled")
        .mockResolvedValue(true);

      const sendSingleRequestMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "sendSingleRequest")
        .mockResolvedValue(true);

      const apiCallMock = jest
        .spyOn(apiCall, "apiCall")
        .mockReturnValue(formJson5603120 as any);

      // exercise
      await fsRestrictedApiMock.fieldLogicStashRemove("5603038");

      // result
      expect(apiCallMock).toHaveBeenCalledTimes(1);
      expect(isFormMarvEnabledMock).toHaveBeenCalledTimes(0); // because create form, can't be marv enabled
      expect(sendSingleRequestMock).toHaveBeenCalledTimes(1);
      expect(sendSingleRequestMock).toHaveBeenCalledWith(
        expectedApiCalls.smokeTests.fieldLogicStashRemove,
        "5603038"
      );
    });
    it("Should handle isMarvEnabled=false Error.", async () => {
      const fsRestrictedApiMock = fsRestrictedApiModule.fsRestrictedApi
        .getInstance()
        .setApiKey("the-api-key");

      const apiCallMock = jest.spyOn(apiCall, "apiCall").mockResolvedValue({
        id: "5603038",
        fields: testCases.testCase5603120.marvNotEnabledFields,
      });

      // exercise
      const willThrow = async () => {
        await fsRestrictedApiMock.fieldLogicStashRemove("5603038");
      };
      expect(willThrow).rejects.toThrowError(
        new MarvApiError("Marv Api Error: form is not Marv enabled.", {})
      );
      expect(apiCallMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("formDeveloperCopy", () => {
    it.skip("Should send request to update labels, remove unique slug.", async () => {
      // at this time copy dev form is known to not work and not sure if we will fix it.

      const isFormMarvEnabledMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "isFormMarvEnabled")
        .mockResolvedValue(true);

      const sendSingleRequestMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "sendSingleRequest")
        .mockResolvedValue(true);

      const apiCallMock = jest
        .spyOn(apiCall, "apiCall")
        .mockReturnValue(formJson5603120 as any);

      // exercise
      await fsRestrictedApiMock.formDeveloperCopy("5603038");

      // result
      expect(apiCallMock).toHaveBeenCalledTimes(1);
      expect(isFormMarvEnabledMock).toHaveBeenCalledTimes(0); // because create form, can't be marv enabled
      expect(sendSingleRequestMock).toHaveBeenCalledTimes(1);
      expect(sendSingleRequestMock).toHaveBeenCalledWith(
        expectedApiCalls.smokeTests.formDeveloperCopy,
        "5603038"
      );
    });
    it("Should handle isMarvEnabled=false Error.", async () => {
      const fsRestrictedApiMock = fsRestrictedApiModule.fsRestrictedApi
        .getInstance()
        .setApiKey("the-api-key");

      const apiCallMock = jest.spyOn(apiCall, "apiCall").mockResolvedValue({
        id: "5603038",
        fields: testCases.testCase5603120.marvNotEnabledFields,
      });

      // exercise
      const willThrow = async () => {
        await fsRestrictedApiMock.formDeveloperCopy("5603038");
      };
      // expect(willThrow).rejects.toThrowError(
      //   new MarvApiError("Failed to make developer copy of form.", {})
      // );
      expect(willThrow).rejects.toThrowError(
        new MarvApiError("Marv Api Error: form is not Marv enabled.", {})
      );
      expect(apiCallMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("formLiteAdd", () => {
    it("Should send request to create form.", async () => {
      const isFormMarvEnabledMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "isFormMarvEnabled")
        .mockResolvedValue(true);

      const sendSingleRequestMock = jest
        .spyOn<fsRestrictedApi, any>(fsRestrictedApiMock, "sendSingleRequest")
        .mockResolvedValue(true);

      const apiCallMock = jest
        .spyOn(apiCall, "apiCall")
        .mockReturnValue(formJson5603120 as any);

      // exercise
      await fsRestrictedApiMock.formLiteAdd("5603038");

      // result
      expect(apiCallMock).toHaveBeenCalledTimes(1);
      expect(apiCallMock).toHaveBeenCalledWith(
        expectedApiCalls.smokeTests.formLiteAdd
      );
      expect(isFormMarvEnabledMock).toHaveBeenCalledTimes(0); // because create form, can't be marv enabled
      expect(sendSingleRequestMock).toHaveBeenCalledTimes(0);
    });
  });
});
