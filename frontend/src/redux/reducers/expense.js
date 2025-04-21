import { createReducer } from "@reduxjs/toolkit";
const initialState = {
  isLoading: true,
};

export const expensesReducer = createReducer(initialState, {
  //request
  loadCreateVehicleExpenseRequest: (state) => {
    state.isveLoading = true;
  },

  //load customer success
  loadCreateVehicleExpenseSuccess: (state, action) => {
    state.isveLoading = false;
    state.vehicleExpense = action.payload;
    state.success = true;
  },

  //load customer failed
  loadCreateVehicleExpenseFailed: (state, action) => {
    state.isveLoading = false;
    state.error = action.payload;
    state.success = false;
  },

  //load the expenses for the company (deliverer)

  getAllExpensesRequest: (state) => {
    state.isExpLoading = true;
  },
  getAllExpensesSuccess: (state, action) => {
    state.isExpLoading = false;
    state.allExpenses = action.payload;
  },
  getAllExpensesFailed: (state, action) => {
    state.isExpLoading = false;
    state.error = action.payload;
  },
  //load the expenses for the vehicle

  getAllExpensesVehicleRequest: (state) => {
    state.isExpVehLoading = true;
  },
  getAllExpensesVehicleSuccess: (state, action) => {
    state.isExpVehLoading = false;
    state.vehicleExpenses = action.payload;
  },
  getAllExpensesVehicleFailed: (state, action) => {
    state.isExpVehLoading = false;
    state.error = action.payload;
  },

  //load the expenses for the driver

  getAllExpensesDriverRequest: (state) => {
    state.isExpDrLoading = true;
  },
  getAllExpensesDriverSuccess: (state, action) => {
    state.isExpDrLoading = false;
    state.driverExpenses = action.payload;
  },
  getAllExpensesDriverFailed: (state, action) => {
    state.isExpVehLoading = false;
    state.error = action.payload;
  },

  //updating the  expense

  updateExpenseRequest: (state) => {
    state.isUpdateExpense = true;
  },
  updateExpenseSuccess: (state, action) => {
    state.isUpdateExpense = false;
    state.customer = action.payload;
  },
  updateCustomerFailed: (state, action) => {
    state.isUpdateExpense = false;
    state.error = action.payload;
  },

  // delete Expense
  deleteExpenseRequest: (state) => {
    state.isLoading = true;
  },
  deleteExpenseSuccess: (state, action) => {
    state.isLoading = false;
    state.message = action.payload;
  },
  deleteExpenseFailed: (state, action) => {
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
