import axios from "axios";
import { server } from "server";

export const createCustomer = (newForm) => async (dispatch) => {
  try {
    dispatch({
      type: "loadCustomerCreateRequest",
    });

    const config = { Headers: { "Content-Type": "multipart/formdata" } };

    const { data } = await axios.post(
      `${server}/customer/create-customer`,
      newForm,
      config
    );
    dispatch({
      type: "loadCustomerCreateSuccess",
      payload: data.customer,
    });
  } catch (error) {
    dispatch({
      type: "loadCustomerCreateFailed",
      payload: error.response.data.message,
    });
  }
};

// get All Customers for a deliverer
export const getAllCustomersDeliverer = () => async (dispatch) => {
  try {
    dispatch({
      type: "getAllCustomersDelivererRequest",
    });

    const { data } = await axios.get(
      `${server}/customer/get-all-customers-company`,
      { withCredentials: true }
    );
    dispatch({
      type: "getAllCustomersDelivererSuccess",
      payload: data.delivererWithCustomers,
    });
  } catch (error) {
    dispatch({
      type: "getAllCustomersDelivererFailed",
      payload: error.response.data.message,
    });
  }
};

// get All Customers for a deliverer
export const getAllCustomersPage =
  (page, pageSize, sort, search) => async (dispatch) => {
    try {
      dispatch({
        type: "getAllCustomersPageRequest",
      });

      const { data } = await axios.get(
        `${server}/customer/get-all-customers-page`,
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
        type: "getAllCustomersPageSuccess",
        payload: data.pageCustomers,
      });
      dispatch({
        type: "setTotalCount",
        payload: data.totalCount,
      });
    } catch (error) {
      dispatch({
        type: "getAllCustomersPageFailed",
        payload: error.response.data.message,
      });
    }
  };

export const updateCustomer =
  (id, name, phoneNumber, city, address) => async (dispatch) => {
    try {
      dispatch({
        type: "updateCustomerRequest",
      });

      const { data } = await axios.put(
        `${server}/customer/update-customer`,
        { id, name, phoneNumber, city, address },
        { withCredentials: true }
      );

      dispatch({
        type: "updateCustomerSuccess",
        payload: data.customer,
      });
    } catch (error) {
      dispatch({
        type: "updateCustomerFailed",
        payload: error.response.data.message,
      });
    }
  };

    // delete Customer of 
export const deleteCustomer = (customerId) => async (dispatch) => {
  try {
    dispatch({
      type: "deleteCustomerRequest",
    });

    const { data } = await axios.delete(
      `${server}/customer/delete-customer/${customerId}`,
      {
        withCredentials: true,
      }
    );

    dispatch({
      type: "deleteCustomerSuccess",
      payload: data.message,
    });
  } catch (error) {
    dispatch({
      type: "deleteCustomerFailed",
      payload: error.response.data.message,
    });
  }
};