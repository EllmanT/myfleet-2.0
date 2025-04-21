import axios from "axios";
import { server } from "server";

export const createVehicleExpense = (newForm) => async (dispatch) => {
  try {
    dispatch({
      type: "loadCreateVehicleExpenseRequest",
    });
    const config = {
      Headers: { "Content-Type": "multipart/form-data" },
      withCredentials: true,
    };
    const { data } = await axios.post(
      `${server}/expenses/vehicle/create-vehicle-expense`,
      newForm,
      config
    );
    dispatch({
      type: "loadCreateVehicleExpenseSuccess",
      payload: data.vehicleExpense,
    });
  } catch (error) {
    dispatch({
      type: "loadCreateVehicleExpenseFailed",
      payload: error.response.data.message,
    });
  }
};

//update expense
export const updateVehicleExpense =
  (id, vehicleId, driverId, date, description, cost) => async (dispatch) => {
    try {
      dispatch({
        type: "updateExpenseRequest",
      });

      const { data } = await axios.put(
        `${server}/expense/update-expense`,
        { id, vehicleId, driverId, date, description, cost },
        { withCredentials: true }
      );

      dispatch({
        type: "updateExpenseSuccess",
        payload: data.expense,
      });
    } catch (error) {
      dispatch({
        type: "updateExpenseFailed",
        payload: error.response.data.message,
      });
    }
  };

// delete Expense of
export const deleteVehicleExpense =
  (expenseId, vehicleId) => async (dispatch) => {
    try {
      dispatch({
        type: "deleteVehicleExpenseRequest",
      });

      const { data } = await axios.delete(
        `${server}/expense/delete-vehicle-expense/${expenseId}`,
        {
          withCredentials: true,
          vehicleId,
        }
      );

      dispatch({
        type: "deleteExpenseSuccess",
        payload: data.message,
      });
    } catch (error) {
      dispatch({
        type: "deleteExpenseFailed",
        payload: error.response.data.message,
      });
    }
  };

// get all expenses for the vehicle
export const getAllExpensesVehicle =
  (vehicleId, page, pageSize, sort, search) => async (dispatch) => {
    try {
      dispatch({
        type: "getVehicleExpensesRequest",
      });

      const { data } = await axios.get(
        `${server}/expenses/vehicle/get-vehicle-expenses/${vehicleId}`,
        {
          withCredentials: true,
          params: {
            page,
            pageSize,
            sort,
            search,
          },
        }
      );

      dispatch({
        type: "getVehicleExpensesSuccess",
        payload: data.message,
      });
    } catch (error) {
      dispatch({
        type: "getVehicleExpensesFailed",
        payload: error.response.data.message,
      });
    }
  };

// get All Expenses for a deliverer
export const getAllExpensesDeliverer =
  (page, pageSize, sort, search) => async (dispatch) => {
    try {
      dispatch({
        type: "getAllExpensesPageRequest",
      });

      const { data } = await axios.get(`${server}/expense/get-all-expenses`, {
        withCredentials: true,
        params: {
          page,
          pageSize,
          sort,
          search,
        },
      });

      dispatch({
        type: "getAllExpensesSuccess",
        payload: data.expensesCo,
      });
    } catch (error) {
      dispatch({
        type: "getAllExpensesFailed",
        payload: error.response.data.message,
      });
    }
  };

export const creatEmployeeExpense = (newForm) => async (dispatch) => {
  try {
    dispatch({
      type: "loadCreateEmployeeExpenseRequest",
    });
    const config = {
      Headers: { "Content-Type": "multipart/form-data" },
      withCredentials: true,
    };
    const { data } = await axios.post(
      `${server}/expenses/employee/create-employee-expense`,
      newForm,
      config
    );
    dispatch({
      type: "loadCreateEmployeeExpenseSuccess",
      payload: data.employeeExpense,
    });
  } catch (error) {
    dispatch({
      type: "loadCreateEmployeeExpenseFailed",
      payload: error.response.data.message,
    });
  }
};

// get all expenses for the driver
export const getAllExpensesEmployee =
  (employeeId, page, pageSize, sort, search) => async (dispatch) => {
    try {
      dispatch({
        type: "getEmployeeExpensesRequest",
      });

      const { data } = await axios.get(
        `${server}/expenses/employee/get-employee-expenses/${employeeId}`,
        {
          withCredentials: true,
          params: {
            page,
            pageSize,
            sort,
            search,
          },
        }
      );

      dispatch({
        type: "getEmployeeExpensesSuccess",
        payload: data.message,
      });
    } catch (error) {
      dispatch({
        type: "getEmployeeExpensesFailed",
        payload: error.response.data.message,
      });
    }
  };

//update expense
export const updateEmployeeExpense =
  (id, employeeId, date, description, cost) => async (dispatch) => {
    try {
      dispatch({
        type: "updateExpenseRequest",
      });

      const { data } = await axios.put(
        `${server}/expense/update-expense`,
        { id, employeeId, date, description, cost },
        { withCredentials: true }
      );

      dispatch({
        type: "updateExpenseSuccess",
        payload: data.expense,
      });
    } catch (error) {
      dispatch({
        type: "updateExpenseFailed",
        payload: error.response.data.message,
      });
    }
  };

// delete Expense of
export const deleteEmployeeExpense =
  (expenseId, vehicleId) => async (dispatch) => {
    try {
      dispatch({
        type: "deleteVehicleExpenseRequest",
      });

      const { data } = await axios.delete(
        `${server}/expense/delete-vehicle-expense/${expenseId}`,
        {
          withCredentials: true,
          vehicleId,
        }
      );

      dispatch({
        type: "deleteExpenseSuccess",
        payload: data.message,
      });
    } catch (error) {
      dispatch({
        type: "deleteExpenseFailed",
        payload: error.response.data.message,
      });
    }
  };
