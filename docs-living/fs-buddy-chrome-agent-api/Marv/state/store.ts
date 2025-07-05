import { configureStore } from "@reduxjs/toolkit";
import { chatSlice } from "./EntityAdapter";
import { fileCacheSlice } from "./EntityAdapterFileCache";
import { uiComponentReducer } from "./ui-components.state";
import { listenerMiddleware } from "./listenerMiddleware";
const store = configureStore({
  reducer: {
    fileCache: fileCacheSlice.reducer,
    chatMessages: chatSlice.reducer,
    //  - - maybe re create this  based on the new fileCacheSlice ?
    // chatMessages: (args) => args,
    uiComponents: uiComponentReducer, // { ...uiComponentReducer }, // this is not the reducer, not sure what it's named like this
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(listenerMiddleware.middleware),
});
type RootState = ReturnType<typeof store.getState>;
export type { RootState };
export { store };
