import axios from "axios";
import { server } from "server";

// get All OverallStats for a deliverer
export const getAllOverallStatsDeliverer = () => async (dispatch) => {
    try {
      dispatch({
        type: "getAllOverallStatsDelivererRequest",
      });
  
      const { data } = await axios.get(
        `${server}/overallStats/get-all-overallStats-company`,
        { withCredentials: true }
      );
      dispatch({
        type: "getAllOverallStatsDelivererSuccess",
        payload: data.delivererWithOverallStats,
      });
    } catch (error) {
      dispatch({
        type: "getAllOverallStatsDelivererFailed",
        payload: error.response.data.message,
      });
    }
  };