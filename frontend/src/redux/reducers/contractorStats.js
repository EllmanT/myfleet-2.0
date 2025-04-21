import { createReducer } from "@reduxjs/toolkit";

const initialState = {
  isLoading: true,
};

export const contractorStatsReducer = createReducer(initialState, {


  //load all contractorStats of a specific contractor

  getContractorStatRequest: (state) => {
    state.isContractorStatsLoading = true;
  },
  //load all ContractorStats of a Deliverer success
  getContractorStatsSuccess: (state, action) => {
    state.isContractorStatsLoading = false;
    state.contractorStats = action.payload;
  },

  //load all contractorStats of a Deliverer failed
  getContractorStatsFailed: (state, action) => {
    state.isContractorStatsLoading = false;
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
