import { configureStore } from "@reduxjs/toolkit";
import tasksReducer from "./slices/tasksSlice";
import employeesReducer from "./slices/employeesSlice";
import projectsReducer from "./slices/projectsSlice";
import uiReducer from "./slices/uiSlice";
import cacheReducer from "./slices/cacheSlice";

export const makeStore = () => {
  return configureStore({
    reducer: {
      tasks: tasksReducer,
      employees: employeesReducer,
      projects: projectsReducer,
      ui: uiReducer,
      cache: cacheReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // Ignore these action types
          ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
        },
      }),
  });
};

// Infer the type of makeStore
export type AppStore = ReturnType<typeof makeStore>;
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
