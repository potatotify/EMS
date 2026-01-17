import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

interface Employee {
  _id: string;
  name: string;
  email: string;
  role: string;
  // Add other employee fields as needed
}

interface EmployeesState {
  list: Employee[];
  loading: boolean;
  error: string | null;
  selectedEmployee: Employee | null;
}

const initialState: EmployeesState = {
  list: [],
  loading: false,
  error: null,
  selectedEmployee: null,
};

// Async thunk for fetching employees
export const fetchEmployees = createAsyncThunk(
  "employees/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch("/api/admin/employees");
      if (!response.ok) {
        throw new Error("Failed to fetch employees");
      }

      const data = await response.json();
      const employees = data.employees || data || [];

      return employees;
    } catch (error: any) {
      return rejectWithValue(error.message || "Failed to fetch employees");
    }
  }
);

const employeesSlice = createSlice({
  name: "employees",
  initialState,
  reducers: {
    setSelectedEmployee: (state, action: PayloadAction<Employee | null>) => {
      state.selectedEmployee = action.payload;
    },
    clearEmployees: (state) => {
      state.list = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEmployees.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEmployees.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchEmployees.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedEmployee, clearEmployees } = employeesSlice.actions;
export default employeesSlice.reducer;
