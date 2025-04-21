import { createReducer } from "@reduxjs/toolkit";

const initialState = {
  isLoading: true,
};

export const driverReducer = createReducer(initialState, {
  //load driver request
  loadCreateDriverRequest: (state) => {
    state.isLoading = true;
  },
  //load driver added success
  loadCreateDriverSuccess: (state, action) => {
    state.isLoading = false;
    state.success = true;
    state.driver = action.payload;
  },
  //load driver added failed
  loadCreateDriverFailed: (state, action) => {
    state.isLoading = false;
    state.success = false;
    state.error = action.payload;
  },

  //load all drivers of a company

  getAllDriversCompanyRequest: (state) => {
    state.isCoDrLoading = true;
  },
  //load all drivers of a company success
  getAllDriversCompanySuccess: (state, action) => {
    state.isCoDrLoading = false;
    state.coDrivers = action.payload;
  },

  //load all drivers of a company failed
  getAllDriversCompanyFailed: (state, action) => {
    state.isCoDrLoading = false;
    state.error = action.payload;
  },

  //load all drivers of a page

  getAllDriversPageRequest: (state) => {
    state.isPageDrLoading = true;
  },
  //load all drivers of a page success
  getAllDriversPageSuccess: (state, action) => {
    state.isPageDrLoading = false;
    state.driversPage = action.payload;
  },

  //load all drivers of a page failed
  getAllDriversPageFailed: (state, action) => {
    state.isPageDrLoading = false;
    state.error = action.payload;
  },

  //update the driver request
  updateDriverRequest: (state) => {
    state.isUpdateDrRequest = true;
  },
  //update driver request success
  updateDriverSuccess: (state, action) => {
    state.isUpdateDrRequest = false;
    state.driver = action.payload;
  },
  //update driver request failed
  updateDriverFailed: (state, action) => {
    state.isUpdateDrRequest = false;
    state.error = action.payload;
  },

   // delete Driver of a shop
   deleteDriverRequest: (state) => {
    state.isLoading = true;
  },
  deleteDriverSuccess: (state, action) => {
    state.isLoading = false;
    state.message = action.payload;
  },
  deleteDriverFailed: (state, action) => {
    state.isLoading = false;
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
