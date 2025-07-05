import { IRequestConfig } from './types';

const apiCall = <T>(requestConfig: IRequestConfig): Promise<T> => {
  //
  return new Promise((resolve, reject) => {
    console.log({ apiCall: { requestConfig } });
    fetch(requestConfig.url, {
      method: requestConfig.httpMethod,
      headers: requestConfig.headers,
      // mode: 'no-cors',
      body: isString(requestConfig.body)
        ? (requestConfig.body as string)
        : (JSON.stringify(requestConfig.body) as string),
    })
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        resolve(data);
      })
      .catch((error) => {
        console.log({ apiCall: { error } });
        reject(error);
      });
  });
};

export { apiCall };
const isString = (value: any): boolean => {
  return typeof value === 'string';
};
