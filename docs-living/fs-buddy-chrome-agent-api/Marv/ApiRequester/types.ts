interface IRequestConfig {
  apiKey?: string; // this will most likely be in the header. In those cases this is unnecessary
  url: string;
  headers: HeadersInit; // object;
  httpMethod: "POST" | "GET" | "PUT";
  body?: object | string | undefined | null; // incase we forget to stringify, we will do it automatically
}

export type { IRequestConfig };
