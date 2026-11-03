import axios from "axios";
import { server } from "../../server";

// Which optional modules this company has switched on.
export const loadTenant = () => async (dispatch) => {
  try {
    const { data } = await axios.get(`${server}/tenant/me`, { withCredentials: true });
    dispatch({
      type: "loadTenantSuccess",
      payload: { modules: data.modules, plan: data.plan, registry: data.registry },
    });
  } catch (error) {
    // Don't hide the whole app if this one call fails; treat everything as off
    // except core, and let the person retry from the Modules page.
    dispatch({ type: "loadTenantFailed", payload: error.response?.data?.message });
  }
};

export const saveModules = (modules) => async (dispatch) => {
  const { data } = await axios.put(
    `${server}/tenant/modules`,
    { modules },
    { withCredentials: true }
  );
  dispatch({ type: "setModules", payload: data.modules });
  return data.modules;
};
