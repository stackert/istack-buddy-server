import {
  createEntityAdapter,
  createSlice,
  createAsyncThunk,
  applyMiddleware,
  //   import { createStore, applyMiddleware } from "redux";
} from '@reduxjs/toolkit';
import { TChatMessage } from '../MarvTheAssistant/components/ChatContainer/types';
import { ChatEngine } from '../ChatEngine';

const loggerMiddleware = (store: any) => (next: any) => (action: any) => {
  // This is the middleware function that gets called for each dispatched action
  console.log('Action:', action);

  // Call the specific function for each state update
  // yourSpecificFunction(action, store.getState());
  console.log({ middleWare: { action, store } });
  // Pass the action to the next middleware in the chain
  return next(action);
};

interface ICreateErrorMessageProps {
  type: string;
  text: string;
}

const createErrorMessage = (
  overrides: Partial<ICreateErrorMessageProps> = {}
) => {
  const errorMessage: TChatMessage = {
    role: 'assistant',
    // @ts-ignore - this needs to implement an interface that is not done yet
    id: 'error_' + Math.floor(Date.now() / 1000),
    content: [
      {
        ...{
          type: 'text',
          text: 'There was an error processing your request',
        },
        ...overrides,
      },
    ],
    // contentText: "There was an error processing your request",
    created_at: Math.floor(Date.now() / 1000),
    messageId: 'error' + Math.floor(Date.now() / 1000),
  };
  return errorMessage;
};

// this probably belongs in the other file
const waitOpenAiResponse = createAsyncThunk(
  'openai/waitResponse',

  async (
    params: {
      onHeartBeat: () => void;
      userMessage: TChatMessage;
      onApiError: (err: any) => void;
      getRobotInstance: () => ChatEngine;
    },
    // async monitorCompletedRun(
    //   onPollingHeartBeat?: (pollCount: number, statusMessage?: string) => void,
    //   onErrorNotifyUi?: (error: IMarvApiUniversalResponse<any>) => void,
    //   newErrorHandler?: (error: MarvApiError) => void
    // ): Promise<openai.Beta.Threads.Messages.ThreadMessage> {

    thunkApi
  ) => {
    const MAX_QUESTION_TEXT_LENGTH = 32768; // Marv (OpenAI) limit

    const marv = params.getRobotInstance();
    await marv.startRun();

    try {
      return await marv.monitorCompletedRun(
        params.onHeartBeat,
        params.onApiError,
        undefined
        // onApiError
      );
    } catch (err) {
      console.log({ err });
      return createErrorMessage();
    }
  }
);

// *tmc* not sure how to type this
const chatMessageAdapter = createEntityAdapter<TChatMessage, number | string>({
  selectId: (chatMessage: TChatMessage) => chatMessage.messageId as string,
  sortComparer: (a, b) => {
    return a.created_at < b.created_at ? -1 : 1;
  },
});

const emptyInitialState = chatMessageAdapter.getInitialState();
const filledState = chatMessageAdapter.upsertMany(emptyInitialState, []);

const chatSlice = createSlice({
  name: 'chatMessages',

  initialState: filledState,

  // initialState: {},
  reducers: {
    messageAdded: (filledState, action) => {
      return chatMessageAdapter.addOne(filledState, action);
    },
    // messageAdded: ( action) => {
    //   return chatMessageAdapter.addOne(, action);
    // },
    initializeMessageQueue: (state, action) => {
      console.log({ action });
      chatMessageAdapter.setAll(state, action.payload);

      // chatMessageAdapter.addMany(
      //   chatMessageAdapter.getInitialState(),
      //   action.payload
      // );
    },
    messageReceived(state, action) {
      // *tmc* is this getting used?
      console.log({ action });
      chatMessageAdapter.setAll(state, action.payload.chatMessages);
    },
    extraReducers: (builder) => {
      // *tmc* - does this even happen?
      // @ts-ignore - 'addCase'  is not a member of Writable... what the heck is it?
      builder.addCase(
        waitOpenAiResponse.fulfilled,
        (state: any, action: any) => {
          state.entities.push(action.payload);
        }
      );
    },
  },
});

const messageActions = chatSlice.actions;
export { messageActions };
const middleware = loggerMiddleware;

export { chatSlice, waitOpenAiResponse, chatMessageAdapter, middleware };

// ----------------------------------
// store.ts
// import { createStore, applyMiddleware } from "redux";
// import thunk from "redux-thunk";
// import rootReducer from "./reducers"; // replace with your actual reducer

// const loggerMiddleware = (store: any) => (next: any) => (action: any) => {
//   // This is the middleware function that gets called for each dispatched action
//   console.log("Action:", action);

//   // Call the specific function for each state update
//   yourSpecificFunction(action, store.getState());

//   // Pass the action to the next middleware in the chain
//   return next(action);
// };

// const store = createStore(
//   rootReducer,
//   applyMiddleware(thunk, loggerMiddleware)
// );

// export default store;

// ----------------------------------
