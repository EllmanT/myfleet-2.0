import { createReducer } from "@reduxjs/toolkit";

const initialState = {
  isLoading: true,
};

export const driverStatsReducer = createReducer(initialState, {

    //load all DriverStats of a specific Driver

    getDriverStatRequest: (state) => {
      state.isDriverStatsLoading = true;
    },
    //load all DriverStats of a Deliverer success
    getDriverStatsSuccess: (state, action) => {
      state.isDriverStatsLoading = false;
      state.driverStats = action.payload;
    },
  
    //load all DriverStats of a Deliverer failed
    getDriverStatsFailed: (state, action) => {
      state.isDriverStatsLoading = false;
      state.error = action.payload;
    },
  
  //clear errors
  clearErrors: (state) => {
    state.error = null;
  },
  clearMessages: (state) => {
    state.success = null;
  },
});
