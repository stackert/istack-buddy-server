import { IMarvApiUniversalResponse } from '../../../ApiRequester/fsApi/MarvApiUniversalResponse';
import { TChatMessage } from './types';
import { store, messageActions } from '../../../state';
const handleApiError = (apiResponse: IMarvApiUniversalResponse<any>) => {
  // @ts-ignore - this is a fake id
  const message = {
    role: 'error',
    contentText:
      'ERROR MARV INTERNAL/EXTERNAL API CALL: <code><pre>' +
      JSON.stringify(apiResponse, null, 2) +
      '</pre></code>',
    created_at: Math.floor(Date.now() / 1000),
    messageId: 'error' + Math.floor(Date.now() / 1000),
  } as TChatMessage;
  console.log('onApiError', message);
  console.log('*tmc* fix - this needs to dispatch');
  store.dispatch(messageActions.messageAdded(message));
};

export { handleApiError };
