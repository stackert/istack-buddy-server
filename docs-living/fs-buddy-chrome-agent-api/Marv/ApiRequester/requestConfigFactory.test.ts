import { requestConfigFactory } from "./requestConfigFactory";

describe("requestConfigFactory", () => {
  it("should return the correct request config object", () => {
    const url = "https://example.com/api";
    const apiKey = "my-api-key";
    const httpMethod = "POST";
    const body = { data: "example" };
    const headers = {
      "content-type": "application/json",
      Authorization: `Bearer my-api-key`,
    };

    const expectedConfig = {
      url,
      apiKey,
      httpMethod,
      body,
      headers,
    };

    const config = requestConfigFactory({
      url,
      apiKey,
      httpMethod,
      body,
      headers,
    });

    expect(config).toEqual(expectedConfig);
  });

  it.only("should use default values if not provided", () => {
    const url = "https://example.com/api";
    const apiKey = "my-api-key";
    const headers = { "content-type": "application/json" };

    const expectedConfig = {
      url,
      apiKey,
      httpMethod: "GET",
      headers,
    };

    const config = requestConfigFactory({
      url,
      apiKey,
      headers,
    });

    expect(config).toEqual(expectedConfig);
  });
});
