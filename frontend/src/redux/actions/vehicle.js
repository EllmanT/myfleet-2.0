import axios from "axios";
import { server } from "server";

export const createVehicle = (newForm) => async (dispatch) => {
  try {
    dispatch({
      type: "loadVehicleCreateRequest",
    });
    const config = { Headers: { "Content-Type": "multipart/form-data" } };
    const { data } = await axios.post(
      `${server}/vehicle/create-vehicle`,
      newForm,
      config
    );
    dispatch({
      type: "loadVehicleCreateSuccess",
      payload: data.vehicle,
    });
  } catch (error) {
    dispatch({
      type: "loadVehicleCreateFailed",
      payload: error.response.data.message,
    });
  }
};

export const getAllVehiclesCompany = () => async (dispatch) => {
  try {
    dispatch({
      type: "getAllVehiclesCompanyRequest",
    });

    const { data } = await axios.get(
      `${server}/vehicle/get-all-vehicles-company`,
      { withCredentials: true }
    );
    dispatch({
      type: "getAllVehiclesCompanySuccess",
      payload: data.delivererWithVehicles,
    });
  } catch (error) {
    dispatch({
      type: "getAllVehiclesCompanyFailed",
      payload: error.response.data.message,
    });
  }
};

export const getAllVehiclesPage =
  (page, pageSize, sort, search) => async (dispatch) => {
    try {
      dispatch({
        type: "getAllVehiclesPageRequest",
      });

      const { data } = await axios.get(
        `${server}/vehicle/get-all-vehicles-page`,
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
        type: "getAllVehiclesPageSuccess",
        payload: data.pageVehicles,
      });
    } catch (error) {
      dispatch({
        type: "getAllVehiclesPageFailed",
        payload: error.response.data.message,
      });
    }
  };

export const updateVehicle =
  (id, make, size, regNumber) => async (dispatch) => {
    try {
      dispatch({
        type: "updateVehicleRequest",
      });

      const { data } = await axios.put(
        `${server}/vehicle/update-vehicle`,
        {
          id,
          make,
          size,
          regNumber,
        },
        { withCredentials: true }
      );

      dispatch({
        type: "updateVehicleSuccess",
        payload: data.vehicle,
      });
    } catch (error) {
      dispatch({
        type: "updateVehicleFailed",
        payload: error.response.data.message,
      });
    }
  };

  // delete Vehicle of 
export const deleteVehicle = (vehicleId) => async (dispatch) => {
  try {
    dispatch({
      type: "deleteVehicleRequest",
    });

    const { data } = await axios.delete(
      `${server}/vehicle/delete-vehicle/${vehicleId}`,
      {
        withCredentials: true,
      }
    );

    dispatch({
      type: "deleteVehicleSuccess",
      payload: data.message,
    });
  } catch (error) {
    dispatch({
      type: "deleteVehicleFailed",
      payload: error.response.data.message,
    });
  }
};
