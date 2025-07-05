import { fsApiCallWrapper } from "./fsApiCallWrapper";
import { MarvApiError } from "../MarvApiError";
import { IRequestConfig } from "../types";
import * as apiCall from "../apiCall";
import { MarvApiUniversalResponse } from "./MarvApiUniversalResponse";
describe("fsApiCallWrapper", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  it("should make a successful API request and return the response", async () => {
    const expectedResponse = {
      form: "json",
    };

    const apiCallMock = jest.spyOn(apiCall, "apiCall");
    // @ts-ignore -  'form' is not assignable to type 'never'
    apiCallMock.mockReturnValue({ form: "json" });

    const response = await fsApiCallWrapper(sainFormstackRequest);

    expect(apiCallMock).toHaveBeenCalledWith(sainFormstackRequest);
    expect(response).toBeInstanceOf(MarvApiUniversalResponse);
    expect(response.errorItems).toStrictEqual(null);
    expect(response.isSuccess).toStrictEqual(true);
    expect(response.response).toStrictEqual({ form: "json" });
    expect(response.status).toStrictEqual("success");
  });

  it("should throw a MarvApiError when the API request fails", async () => {
    const apiCallMock = jest.spyOn(apiCall, "apiCall");
    apiCallMock.mockReturnValue({
      // @ts-ignore -  'status' is not assignable to type 'never'
      status: "error",
      error: "This was a test. This was only a test.",
    });

    const response = await fsApiCallWrapper(sainFormstackRequest);
    // await expect(fsApiCallWrapper(sainFormstackRequest)).rejects.toThrow(
    //   new MarvApiError("Marv Api Error: This was a test. This was only a test.")
    // );

    expect(apiCallMock).toHaveBeenCalledWith(sainFormstackRequest);
    expect(response).toBeInstanceOf(MarvApiUniversalResponse);
    expect(response.errorItems).toStrictEqual([
      { error: "This was a test. This was only a test.", status: "error" },
    ]);
    expect(response.isSuccess).toStrictEqual(false);
    expect(response.response).toStrictEqual(null);
    expect(response.status).toStrictEqual("error");
  });

  it("should throw/rethrow Lower level errors", async () => {
    const apiCallMock = jest.spyOn(apiCall, "apiCall");
    apiCallMock.mockRejectedValue(new Error("The network is broke."));
    const response = await fsApiCallWrapper(sainFormstackRequest);

    expect(apiCallMock).toHaveBeenCalledWith(sainFormstackRequest);
    expect(response).toBeInstanceOf(MarvApiUniversalResponse);
    // @ts-ignore -  debug - possible null
    expect(response.errorItems[0]).toBeInstanceOf(Error);
    // @ts-ignore -  debug - possible null
    expect(response.errorItems[0].message).toStrictEqual(
      "The network is broke."
    );
    expect(response.isSuccess).toStrictEqual(false);
    expect(response.response).toStrictEqual(null);
    expect(response.status).toStrictEqual("error");
  });
});

const sainFormstackRequest: IRequestConfig = Object.freeze({
  url: "https://www.example.com/api/dir/resource.ext?param0=value0&param1=value1",
  httpMethod: "GET",
  headers: {
    "content-type": "application/json",
    Authorization: `Bearer THE_API_KEY`,
  },
});
