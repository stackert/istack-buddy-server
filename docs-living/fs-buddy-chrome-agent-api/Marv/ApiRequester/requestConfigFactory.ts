import { IRequestConfig } from "./types";

interface IRequestConfigFactoryProps {
  url: string;
  apiKey: string;
  httpMethod?: "POST" | "GET";
  body?: object | string | undefined;
  // headers?: object;
  headers: HeadersInit;
}

const requestConfigFactory = ({
  url,
  apiKey,
  httpMethod = "GET",
  body,
  headers = {},
}: IRequestConfigFactoryProps): IRequestConfig => {
  return {
    url,
    apiKey,
    httpMethod,
    body,
    headers,
  };
};

export { requestConfigFactory };
