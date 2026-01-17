import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

interface Project {
  _id: string;
  projectName: string;
  status: string;
  // Add other project fields as needed
}

interface ProjectsState {
  list: Project[];
  loading: boolean;
  error: string | null;
  selectedProject: Project | null;
}

const initialState: ProjectsState = {
  list: [],
  loading: false,
  error: null,
  selectedProject: null,
};

// Async thunk for fetching projects
export const fetchProjects = createAsyncThunk(
  "projects/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch("/api/projects");
      if (!response.ok) {
        throw new Error("Failed to fetch projects");
      }

      const data = await response.json();
      const projects = Array.isArray(data) ? data : data.projects || [];

      return projects;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch projects");
    }
  }
);

const projectsSlice = createSlice({
  name: "projects",
  initialState,
  reducers: {
    setSelectedProject: (state, action: PayloadAction<Project | null>) => {
      state.selectedProject = action.payload;
    },
    clearProjects: (state) => {
      state.list = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedProject, clearProjects } = projectsSlice.actions;
export default projectsSlice.reducer;
