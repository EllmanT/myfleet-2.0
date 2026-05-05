import { createReducer } from "@reduxjs/toolkit";

const initialState = {
  loading: true,
};

export const userReducer = createReducer(initialState, {
  loadUserRequest: (state) => {
    state.loading = true;
  },
  loadUserSuccess: (state, action) => {
    state.user = action.payload;
    state.isAuthenticated = true;
    state.loading = false;
  },
  loadCompanyName: (state, action) => {
    state.delivererName = action.payload;
    state.loading = false;
  },
  loadUserFailed: (state, action) => {
    state.error = action.payload;
    state.isAuthenticated = false;
    state.loading = false;
  },

  getAllAdminsPageRequest: (state) => {
    state.isPageAdminsLoading = true;
  },
  getAllAdminsPageSuccess: (state, action) => {
    state.adminsPage = action.payload;
    state.isPageAdminsLoading = false;
  },
  setTotalCount: (state, action) => {
    state.totalCount = action.payload;
  },

  getAllAdminsPageFailed: (state, action) => {
    state.error = action.payload;
    state.isPageAdminsLoading = false;
  },

  updateAdminRequest: (state) => {
    state.isUpdateAdmin = true;
  },
  updateAdminSuccess: (state, action) => {
    state.admin = action.payload;
    state.isUpdateAdmin = false;
  },
  updateAdminFailed: (state, action) => {
    state.error = action.payload;
    state.isUpdateAdmin = false;
  },

  deleteAdminRequest: (state) => {
    state.isLoading = true;
  },
  deleteAdminSuccess: (state, action) => {
    state.message = action.payload;
    state.isLoading = false;
  },
  deleteAdminFailed: (state, action) => {
    state.error = action.payload;
    state.isLoading = false;
  },

  clearErrors: (state) => {
    state.error = null;
  },
});
