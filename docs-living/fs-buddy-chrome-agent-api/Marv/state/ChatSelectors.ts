import { chatMessageAdapter } from "./EntityAdapter";
import type { RootState } from "./store";
// Can create a set of memoized selectors based on the location of this entity state
const chatMessagesSelectors = chatMessageAdapter.getSelectors<RootState>(
  (state) => state.chatMessages
);

export { chatMessagesSelectors };
