import { createReducer } from "@reduxjs/toolkit";

const initialState = {
  isLoading: true,
};

export const delivererReducer = createReducer(initialState, {
  //load createdeliverer request

  loadCreateDeliverer: (state) => {
    state.isLoading = true;
  },

  //create deliverer success
  createDelivererSuccess: (state, action) => {
    state.deliverer = action.payload;
    state.success = true;
    state.isLoading = false;

  },

  //create deliverer failed
  createDelivererFailed: (state, action) => {
    state.error = action.payload;
    state.success = false;
    state.isLoading = false;

  },

  //get the deliverer info request
  getDelivererInfo: (state) => {
    state.delInfoLoading = true;
  },
  //get the deliverer info success
  getDelivererInfoSuccess: (state, action) => {
    state.delivererInfo = action.payload;
    state.delInfoLoading = false;

  },
  //get the deliverer info failed
  getDelivererInfoFailed: (state, action) => {
    state.error = action.payload;
    state.delInfoLoading = false;

  },

    //getAllDeliverersPageRequest

    getAllDeliverersPageRequest: (state) => {
      state.isPageDeliverersLoading = true;
    },
    getAllDeliverersPageSuccess: (state, action) => {
      state.deliverersPage = action.payload;
      state.isPageDeliverersLoading = false;

    },
    setTotalCount: (state, action) => { // Add this new reducer case
      state.totalCount = action.payload;
    },
    getAllDeliverersPageFailed: (state, action) => {
      state.error = action.payload;
      state.isPageDeliverersLoading = false;

    },

  
      //update Deliverer

  updateDelivererRequest: (state) => {
    state.isUpdateDelivLoading = true;
  },
  updateDelivererSuccess: (state, action) => {
    state.deliverer = action.payload;
    state.isUpdateDelivLoading = false;

  },
  updateDelivererFailed: (state, action) => {
    state.error = action.payload;
    state.isUpdateDelivLoading = false;

  },

  //get the deliverer info request
  getDelivererInfo: (state) => {
    state.delInfoLoading = true;
  },
  //get the deliverer info success
  getDelivererInfoSuccess: (state, action) => {
    state.delInfoLoading = false;
    state.delivererInfo = action.payload;
  },
  //get the deliverer info failed
  getDelivererInfoFailed: (state, action) => {
    state.delInfoLoading = false;
    state.error = action.payload;
  },

    //getAllDeliverersPageRequest

    getAllDeliverersPageRequest: (state) => {
      state.isPageDeliverersLoading = true;
    },
    getAllDeliverersPageSuccess: (state, action) => {
      state.isPageDeliverersLoading = false;
      state.deliverersPage = action.payload;
    },
    setTotalCount: (state, action) => { // Add this new reducer case
      state.totalCount = action.payload;
    },
    getAllDeliverersPageFailed: (state, action) => {
      state.isPageDeliverersLoading = false;
      state.error = action.payload;
    },

  
      //update Deliverer

  updateDelivererRequest: (state) => {
    state.isUpdateDelivLoading = true;
  },
  updateDelivererSuccess: (state, action) => {
    state.isUpdateDelivLoading = false;
    state.deliverer = action.payload;
  },
  updateDelivererFailed: (state, action) => {
    state.isUpdateDelivLoading = false;
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
