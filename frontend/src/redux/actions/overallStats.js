import axios from "axios";
import { server } from "server";

export const rebuildStats = () => async (dispatch) => {
  try {
    dispatch({ type: "rebuildStatsRequest" });
    const { data } = await axios.post(
      `${server}/overallStats/rebuild-stats`,
      {},
      { withCredentials: true }
    );
    dispatch({ type: "rebuildStatsSuccess", payload: data.message });
  } catch (error) {
    dispatch({
      type: "rebuildStatsFailed",
      payload: error.response?.data?.message || "Failed to rebuild stats",
    });
  }
};

// get All OverallStats for a deliverer
export const getAllOverallStatsDeliverer = (year) => async (dispatch) => {
    try {
      dispatch({
        type: "getAllOverallStatsDelivererRequest",
      });
  
      const { data } = await axios.get(
        `${server}/overallStats/get-all-overallStats-company`,
        { withCredentials: true ,
          params: {
        year
        },
        },
        
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