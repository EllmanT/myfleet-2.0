import axios from "axios";
import { server } from "server";

// get All VehicleStats for a deliverer
export const getVehicleStats = (vehicleId) => async (dispatch) => {
  try {
    dispatch({
      type: "getVehicleStatsRequest",
    });

    const { data } = await axios.get(
      `${server}/vehicleStats/get-vehicleStats/${vehicleId}`,
      { withCredentials: true }
    );
    dispatch({
      type: "getVehicleStatsSuccess",
      payload: data.vehicleStats,
    });
  } catch (error) {
    dispatch({
      type: "getVehicleStatsFailed",
      payload: error.response.data.message,
    });
  }
};
