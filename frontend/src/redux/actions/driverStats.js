import axios from "axios";
import { server } from "server";

// get All DriverStats for a deliverer
export const getDriverStats = (driverId, year) => async (dispatch) => {
  try {
    dispatch({
      type: "getDriverStatsRequest",
    });

    const { data } = await axios.get(
      `${server}/driverStats/get-driverStats/${driverId}`,
      { withCredentials: true, params: { year } }
    );
    dispatch({
      type: "getDriverStatsSuccess",
      payload: data.driverStats,
    });
  } catch (error) {
    dispatch({
      type: "getDriverStatsFailed",
      payload: error.response.data.message,
    });
  }
};