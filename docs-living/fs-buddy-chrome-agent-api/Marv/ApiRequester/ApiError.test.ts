import { ApiError } from "./ApiError";

describe("ApiError", () => {
  it("should create an instance of ApiError", () => {
    const message = "Test error message";
    const extraData = { key: "value" };

    const apiError = new ApiError(message, extraData);

    expect(apiError).toBeInstanceOf(ApiError);

    expect(apiError.message).toBe(message);
    expect(apiError.extraData).toStrictEqual(extraData);
  });

  it("should have the correct name and code", () => {
    const message = "Test error message";
    const extraData = { key: "value" };

    const apiError = new ApiError(message, extraData);
    expect(apiError.name).toBe("ApiError");
    expect(apiError.code).toBe("API_ERROR");
    expect(apiError.extraData).toStrictEqual(extraData);
  });
});
