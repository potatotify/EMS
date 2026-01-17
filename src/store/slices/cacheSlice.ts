import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface CacheState {
  invalidatedKeys: string[];
  lastInvalidation: number | null;
}

const initialState: CacheState = {
  invalidatedKeys: [],
  lastInvalidation: null,
};

const cacheSlice = createSlice({
  name: "cache",
  initialState,
  reducers: {
    invalidateCache: (state, action: PayloadAction<string | string[]>) => {
      const keys = Array.isArray(action.payload) ? action.payload : [action.payload];
      state.invalidatedKeys.push(...keys);
      state.lastInvalidation = Date.now();
    },
    clearInvalidatedKeys: (state) => {
      state.invalidatedKeys = [];
    },
  },
});

export const { invalidateCache, clearInvalidatedKeys } = cacheSlice.actions;
export default cacheSlice.reducer;
