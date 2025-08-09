import { IMarvApiUniversalResponse, FsRestrictedApiRoutesEnum } from './types';

export interface ToolResponse {
  robotResponse: {
    status: 'ok' | 'error';
    message: string;
  };
  chatResponse?: {
    status: 'ok' | 'error';
    message: string;
  };
}

/**
 * Transform Marv tool response into robot and chat responses
 * @param functionName - The name of the function that was called
 * @param functionResponse - The response from the Marv API
 * @returns Object containing robot response and optional chat response
 */
export function transformMarvToolResponse(
  functionName: string,
  functionResponse: IMarvApiUniversalResponse<any>,
): ToolResponse {
  // Check if this is a large response that should be sent to chat
  const isLargeResponse = isLargeToolResponse(functionName, functionResponse);

  if (isLargeResponse) {
    // For large responses, send success to robot and full data to chat
    return {
      robotResponse: {
        status: 'ok',
        message: `${functionName} completed successfully. Results have been sent to the conversation.`,
      },
      chatResponse: {
        status: 'ok',
        message: `${JSON.stringify(functionResponse || {})}`,
      },
    };
  } else {
    // For small responses, just return success to robot
    return {
      robotResponse: {
        status: 'ok',
        message: `${functionName} completed successfully\n\nResult: <pre><code>${JSON.stringify({ debug: functionResponse }, null, 2)}</code></pre>`,
      },
    };
  }
}

/**
 * Check if a tool response is considered "large" and should be sent as a chat message
 * @param functionName - The name of the function that was called
 * @param functionResponse - The response from the Marv API
 * @returns true if the response should be sent as a chat message
 */
function isLargeToolResponse(
  functionName: string,
  functionResponse: IMarvApiUniversalResponse<any>,
): boolean {
  // Define which functions typically return large responses
  const largeResponseFunctions = [
    FsRestrictedApiRoutesEnum.FormAndRelatedEntityOverview,
    FsRestrictedApiRoutesEnum.FormLogicValidation,
    FsRestrictedApiRoutesEnum.FormCalculationValidation,
  ];

  // Check if this function typically returns large responses
  if (
    largeResponseFunctions.includes(functionName as FsRestrictedApiRoutesEnum)
  ) {
    return true;
  }

  // Also check if the response itself is large (over 1000 characters)
  const responseString = JSON.stringify(functionResponse.response);
  if (responseString.length > 1000) {
    return true;
  }

  return false;
}
