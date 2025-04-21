import axios from "axios";
import { server } from "server";

export const createDriver = (newForm) => async (dispatch) => {
  try {
    dispatch({
      type: "loadCreateDriverRequest",
    });

    const config = { Headers: { "Content-Type": "multipart/form-data" } };
    const { data } = await axios.post(
      `${server}/driver/create-driver`,
      newForm,
      config
    );

    dispatch({
      type: "loadCreateDriverSuccess",
      payload: data.driver,
    });
  } catch (error) {
    dispatch({
      type: "loadCreateDriverFailed",
      payload: error.response.data.message,
    });
  }
};
//load the drivers for the company
export const getAllDriversCompany = () => async (dispatch) => {
  try {
    dispatch({
      type: "getAllDriversCompanyRequest",
    });

    const { data } = await axios.get(
      `${server}/driver/get-all-drivers-company`,
      { withCredentials: true }
    );
    dispatch({
      type: "getAllDriversCompanySuccess",
      payload: data.delivererWithDrivers,
    });
  } catch (error) {
    dispatch({
      type: "getAllDriversCompanyFailed",
      payload: error.response.data.message,
    });
  }
};

export const getAllDriversPage =
  (page, pageSize, sort, search) => async (dispatch) => {
    try {
      dispatch({
        type: "getAllDriversPageRequest",
      });

      const { data } = await axios.get(
        `${server}/driver/get-all-drivers-page`,
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
        type: "getAllDriversPageSuccess",
        payload: data.pageDrivers,
      });
    } catch (error) {
      dispatch({
        type: "getAllDriversPageFailed",
        payload: error.response.data.message,
      });
    }
  };

export const updateDriver =
  (driverId, name, phoneNumber, city, address, idNumber, id, license) =>
  async (dispatch) => {
    try {
      dispatch({
        type: "updateDriverRequest",
      });

      const { data } = await axios.put(
        `${server}/driver/update-driver`,
        {
          driverId,
          name,
          phoneNumber,
          city,
          address,
          idNumber,
          id,
          license,
        },
        { withCredentials: true }
      );

      dispatch({
        type: "updateDriverSuccess",
        payload: data.driver,
      });
    } catch (error) {
      dispatch({
        type: "updateDriverFailed",
        payload: error.response.data.message,
      });
    }
  };

  // delete Driver of a shop
export const deleteDriver = (driverId) => async (dispatch) => {
  try {
    dispatch({
      type: "deleteDriverRequest",
    });

    const { data } = await axios.delete(
      `${server}/driver/delete-driver/${driverId}`,
      {
        withCredentials: true,
      }
    );

    dispatch({
      type: "deleteDriverSuccess",
      payload: data.message,
    });
  } catch (error) {
    dispatch({
      type: "deleteDriverFailed",
      payload: error.response.data.message,
    });
  }
};