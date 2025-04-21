import { createReducer } from "@reduxjs/toolkit";

const initialState = {
  isLoading: true,
};

export const overallStatsReducer = createReducer(initialState, {

  //load all overallStats of a deliverer

  getAllOverallStatsDelivererRequest: (state) => {
    state.isCoOverallStatsLoading = true;
  },
  //load all overallStats of a Deliverer success
  getAllOverallStatsDelivererSuccess: (state, action) => {
    state.isCoOverallStatsLoading = false;
    state.coOverallStats = action.payload;
  },

  //load all overallStats of a Deliverer failed
  getAllOverallStatsDelivererFailed: (state, action) => {
    state.isCoOverallStatsLoading = false;
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
