import axios from "axios";
import { server } from "server";
//create the job
export const createJob = (jobs) => async (dispatch) => {
  try {
    dispatch({
      type: "loadCreateJobRequest",
    });
    const config = {
      Headers: { "Content-Type": "multipart/form-data" },
      withCredentials: true,
    };
    const { data } = await axios.post(`${server}/job/create-job`, jobs, config);
    dispatch({
      type: "loadCreateJobSuccess",
      payload: data.jobs,
    });
  } catch (error) {
    dispatch({
      type: "loadCreateJobFailed",
      payload: error.response.data.message,
    });
  }
};
//update the job
export const updateJob =
  (
    jobId,
    jobNum,
    fromId,
    pageCustomerId,
    description,
    vehicleId,
    contractorId,
    driverId,
    mileageIn,
    mileageOut,
    deliveryType,
    cost,
    distance,
    orderDatee
  ) =>
  async (dispatch) => {
    try {
      dispatch({
        type: "updateCustomerRequest",
      });

      const { data } = await axios.put(
        `${server}/job/update-job`,
        {
          jobId,
          jobNum,
          fromId,
          pageCustomerId,
          description,
          vehicleId,
          contractorId,
          driverId,
          mileageIn,
          mileageOut,
          deliveryType,
          cost,
          distance,
          orderDatee,
        },
        { withCredentials: true }
      );

      dispatch({
        type: "updateJobSuccess",
        payload: data.job,
      });
    } catch (error) {
      dispatch({
        type: "updateJobFailed",
        payload: error.response.data.message,
      });
    }
  };

// delete job
export const deleteJob = (jobId) => async (dispatch) => {
  try {
    dispatch({
      type: "deleteJobRequest",
    });

    const { data } = await axios.delete(
      `${server}/job/delete-job/${jobId}`,
      // { drId, vehId, contrId },
      {
        withCredentials: true,
      }
    );

    dispatch({
      type: "deleteJobSuccess",
      payload: data.message,
    });
  } catch (error) {
    dispatch({
      type: "deleteJobFailed",
      payload: error.response.data.message,
    });
  }
};
export const getAllJobsPage =
  (page, pageSize, searcha, sort, sorta, contractor, jobSearch) =>
  async (dispatch) => {
    try {
      dispatch({
        type: "getAllJobsPageRequest",
      });

      const { data } = await axios.get(`${server}/job/get-all-jobs-page`, {
        withCredentials: true,
        params: { page, pageSize, searcha, sort, sorta, contractor, jobSearch },
      });
      dispatch({
        type: "getAllJobsPageSuccess",
        payload: data.pageJobs,
      });
      dispatch({
        type: "setTotalCount",
        payload: data.totalCount,
      });
    } catch (error) {
      dispatch({
        type: "getAllJobsPageFailed",
        payload: error.response.data.message,
      });
    }
  };

export const getLatestJobsDeliverer =
  (page, pageSize, searcha, sort, sorta, contractor, jobSearch) =>
  async (dispatch) => {
    try {
      dispatch({
        type: "getLatestJobsDelivererRequest",
      });

      const { data } = await axios.get(
        `${server}/job/get-latest-jobs-deliverer`,
        {
          withCredentials: true,
          params: {
            page,
            pageSize,
            searcha,
            sort,
            sorta,
            contractor,
            jobSearch,
          },
        }
      );
      dispatch({
        type: "getLatestJobsDelivererSuccess",
        payload: data.latestDelivererJobs,
      });
    } catch (error) {
      dispatch({
        type: "getLatestJobsDelivererFailed",
        payload: error.response.data.message,
      });
    }
  };

export const getLatestJobsVehicle = (vehicleId) => async (dispatch) => {
  try {
    dispatch({
      type: "getLatestJobsVehicleRequest",
    });

    const { data } = await axios.get(
      `${server}/job/get-latest-jobs-vehicle/${vehicleId}`,
      {
        withCredentials: true,
      }
    );
    dispatch({
      type: "getLatestJobsVehicleSuccess",
      payload: data.latestVehicleJobs,
    });
  } catch (error) {
    dispatch({
      type: "getLatestJobsVehicleFailed",
      payload: error.response.data.message,
    });
  }
};

export const getLatestJobsDriver = (driverId) => async (dispatch) => {
  try {
    dispatch({
      type: "getLatestJobsDriverRequest",
    });

    const { data } = await axios.get(
      `${server}/job/get-latest-jobs-driver/${driverId}`,
      {
        withCredentials: true,
      }
    );
    dispatch({
      type: "getLatestJobsDriverSuccess",
      payload: data.latestDriverJobs,
    });
  } catch (error) {
    dispatch({
      type: "getLatestJobsDriverFailed",
      payload: error.response.data.message,
    });
  }
};
export const getLatestJobsContractor = (contractorId) => async (dispatch) => {
  try {
    dispatch({
      type: "getLatestJobsContractorRequest",
    });

    const { data } = await axios.get(
      `${server}/job/get-latest-jobs-contractor/${contractorId}`,
      {
        withCredentials: true,
      }
    );
    dispatch({
      type: "getLatestJobsContractorSuccess",
      payload: data.latestContractorJobs,
    });
  } catch (error) {
    dispatch({
      type: "getLatestJobsContractorFailed",
      payload: error.response.data.message,
    });
  }
};

export const getAllJobsReportDeliverer = () => async (dispatch) => {
  try {
    dispatch({
      type: "getAllJobsReportDelivererRequest",
    });

    const { data } = await axios.get(
      `${server}/job/get-all-jobsReport-deliverer`,
      { withCredentials: true }
    );
    dispatch({
      type: "getAllJobsReportDelivererSuccess",
      payload: data.delivererWithJobsReport,
    });
  } catch (error) {
    dispatch({
      type: "getAllJobsReportDelivererFailed",
      payload: error.response.data.message,
    });
  }
};

export const getAllJobsReportContr = (contractorId) => async (dispatch) => {
  try {
    dispatch({
      type: "getAllJobsReportContrRequest",
    });

    const { data } = await axios.get(
      `${server}/job/get-all-jobsReport-contractor/${contractorId}`,
      { withCredentials: true }
    );
    dispatch({
      type: "getAllJobsReportContrSuccess",
      payload: data.contractorWithJobsReport,
    });
  } catch (error) {
    dispatch({
      type: "getAllJobsReportContrFailed",
      payload: error.response.data.message,
    });
  }
};

export const getAllJobsReportDriver = (driverId) => async (dispatch) => {
  try {
    dispatch({
      type: "getAllJobsReportDriverRequest",
    });

    const { data } = await axios.get(
      `${server}/job/get-all-jobsReport-driver/${driverId}`,
      { withCredentials: true }
    );
    dispatch({
      type: "getAllJobsReportDriverSuccess",
      payload: data.driverWithJobsReport,
    });
  } catch (error) {
    dispatch({
      type: "getAllJobsReportDriverFailed",
      payload: error.response.data.message,
    });
  }
};

export const getAllJobsReportVehicle = (vehicleId) => async (dispatch) => {
  try {
    dispatch({
      type: "getAllJobsReportVehicleRequest",
    });

    const { data } = await axios.get(
      `${server}/job/get-all-jobsReport-vehicle/${vehicleId}`,

      { withCredentials: true }
    );
    dispatch({
      type: "getAllJobsReportVehicleSuccess",
      payload: data.vehicleWithJobsReport,
    });
  } catch (error) {
    dispatch({
      type: "getAllJobsReportVehicleFailed",
      payload: error.response.data.message,
    });
  }
};
