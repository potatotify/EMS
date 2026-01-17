import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

interface TaskAnalysisData {
  _id: string;
  projectName: string;
  personAssignedTo: string;
  taskName: string;
  status: string;
  employeeGot: string;
  // Add other task fields as needed
}

interface TasksState {
  analysis: {
    data: TaskAnalysisData[];
    loading: boolean;
    error: string | null;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    filters: {
      projectFilter: string;
      employeeFilter: string;
      deadlineFilter: string;
    };
  };
  allTasks: {
    data: any[];
    loading: boolean;
    error: string | null;
  };
}

const initialState: TasksState = {
  analysis: {
    data: [],
    loading: false,
    error: null,
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    },
    filters: {
      projectFilter: "all",
      employeeFilter: "all",
      deadlineFilter: "all",
    },
  },
  allTasks: {
    data: [],
    loading: false,
    error: null,
  },
};

// Async thunk for fetching task analysis
export const fetchTaskAnalysis = createAsyncThunk(
  "tasks/fetchAnalysis",
  async (
    params: {
      page?: number;
      limit?: number;
      projectFilter?: string;
      employeeFilter?: string;
      deadlineFilter?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const {
        page = 1,
        limit = 10,
        projectFilter = "all",
        employeeFilter = "all",
        deadlineFilter = "all",
      } = params;

      // Fetch from API
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        projectFilter,
        employeeFilter,
        deadlineFilter,
      });

      const response = await fetch(`/api/admin/tasks/analysis?${searchParams}`);
      if (!response.ok) {
        throw new Error("Failed to fetch task analysis");
      }

      const data = await response.json();

      return data;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch task analysis");
    }
  }
);

const tasksSlice = createSlice({
  name: "tasks",
  initialState,
  reducers: {
    setFilters: (
      state,
      action: PayloadAction<{
        projectFilter?: string;
        employeeFilter?: string;
        deadlineFilter?: string;
      }>
    ) => {
      state.analysis.filters = {
        ...state.analysis.filters,
        ...action.payload,
      };
      // Reset to page 1 when filters change
      state.analysis.pagination.page = 1;
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.analysis.pagination.page = action.payload;
    },
    clearAnalysisCache: (state) => {
      state.analysis.data = [];
      state.analysis.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTaskAnalysis.pending, (state) => {
        state.analysis.loading = true;
        state.analysis.error = null;
      })
      .addCase(fetchTaskAnalysis.fulfilled, (state, action) => {
        state.analysis.loading = false;
        state.analysis.data = action.payload.tasks || [];
        state.analysis.pagination = {
          page: action.payload.page || 1,
          limit: action.payload.limit || 10,
          total: action.payload.total || 0,
          totalPages: action.payload.totalPages || 0,
        };
      })
      .addCase(fetchTaskAnalysis.rejected, (state, action) => {
        state.analysis.loading = false;
        state.analysis.error = action.payload as string;
      });
  },
});

export const { setFilters, setPage, clearAnalysisCache } = tasksSlice.actions;
export default tasksSlice.reducer;
