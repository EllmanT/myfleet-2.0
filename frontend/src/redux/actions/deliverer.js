import axios from "axios";
import { server } from "../../server";

export const createDeliverer = (newForm) => async (dispatch) => {
  try {
    dispatch({
      type: "delivererCreateRequest",
    });

    const config = { Headers: { "Content-type": "multipart/form-data" } };

    const { data } = await axios.post(
      `${server}/deliverer/create-deliverer`,
      newForm,
      config
    );

    dispatch({
      type: "createDelivererSuccess",
      payload: data.deliverer,
    });
  } catch (error) {
    dispatch({
      type: "createDelivererFailed",
      payload: error.response.data.message,
    });
  }
};

export const getDelivererInfo = () => async (dispatch) => {
  try {
    dispatch({
      type: "getDelivererInfoRequest",
    });

    const { data } = await axios.get(`${server}/deliverer/get-deliverer-info`, {
      withCredentials: true,
    });
    dispatch({
      type: "getDelivererInfoSuccess",
      payload: data.delivererInfo,
    });
  } catch (error) {
    dispatch({
      type: "getDelivererInfoFailed",
      payload: error.response.data.message,
    });
  }
};

export const getAllDeliverersPage =
  (page, pageSize, sort, search) => async (dispatch) => {
    try {
      dispatch({
        type: "getAllDeliverersPageRequest",
      });
      const { data } = await axios.get(
        `${server}/deliverer/get-all-deliverers-page`,
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
        type: "getAllDeliverersPageSuccess",
        payload: data.pageDeliverers,
      });
      dispatch({
        type: "setTotalCount",
        payload: data.totalCount,
      });
    } catch (error) {
      dispatch({
        type: "getAllDeliverersPageFailed",
        payload: error.response.data.message,
      });
    }
  };

export const updateDeliverer =
  (
    id,
    companyName,
    contact,
    city,
    address,
    prefix,
    goodsType,
    vehiclesType,
    deliveryType
  ) =>
  async (dispatch) => {
    try {
      dispatch({
        type: "updateDelivererRequest",
      });

      const { data } = await axios.put(
        `${server}/deliverer/update-deliverer`,
        {
          id,
          companyName,
          contact,
          city,
          address,
          prefix,
          goodsType,
          vehiclesType,
          deliveryType,
        },
        {
          withCredentials: true,
        }
      );

      dispatch({
        type: "updateDelivererSuccess",
        payload: data.vehicle,
      });
    } catch (error) {
      dispatch({
        type: "updateDelivererFailed",
        payload: error.response.data.message,
      });
    }
  };
