import axios from "axios";
import { server } from "../../server";
import { loadTenant } from "./tenant";

const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Only a real "not signed in" answer (401/403) signs the person out. A busy
// server (429), a hiccup (5xx) or a dropped connection is retried a few times
// first, so a temporary problem does not throw someone back to the login page.
export const loadUser = () => async (dispatch) => {
  dispatch({
    type: "loadUserRequest",
  });

  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data } = await axios.get(`${server}/user/get-user`, {
        withCredentials: true,
      });

      dispatch({
        type: "loadUserSuccess",
        payload: data.user,
      });
      dispatch({
        type: "loadCompanyName",
        payload: data.delivererName,
      });
      dispatch(loadTenant());
      return;
    } catch (error) {
      const status = error.response?.status;
      const notSignedIn = status === 401 || status === 403;
      if (notSignedIn || attempt === maxAttempts) {
        dispatch({
          type: "loadUserFailed",
          payload: error.response?.data?.message || error.message,
        });
        return;
      }
      await sleepMs(attempt * 1000);
    }
  }
};

export const getAllAdminsPage =
  (page, pageSize, sort, search) => async (dispatch) => {
    try {
      dispatch({
        type: "getAllAdminsPageRequest",
      });
      const { data } = await axios.get(`${server}/user/get-all-admins-page`, {
        withCredentials: true,
        params: {
          page,
          pageSize,
          sort,
          search,
        },
      });
      dispatch({ type: "getAllAdminsPageSuccess", payload: data.pageAdmins });
      dispatch({
        type: "setTotalCount",
        payload: data.totalCount,
      });
    } catch (error) {
      dispatch({
        type: "getAllAdminsPageFailed",
        payload: error.response?.data?.message || error.message,
      });
    }
  };

export const updateAdmin =
  (adminId, name, email, phoneNumber, city, address, role) =>
  async (dispatch) => {
    try {
      dispatch({
        type: "updateAdminRequest",
      });

      const { data } = await axios.put(
        `${server}/user/update-admin`,
        { adminId, name, email, phoneNumber, city, address, role },
        { withCredentials: true }
      );

      dispatch({
        type: "updateAdminSuccess",
        payload: data.Admin,
      });
    } catch (error) {
      dispatch({
        type: "updateAdminFailed",
        payload: error.response?.data?.message || error.message,
      });
    }
  };

// delete Admin of
export const deleteAdmin = (adminId) => async (dispatch) => {
  try {
    dispatch({
      type: "deleteAdminRequest",
    });

    const { data } = await axios.delete(
      `${server}/user/delete-admin/${adminId}`,
      {
        withCredentials: true,
      }
    );

    dispatch({
      type: "deleteAdminSuccess",
      payload: data.message,
    });
  } catch (error) {
    dispatch({
      type: "deleteAdminFailed",
      payload: error.response?.data?.message || error.message,
    });
  }
};
