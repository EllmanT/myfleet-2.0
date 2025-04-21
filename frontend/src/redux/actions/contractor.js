import axios from "axios";
import { server } from "server";

export const createContractor = (newForm) => async (dispatch) => {
  try {
    dispatch({
      type: "loadCreateContractorRequest",
    });

    const config = { Headers: { "Content-Type": "multipart/form-data" } };
    const { data } = await axios.post(
      `${server}/contractor/create-contractor`,
      newForm,
      config
    );

    dispatch({
      type: "loadCreateContractorSuccess",
      payload: data.contractor,
    });
  } catch (error) {
    dispatch({
      type: "loadCreateContractorFailed",
      payload: error.response.data.message,
    });
  }
};

export const getAllContractorsDeliverer = () => async (dispatch) => {
  try {
    dispatch({
      type: "getAllContrDelReq",
    });
    const { data } = await axios.get(
      `${server}/contractor/get-all-contractors-deliverer`,
      { withCredentials: true }
    );
    dispatch({
      type: "getAllContrDelSuccess",
      payload: data.delivererWithContractors,
    });
  } catch (error) {
    dispatch({
      type: "getAllContrDelFailed",
      payload: error.response.data.message,
    });
  }
};

export const getAllContractorsPage =
  (page, pageSize, sort, search) => async (dispatch) => {
    try {
      dispatch({
        type: "getAllContrPageReq",
      });
      const { data } = await axios.get(
        `${server}/contractor/get-all-contractors-page`,
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
        type: "getAllContrPageSuccess",
        payload: data.pageContractors,
      });
    } catch (error) {
      dispatch({
        type: "getAllContrPageFailed",
        payload: error.response.data.message,
      });
    }
  };

export const updateContractor =
  (
    compId,
    companyName,
    contact,
    city,
    address,
    prefix,
    goodsTypes,
    vehiclesTypes,
    deliveryTypes,
    rateId,
    stringRates
  ) =>
  async (dispatch) => {
    try {
      dispatch({
        type: "updateContractorRequest",
      });

      const { data } = await axios.put(
        `${server}/contractor/update-contractor`,
        {
          compId,
          companyName,
          contact,
          city,
          address,
          prefix,
          goodsTypes,
          vehiclesTypes,
          deliveryTypes,
          rateId,
          stringRates,
        },
        {
          withCredentials: true,
        }
      );

      dispatch({
        type: "updateContractorSuccess",
        payload: data.vehicle,
      });
    } catch (error) {
      dispatch({
        type: "updateContractorFailed",
        payload: error.response.data.message,
      });
    }
  };

// delete Contractor of
export const deleteContractor = (contractorId) => async (dispatch) => {
  try {
    dispatch({
      type: "deleteContractorRequest",
    });

    const { data } = await axios.delete(
      `${server}/contractor/delete-contractor/${contractorId}`,
      {
        withCredentials: true,
      }
    );

    dispatch({
      type: "deleteContractorSuccess",
      payload: data.message,
    });
  } catch (error) {
    dispatch({
      type: "deleteContractorFailed",
      payload: error.response.data.message,
    });
  }
};
