import { createReducer } from "@reduxjs/toolkit";

const initialState = {
  isLoading: true,
};

export const rateReducer = createReducer(initialState, {
  //get the deliverer info request
  getRatesRequest: (state) => {
    state.ratesLoading = true;
  },
  //get the deliverer info success
  getRatesSuccess: (state, action) => {
    state.ratesLoading = false;
    state.rates = action.payload;
  },
  //get the deliverer info failed
  getRatesFailed: (state, action) => {
    state.ratesLoadingLoading = false;
    state.error = action.payload;
  },

  //errors clearring

  clearErrors: (state) => {
    state.error = null;
  },
  //clea success messagess

  clearMessages: (state) => {
    state.success = null;
  },
});
