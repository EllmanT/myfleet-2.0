import axios from "axios";
import { server } from "../../server";

export const loadUser = () => async (dispatch) => {
  try {
    dispatch({
      type: "loadUserRequest",
    });

    const { data } = await axios.get(`${server}/user/get-user`, {
      withCredentials: true,
    });

    dispatch({
      type: "loadUserSuccess",
      payload: data.user,
    });
    dispatch({
      type:"loadCompanyName",
      payload: data.delivererName,
    })
  } catch (error) {
    dispatch({
      type: "loadUserFailed",
      payload: error.response.data.message,
    });
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
        payload: error.response.data.message,
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
        payload: error.response.data.message,
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
      payload: error.response.data.message,
    });
  }
};
