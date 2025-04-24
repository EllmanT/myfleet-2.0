import axios from "axios";
import { server } from "server";

// get All ContractorStats for a deliverer
export const getContractorStats = (contractorId, year) => async (dispatch) => {
  try {
    dispatch({
      type: "getContractorStatsRequest",
    });

    const { data } = await axios.get(
      `${server}/contractorStats/get-contractorStats/${contractorId}`,
      { withCredentials: true,
        params:{
          year
        }
       }
    );
    dispatch({
      type: "getContractorStatsSuccess",
      payload: data.contractorStats,
    });
  } catch (error) {
    dispatch({
      type: "getContractorStatsFailed",
      payload: error.response.data.message,
    });
  }
};
