import type { RootState } from "./store";
import { fileCacheAdapter } from "./EntityAdapterFileCache";
const fileCacheSelectors = fileCacheAdapter.getSelectors<RootState>(
  (state) => state.fileCache
);
const { selectById: fileCacheSelectById } = fileCacheAdapter.getSelectors();

// 90% certain this never worked
// export const selectFileCacheEntity = (fileId: string) => {
//   return createSelector(store.getState().fileCache as any, (state) =>
//     fileCacheSelectById(state, fileId)
//   );
// };
export { fileCacheSelectors };
