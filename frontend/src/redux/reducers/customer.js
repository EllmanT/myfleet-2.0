import { createReducer } from "@reduxjs/toolkit";
const initialState = {
  isLoading: true,
};

export const customerReducer = createReducer(initialState, {
  //request
  loadCustomerCreateRequest: (state) => {
    state.isLoading = true;
  },

  //load customer success
  loadCustomerCreateSuccess: (state, action) => {
    state.isLoading = false;
    state.customer = action.payload;
    state.success = true;
  },

  //load customer failed
  loadCustomerCreateFailed: (state, action) => {
    state.isLoading = false;
    state.error = action.payload;
    state.success = false;
  },

  //load the customers for the deliverer
  getAllCustomersDelivererRequest: (state) => {
    state.isDelCustLoading = true;
  },
  getAllCustomersDelivererSuccess: (state, action) => {
    state.isDelCustLoading = false;
    state.delCustomers = action.payload;
  },
  getAllCustomersDelivererFailed: (state, action) => {
    state.isDelCustLoading = false;
    state.error = action.payload;
  },

  //load the customers for the deliverer
  getAllCustomersPageRequest: (state) => {
    state.isPageCustLoading = true;
  },
  getAllCustomersPageSuccess: (state, action) => {
    state.customersPage = action.payload;
    state.isPageCustLoading = false;

  },
  setTotalCount: (state, action) => { // Add this new reducer case
    state.totalCount = action.payload;
  },
  getAllCustomersPageFailed: (state, action) => {
    state.isPageCustLoading = false;
    state.error = action.payload;
  },

  //updating the customer

  updateCustomerRequest: (state) => {
    state.isUpdateCustomer = true;
  },
  updateCustomerSuccess: (state, action) => {
    state.isUpdateCustomer = false;
    state.customer = action.payload;
  },
  updateCustomerFailed: (state, action) => {
    state.isUpdateCustomer = false;
    state.error = action.payload;
  },

    // delete Customer of a shop
    deleteCustomerRequest: (state) => {
      state.isLoading = true;
    },
    deleteCustomerSuccess: (state, action) => {
      state.isLoading = false;
      state.message = action.payload;
    },
    deleteCustomerFailed: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },
  //clear errors

  clearErrors: (state) => {
    state.error = null;
  },
  //clea success messagess

  clearMessages: (state) => {
    state.success = null;
  },
});
