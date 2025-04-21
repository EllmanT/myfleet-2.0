import { createReducer } from "@reduxjs/toolkit";

const initialState = {
  isLoading: true,
};

export const vehicleReducer = createReducer(initialState, {
  //load vehicle request
  loadVehicleCreateRequest: (state) => {
    state.isLoading = true;
  },
  //load vehicle added success
  loadVehicleCreateSuccess: (state, action) => {
    state.isLoading = false;
    state.success = true;
    state.vehicle = action.payload;
  },
  //load vehicle added failed
  loadVehicleCreateFailed: (state, action) => {
    state.isLoading = false;
    state.succes = false;
    state.error = action.payload;
  },

  //get all vehicles request

  getAllVehiclesCompanyRequest: (state) => {
    state.isCoVehLoading = true;
  },

  //get all vehicles company success
  getAllVehiclesCompanySuccess: (state, action) => {
    state.isCoVehLoading = false;
    state.coVehicles = action.payload;
  },
  // get all vehicles company failed
  getAllVehiclesCompanyFailed: (state, action) => {
    state.isCoVehLoading = false;
    state.error = action.payload;
  },

  //get all vehicles request

  getAllVehiclesPageRequest: (state) => {
    state.isPageVehLoading = true;
  },

  //get all vehicles company success
  getAllVehiclesPageSuccess: (state, action) => {
    state.isPageVehLoading = false;
    state.vehiclesPage = action.payload;
  },
  // get all vehicles company failed
  getAllVehiclesPageFailed: (state, action) => {
    state.isPageVehLoading = false;
    state.error = action.payload;
  },

  //update the vehicle request
  updateVehicleRequest: (state) => {
    state.isUpdateVehRequest = true;
  },
  //update vehicle request success
  updateVehicleSuccess: (state, action) => {
    state.isUpdateVehRequest = false;
    state.vehicle = action.payload;
  },
  //update vehicle request failed
  updateVehicleFailed: (state, action) => {
    state.isUpdateVehRequest = false;
    state.error = action.payload;
  },

   // delete Vehicle of a shop
   deleteVehicleRequest: (state) => {
    state.isLoading = true;
  },
  deleteVehicleSuccess: (state, action) => {
    state.isLoading = false;
    state.message = action.payload;
  },
  deleteVehicleFailed: (state, action) => {
    state.isLoading = false;
    state.error = action.payload;
  },

  //clear errors
  clearErrors: (state) => {
    state.error = null;
  },
  //clear success messages
  clearMessages: (state) => {
    state.success = null;
  },
});
