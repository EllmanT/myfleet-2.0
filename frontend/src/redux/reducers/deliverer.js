import { createReducer } from "@reduxjs/toolkit";

const initialState = {
  isLoading: true,
};

export const delivererReducer = createReducer(initialState, {
  loadCreateDeliverer: (state) => {
    state.isLoading = true;
  },

  createDelivererSuccess: (state, action) => {
    state.deliverer = action.payload;
    state.success = true;
    state.isLoading = false;
  },

  createDelivererFailed: (state, action) => {
    state.error = action.payload;
    state.success = false;
    state.isLoading = false;
  },

  getDelivererInfo: (state) => {
    state.delInfoLoading = true;
  },
  getDelivererInfoSuccess: (state, action) => {
    state.delivererInfo = action.payload;
    state.delInfoLoading = false;
  },
  getDelivererInfoFailed: (state, action) => {
    state.error = action.payload;
    state.delInfoLoading = false;
  },

  getAllDeliverersPageRequest: (state) => {
    state.isPageDeliverersLoading = true;
  },
  getAllDeliverersPageSuccess: (state, action) => {
    state.deliverersPage = action.payload;
    state.isPageDeliverersLoading = false;
  },
  setTotalCount: (state, action) => {
    state.totalCount = action.payload;
  },
  getAllDeliverersPageFailed: (state, action) => {
    state.error = action.payload;
    state.isPageDeliverersLoading = false;
  },

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

  clearErrors: (state) => {
    state.error = null;
  },

  clearMessages: (state) => {
    state.success = null;
  },
});
