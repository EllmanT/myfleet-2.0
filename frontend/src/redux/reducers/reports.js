import { createReducer } from "@reduxjs/toolkit";

const initialState = {
  isLoading: true,
};

export const jobReducer = createReducer(initialState, {
  //load order request
  loadCreateJobRequest: (state) => {
    state.isLoading = true;
  },
  //load order added success
  loadCreateJobSuccess: (state, action) => {
    state.isLoading = false;
    state.success = true;
    state.job = action.payload;
  },
  //load order added failed
  loadCreateJobFailed: (state, action) => {
    state.isLoading = false;
    state.success = false;
    state.error = action.payload;
  },

  getAllJobsPageRequest: (state) => {
    state.allJobsPageLoading = true;
  },
  getAllJobsPageSuccess: (state, action) => {
    state.allJobsPageLoading = false;
    state.jobsPage = action.payload;
  },
  setTotalCount: (state, action) => { // Add this new reducer case
    state.totalCount = action.payload;
  },
  getAllJobsPageFailed: (state, action) => {
    state.allJobsPageLoading = false;
    state.error = action.payload;
  },

  getLatestJobsDelivererRequest: (state) => {
    state.latestJobsDelivererLoading = true;
  },
  getLatestJobsDelivererSuccess: (state, action) => {
    state.latestJobsDelivererLoading = false;
    state.latestJobsDeliverer = action.payload;
  },
  getLatestJobsDelivererFailed: (state, action) => {
    state.latestJobsDelivererLoading = false;
    state.error = action.payload;
  },







   //load all job reports of a deliverer

   getAllJobsReportDelivererRequest: (state) => {
    state.isAllJobsReportDelivererLoading = true;
  },
  //load all overallStats of a Deliverer success
  getAllJobsReportDelivererSuccess: (state, action) => {
    state.isAllJobsReportDelivererLoading = false;
    state.AllJobsReportDeliverer = action.payload;
  },

  //load all overallStats of a Deliverer failed
  getAlJobsReportDelivererFailed: (state, action) => {
    state.isAllJobsReportDelivererLoading = false;
    state.error = action.payload;
  },
  //updating the job

  updateJobRequest: (state) => {
    state.isUpdateJob = true;
  },
  updateJobSuccess: (state, action) => {
    state.isUpdateJob = false;
    state.job = action.payload;
  },
  updateJobFailed: (state, action) => {
    state.isUpdateJob = false;
    state.error = action.payload;
  },

  // delete Job of a shop
  deleteJobRequest: (state) => {
    state.isLoading = true;
  },
  deleteJobSuccess: (state, action) => {
    state.isLoading = false;
    state.message = action.payload;
  },
  deleteJobFailed: (state, action) => {
    state.isLoading = false;
    state.error = action.payload;
  },

  //clear errors
  clearErrors: (state) => {
    state.error = null;
  },
  clearMessages: (state) => {
    state.success = null;
  },
});
