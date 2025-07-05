import { createListenerMiddleware } from "@reduxjs/toolkit";
import { chatSlice } from "./EntityAdapter";

const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
  // is this necessary if we're adding the listenerMiddleware to the dynamically?
  actionCreator: chatSlice.actions.messageAdded,
  effect: async (action, listenerApi) => {
    // Run whatever additional side-effect-y logic you want here
    console.log({ listenerMiddleware: { action } });
    console.log({ listenerMiddleware: { want: "to make async call here" } });
  },
});

export { listenerMiddleware };
