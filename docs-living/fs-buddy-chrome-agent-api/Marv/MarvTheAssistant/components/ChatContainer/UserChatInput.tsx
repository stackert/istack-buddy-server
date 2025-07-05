import React, { useEffect, useState } from 'react';

import {
  MessageContentImageFile,
  MessageContentText,
  ThreadMessage,
} from 'openai/resources/beta/threads/messages/messages';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { ChatEngine } from '../../../ChatEngine';
import { useChatEngineContext } from '../../../Context/MarvContext';
import type { TFileCacheItem } from '../../../state';
import {
  fileCacheActions,
  messageActions,
  store,
  waitOpenAiResponse,
} from '../../../state';
import { handleApiError } from './handleApiError';
import { TChatMessage } from './types';
import { resolve } from 'path';
const modulusAsDotsOf = (period: number) => {
  return '.'.repeat((period || 0) % 5);
};

let thePollCount = 0; // poor man's background process updater mechanism
interface UserChatInputProps {
  initialMessages?: TChatMessage[];
}

const UserChatInput: React.FC<UserChatInputProps> = (
  params: UserChatInputProps
) => {
  const { getRobotInstance } = useChatEngineContext();

  const [pollCount, setPollCount] = React.useState<number>(0);
  const [inputTextValue, setInputTextValue] = useState('');
  const [systemBusyMessage, setSystemBusyMessage] = React.useState<
    string | null
  >(null);

  useEffect(() => {
    // this will likely require a cleanup elsewhere (conversation )
    const marv = getRobotInstance();
    ChatEngine.resetInstance();
  }, [params.initialMessages]);

  useEffect(() => {
    if (
      Array.isArray(params.initialMessages) &&
      params.initialMessages.length > 0
    ) {
      const marv = getRobotInstance();
      const waitMarvReady = () => {
        const maxRetryCount = 5;
        return new Promise((resolve, reject) => {
          let retryCount = 0;
          setInterval(() => {
            retryCount++;
            if (marv.isReady) {
              resolve(true);
            } else if (retryCount > maxRetryCount) {
              reject(
                `Marv not ready after maximum retry count exceeded. MAX_RETRY_COUNT: ${maxRetryCount}.`
              );
            }
          }, 200);
        });
      };

      console.log({ params });
      marv.waitUntilInitialized().then(() => {
        sendBatchMessagesAndStart({
          messages: params.initialMessages || [],
          handlePollingHeartBeat: handlePollingHeartBeat,
          userMessage: inputTextValue,
          getRobotInstance: getRobotInstance,
          onFinished: () => {
            setSystemBusyMessage(null);
          },
        });
      });
    }
  }, []);

  const handleMessageChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setInputTextValue(event.target.value);
  };

  const handlePollingHeartBeat = async (
    pollCount?: number,
    statusMessage = ''
  ) => {
    if (statusMessage !== '') {
      const periodsCount = thePollCount % 3;
      // it seems thePollCount has a different value here than on page.
      // when using it here and comparing it on page, this one is always behind the page thePollCount.
      const sysMessage = `${statusMessage} ${'.'.repeat(periodsCount)}`;
      setSystemBusyMessage(sysMessage);
    }

    setPollCount(thePollCount++);
  };

  const makeMarvBig = () => {
    const action = {
      type: 'MarvTheAssistant/SET_VIEW_STATE',
      payload: {
        MarvTheAssistant: {
          viewState: 'fullScreen',
        },
      },
    };
    store.dispatch(action);
    setInputTextValue('');
  };

  const showGoCommands = () => {
    const userMessage: TChatMessage = {
      contentText: `
        <ul>
          <li>
            <h4>go_big</h4>
            <p>make marv window big.</p>
          </li>
          <li>
            <h4>go_home</h4>
            <p>make marv window normal.</p>
          </li>
          <li>
            <h4>go_what</h4>
            <p>This window.</p>
          </li>
        </ul>
      `,
      messageId: new Date().getTime() / 1000 + '',

      // @ts-ignore - "marv" is not a valid role, but we want to test the UI
      role: 'other', // "user",
      created_at: new Date().getTime() / 1000,
    };
    setInputTextValue('');
    store.dispatch(messageActions.messageAdded(userMessage));
  };

  const makeMarvNormal = () => {
    const action = {
      type: 'MarvTheAssistant/SET_VIEW_STATE',
      payload: {
        MarvTheAssistant: {
          viewState: 'parentContained',
        },
      },
    };
    store.dispatch(action);

    setInputTextValue('');
  };

  const handleInsertNewMessageThunk = async () => {
    // *tmc* - most of this should be in a middleware/external function/file
    // something messageHub - (inputMessage) => outputMessage | error (probably use uiUniversalResponse)

    if (inputTextValue.trim() === '') return;
    if (inputTextValue.trim() === 'go_big') return makeMarvBig();
    if (inputTextValue.trim() === 'go_home') return makeMarvNormal();
    if (inputTextValue.trim() === 'go_what') return showGoCommands();

    console.log({ params });
    // *tmc* this will throw an ugly error at the user..
    // this 'try' should be caught in the getRobotInstance() (which rethrows)
    let marv: ChatEngine;
    try {
      // pretty sure don't have to await  -- this probably doesn't need try
      marv = getRobotInstance(); // await ChatEngine.getInstance();
    } catch (e) {
      console.log({
        handleInsertNewMessageThunk: {
          message: 'Failed to get robot instance',
          error: e,
        },
      });
      return;
    }

    // @ts-ignore - this is a consequence of poor error management.
    // should not need to ignore once the error handler is in place.
    const threadMessage = await marv.pushMessage({
      content: inputTextValue,
      role: 'user',
    });
    const userMessage: TChatMessage = {
      contentText: inputTextValue,
      messageId: threadMessage.id,
      // we want a the messageId so we wait, which causes a bit of a delay in the UI.
      role: 'user',
      created_at: threadMessage.created_at,
    };
    setInputTextValue('');
    // params.onMessageCreated && (await params.onMessageCreated(userMessage));
    store.dispatch(messageActions.messageAdded(userMessage));

    store
      .dispatch(
        waitOpenAiResponse({
          onHeartBeat: handlePollingHeartBeat,
          userMessage: userMessage,
          onApiError: handleApiError,
          getRobotInstance: getRobotInstance,
        })
      )
      .unwrap()
      .then(async (originalPromiseResult: any) => {
        const assistantMessage = originalPromiseResult;
        setSystemBusyMessage(null);

        const textMessages = (assistantMessage as ThreadMessage).content.filter(
          (message) => message.type === 'text'
        );
        const imageFiles = (assistantMessage as ThreadMessage).content
          .filter((message) => message.type === 'image_file')
          .map((message) => {
            return {
              base64: null,
              // tmc - this is goofy fix the typing
              type: 'image_file' as 'image_file', //message.type,
              fileId: (message as MessageContentImageFile).image_file.file_id,
            };
          });
        const textMessage = textMessages.pop() as MessageContentText;
        const newAssistantMessage: TChatMessage = {
          contentText: textMessage.text.value, // *tmc* is there every a case .content will be malformed?
          messageId: (assistantMessage as ThreadMessage)?.id || '_NO_ID_',
          role: 'assistant',
          created_at: assistantMessage.created_at,
          imageFiles: imageFiles,
        };

        try {
          store.dispatch(messageActions.messageAdded(newAssistantMessage));
        } catch (e) {
          console.log({ 'error getting base64': e });
        }

        try {
          /// probably should be batch, insertMany
          imageFiles.forEach(async (imageFile) => {
            store.dispatch(
              fileCacheActions.insertOne(imageFile as TFileCacheItem)
            );
          });
        } catch (e) {
          console.log({ 'error getting base64': e });
        }

        // store.dispatch(messageActions.messageAdded(newAssistantMessage));
      })
      .catch((rejectedValueOrSerializedError: any) => {
        console.log({ rejectedValueOrSerializedError });
      });
  };

  return (
    <div className="user-input" style={{ textAlign: 'center' }}>
      <div>
        <InputTextarea
          // style={{ width: '-webkit-fill-available', resize: 'both' }}
          style={{ width: '90%', resize: 'both' }}
          value={inputTextValue}
          onChange={handleMessageChange}
        />
      </div>
      <Button onClick={handleInsertNewMessageThunk}>Send to Marv</Button>
      <div>
        {systemBusyMessage} '{modulusAsDotsOf(thePollCount)}' {thePollCount}
      </div>
    </div>
  );
};

export { UserChatInput };

`
  Need to figure out how to call a batch (initialMessags)


`;
interface sendBatchMessagesAndStartProps {
  messages: TChatMessage[];
  handlePollingHeartBeat: () => Promise<void>;
  userMessage: string;
  getRobotInstance: () => ChatEngine;
  onFinished?: () => void;
}
const sendBatchMessagesAndStart = async (
  params: sendBatchMessagesAndStartProps
) => {
  const marv = params.getRobotInstance();

  const userMessagesSettled = await Promise.allSettled(
    params.messages.map((chatMessage, index): Promise<ThreadMessage> => {
      const threadMessage = marv.pushMessage({
        content: chatMessage.contentText,
        role: 'user',
      });
      return threadMessage;
    })
  );

  userMessagesSettled.forEach((settledPromise, index) => {
    if (settledPromise.status === 'rejected') {
      console.log({ settledPromise });
    } else {
      const threadMessage = settledPromise.value;
      const userMessage: TChatMessage = {
        contentText: params.messages[index].contentText,
        messageId: threadMessage.id, // threadMessage.id,
        // we want a the messageId so we wait, which causes a bit of a delay in the UI.
        role: 'user',
        created_at: threadMessage.created_at,
      };
      store.dispatch(messageActions.messageAdded(userMessage));
    }
  });
  // console.log({ userMessagesSettled });
  // params.onMessageCreated && (await params.onMessageCreated(userMessage));

  store
    .dispatch(
      waitOpenAiResponse({
        onHeartBeat: params.handlePollingHeartBeat,
        userMessage: {
          contentText: 'THIS SHOULD  NOT BE USED??',
          messageId: Date.now() + '',
          // we want a the messageId so we wait, which causes a bit of a delay in the UI.
          role: 'user',
          created_at: Date.now(),
        }, // userMessage,
        onApiError: handleApiError,
        getRobotInstance: params.getRobotInstance,
      })
    )
    .unwrap()
    .then(async (originalPromiseResult: any) => {
      const assistantMessage = originalPromiseResult;
      params.onFinished && params.onFinished();
      const textMessages = (assistantMessage as ThreadMessage).content.filter(
        (message) => message.type === 'text'
      );
      const imageFiles = (assistantMessage as ThreadMessage).content
        .filter((message) => message.type === 'image_file')
        .map((message) => {
          return {
            base64: null,
            // tmc - this is goofy fix the typing
            type: 'image_file' as 'image_file', //message.type,
            fileId: (message as MessageContentImageFile).image_file.file_id,
          };
        });
      const textMessage = textMessages.pop() as MessageContentText;
      const newAssistantMessage: TChatMessage = {
        contentText: textMessage.text.value, // + JSON.stringify(assistantMessage), // *tmc* is there ever a case .content will be malformed?
        messageId: (assistantMessage as ThreadMessage).id,
        role: 'assistant',
        created_at: assistantMessage.created_at,
        imageFiles: imageFiles,
      };

      try {
        store.dispatch(messageActions.messageAdded(newAssistantMessage));
      } catch (e) {
        console.log({ 'error getting base64': e });
      }

      try {
        /// probably should be batch, insertMany
        imageFiles.forEach(async (imageFile) => {
          store.dispatch(
            fileCacheActions.insertOne(imageFile as TFileCacheItem)
          );
        });
      } catch (e) {
        console.log({ 'error getting base64': e });
      }

      // store.dispatch(messageActions.messageAdded(newAssistantMessage));
    })
    .catch((rejectedValueOrSerializedError: any) => {});
};
