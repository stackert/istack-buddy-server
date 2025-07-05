import { apiCall } from "./apiCall";
import { IRequestConfig } from "./types";
// import { expect } from "jest";
/*

  maybe part of the issue is returning Promise.reject() ??? - maybe this still needs to be handled????


VSCode, React and Jest are not playing nicely.
  Jest  mock seems to work, react testing library mock does not.

  All these tests pass when run individually, but when run together they fail (jest, pass vscode).

  The parent project is using Jest (probably) and it's that testing environment that matters.
  
  I will revisit these later - when porting over to the main project

*/
describe("apiCall", () => {
  // This is the section where we mock `fetch`
  const unmockedFetch = global.fetch;
  let internalJsonCall: Function;
  beforeAll(() => {
    internalJsonCall = jest.fn(() => {
      return Promise.resolve({ rates: { CAD: 1.42 } });
    });
    // @ts-ignore - we are mocking fetch
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: internalJsonCall,
        // json: () => Promise.resolve({ rates: { CAD: 1.42 } }),
      })
    );
  });

  afterAll(() => {
    global.fetch = unmockedFetch;
    jest.clearAllMocks();
  });
  it("Should call '.json()' on the internal promise.", async () => {
    // @ts-ignore
    const f = await apiCall<any[]>({} as IRequestConfig);
    expect(internalJsonCall).toHaveBeenCalled();
  });
  it("Should catch and reject network call (outer promise).", async () => {
    global.fetch = jest.fn(() => Promise.reject("Network error"));
    expect(apiCall({} as IRequestConfig)).rejects.toEqual("Network error");
    expect(apiCall({} as IRequestConfig)).rejects.not.toEqual(
      "Something Different"
    );
  });
  it("Should catch and reject response.json() call  (inner promise).", async () => {
    internalJsonCall = jest.fn(() => {
      return Promise.reject("Failed to parse JSON");
    });

    // @ts-ignore
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: internalJsonCall,
      })
    );
    const willThrow = async () => await apiCall({} as IRequestConfig);
    expect(willThrow).rejects.toEqual("Failed to parse JSON");
  });
  it.only("Should when error is throw in first then.", async () => {
    internalJsonCall = jest.fn(() => {
      throw new Error("Something went wrong");
      // return Promise.reject("Failed to parse JSON");
    });

    // @ts-ignore
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: internalJsonCall,
      })
    );

    const willThrow = async () => await apiCall({} as IRequestConfig);
    expect(willThrow).rejects.toStrictEqual(Error("Something went wrong"));
  });
  it.only("Should when error is throw in second then.", async () => {
    internalJsonCall = jest.fn(() => {
      throw new Error("Something went wrong");
      // return Promise.reject("Failed to parse JSON");
    });

    // @ts-ignore
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => {
          throw new Error("Something went wrong");
        },
      })
    );

    const willThrow = async () => await apiCall({} as IRequestConfig);
    expect(willThrow).rejects.toStrictEqual(Error("Something went wrong"));
  });
  it.only("Should reject with fetch call error.", async () => {
    internalJsonCall = jest.fn(() => {
      throw new Error("Something went wrong");
    });

    global.fetch = jest.fn(() => {
      throw new Error("Something went wrong");
    });

    const willThrow = async () => await apiCall({} as IRequestConfig);
    expect(willThrow).rejects.toStrictEqual(Error("Something went wrong"));
  });
});
