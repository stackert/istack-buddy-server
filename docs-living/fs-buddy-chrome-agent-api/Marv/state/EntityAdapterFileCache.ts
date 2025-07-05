import {
  createAsyncThunk,
  createEntityAdapter,
  createSlice,
} from '@reduxjs/toolkit';
import { ChatEngine } from '../ChatEngine';
import type { TFileCacheItem } from './types';
const initialFileCacheState = [
  {
    base64: null,
    type: 'image_file',
    fileId: 'file-JHDCk8EXfF3KqZ2bRN8GDaps',
    messageId: '-2',
  },
  {
    base64: null,
    type: 'image_file',
    fileId: 'file-z4osWHyNxT8VB8mcuf1VvuY1',
  },
] as TFileCacheItem[];

interface ICreateErrorMessageProps {
  type: string;
  text: string;
}

const waitFetchMarvFile = createAsyncThunk(
  'openai/waitFetchMarvFile',
  async (
    params: {
      fileId: string;
      targetMessageId: string;
      getRobotInstance: () => ChatEngine;
    },
    thunkApi
  ) => {
    // const marv = await ChatEngine.getInstance();
    const marv = params.getRobotInstance();
    const marvImgBase64 = await marv.fetchMarvFile(params.fileId);
    thunkApi.dispatch(
      fileCacheActions.updateImageBase64({
        fieldId: params.fileId,
        base64: marvImgBase64,
      })
    );
    return { fileId: params.fileId, base64: marvImgBase64 };
  }
);

const fileCacheAdapter = createEntityAdapter<TFileCacheItem, number | string>({
  selectId: (fileItem: TFileCacheItem) => fileItem.fileId as string,
  sortComparer: (a, b) => {
    return a.fileId < b.fileId ? -1 : 1;
  },
});

const emptyFileCacheInitialState = fileCacheAdapter.getInitialState();
const fileCacheFilledState = fileCacheAdapter.upsertMany(
  emptyFileCacheInitialState,
  initialFileCacheState
);
const fileCacheSlice = createSlice({
  name: 'fileCache',

  initialState: fileCacheFilledState,
  reducers: {
    updateImageBase64: (state, action) => {
      const result = fileCacheAdapter.updateOne(state, action);
      return result; // fileCacheAdapter.updateOne(state, action);
    },
    insertOne: fileCacheAdapter.addOne,
    extraReducers: (builder) => {
      // @ts-ignore - 'addCase'  is not a member of Writable... what the heck is it?
      builder.addCase(
        waitFetchMarvFile.fulfilled,
        (state: any, action: any) => {
          // Add user to the state array
          state.entities.push(action.payload);
        }
      );
    },
  },
});

const fileCacheActions = fileCacheSlice.actions;
export {
  fileCacheActions,
  fileCacheAdapter,
  fileCacheSlice,
  waitFetchMarvFile,
};
