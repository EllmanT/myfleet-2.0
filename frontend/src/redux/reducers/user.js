import { createReducer } from "@reduxjs/toolkit";

const initialState = {
  loading: true,
};

export const userReducer = createReducer(initialState, {
  //load user Request
  loadUserRequest: (state) => {
    state.loading = true;
  },
  //load userSuccess
  loadUserSuccess: (state, action) => {
    state.user = action.payload;
    state.isAuthenticated = true;
    state.loading = false;
  },
  // load the companyName
  loadCompanyName: (state, action) => {
    state.delivererName = action.payload;
    state.loading = false;

  },
  // load the companyName
  loadCompanyName: (state, action) => {
    state.loading = false;
    state.delivererName = action.payload;
  },
  //load user failed

  loadUserFailed: (state, action) => {
    state.error = action.payload;
    state.isAuthenticated = false;
    state.loading = false;

  },

  //getAllAdminsPageRequest

  getAllAdminsPageRequest: (state) => {
    state.isPageAdminsLoading = true;
  },
  getAllAdminsPageSuccess: (state, action) => {
    state.adminsPage = action.payload;
    state.isPageAdminsLoading = false;

  },
  setTotalCount: (state, action) => {
    // Add this new reducer case
    state.totalCount = action.payload;
  },

  getAllAdminsPageFailed: (state, action) => {
    state.error = action.payload;
    state.isPageAdminsLoading = false;

  },

  //updating the admin

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

  // delete Admin of a shop
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

  //getAllAdminsPageRequest

  getAllAdminsPageRequest: (state) => {
    state.isPageAdminsLoading = true;
  },
  getAllAdminsPageSuccess: (state, action) => {
    state.isPageAdminsLoading = false;
    state.adminsPage = action.payload;
  },
  setTotalCount: (state, action) => {
    // Add this new reducer case
    state.totalCount = action.payload;
  },

  getAllAdminsPageFailed: (state, action) => {
    state.isPageAdminsLoading = false;
    state.error = action.payload;
  },

  //updating the admin

  updateAdminRequest: (state) => {
    state.isUpdateAdmin = true;
  },
  updateAdminSuccess: (state, action) => {
    state.isUpdateAdmin = false;
    state.admin = action.payload;
  },
  updateAdminFailed: (state, action) => {
    state.isUpdateAdmin = false;
    state.error = action.payload;
  },

  // delete Admin of a shop
  deleteAdminRequest: (state) => {
    state.isLoading = true;
  },
  deleteAdminSuccess: (state, action) => {
    state.isLoading = false;
    state.message = action.payload;
  },
  deleteAdminFailed: (state, action) => {
    state.isLoading = false;
    state.error = action.payload;
  },

  //clear Errors
  clearErrors: (state) => {
    state.error = null;
  },
});
