import axios from "axios";
import { server } from "server";

export const getRates = () => async (dispatch) => {
  try {
    dispatch({
      type: "getRatesRequest",
    });

    const { data } = await axios.get(`${server}/rate/get-rates`, {
      withCredentials: true,
    });
    dispatch({
      type: "getRatesSuccess",
      payload: data.delivererRates,
    });
  } catch (error) {
    dispatch({
      type: "getRatesFailed",
      payload: error.response.data.message,
    });
  }
};
