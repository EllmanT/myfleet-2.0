import { createReducer } from "@reduxjs/toolkit";

const initialState = {
  isLoading: true,
};

export const vehicleStatsReducer = createReducer(initialState, {


  //load all vehicleStats of a specific vehicle

  getVehicleStatRequest: (state) => {
    state.isVehicleStatsLoading = true;
  },
  //load all vehicleStats of a Deliverer success
  getVehicleStatsSuccess: (state, action) => {
    state.isVehicleStatsLoading = false;
    state.vehicleStats = action.payload;
  },

  //load all vehicleStats of a Deliverer failed
  getVehicleStatsFailed: (state, action) => {
    state.isVehicleStatsLoading = false;
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
