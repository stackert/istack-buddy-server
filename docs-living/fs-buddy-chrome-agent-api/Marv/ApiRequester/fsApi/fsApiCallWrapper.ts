import { IRequestConfig } from '../types';
import { apiCall } from '../apiCall';
import { MarvApiUniversalResponse } from './MarvApiUniversalResponse';
type FormstackErrorType = { error: string; status: string };

/**
 *
 * @param request IRequestConfig
 * @returns MarvApiUniversalResponse<T>
 *
 */
const fsApiCallWrapper = async <T>(
  request: IRequestConfig
): Promise<MarvApiUniversalResponse<T>> => {
  try {
    console.log({ fsApiCallWrapper: { request } });
    const response = await apiCall<T & FormstackErrorType>(request);

    if (response.status === 'error') {
      return new MarvApiUniversalResponse<T>('error', undefined, response);
    } else {
      return new MarvApiUniversalResponse<T>('success', response as T);
    }
  } catch (error: any) {
    return new MarvApiUniversalResponse<T>('error', undefined, error);
  }
};

export { fsApiCallWrapper };
