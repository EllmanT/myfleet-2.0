import { useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import Store from "redux/store";
import { loadUser } from "redux/actions/user";
import { getRates } from "redux/actions/rate";
import { server } from "server";

/**
 * Connects Clerk to the rest of the app. Renders nothing.
 *
 * 1. Every request to OUR API carries the Clerk session token (and only ours,
 *    so the token never goes to another origin).
 * 2. After sign-in (and after switching organization) it asks the API to link
 *    the Clerk user and organization to our own records, then loads the app.
 * 3. A signed-out visitor falls back to the existing cookie login.
 */
const ClerkBridge = () => {
  const { isLoaded, isSignedIn, getToken, userId, orgId } = useAuth();
  const navigate = useNavigate();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  // 1. attach the token to calls to our own API
  useEffect(() => {
    const id = axios.interceptors.request.use(async (config) => {
      if (config.url && config.url.startsWith(server)) {
        const token = await getTokenRef.current();
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    });
    return () => axios.interceptors.request.eject(id);
  }, []);

  // 2/3. link, then load
  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;

    const run = async () => {
      Store.dispatch({ type: "loadUserRequest" });

      if (!isSignedIn) {
        // not signed in with Clerk: the legacy cookie login may still apply
        await Store.dispatch(loadUser());
        Store.dispatch(getRates());
        return;
      }

      try {
        const { data } = await axios.post(`${server}/auth/bootstrap`, {}, { withCredentials: true });
        if (cancelled) return;
        if (data.needsOrganization) {
          Store.dispatch({ type: "loadUserFailed", payload: "Choose or create a company" });
          navigate("/create-organization", { replace: true });
          return;
        }
        await Store.dispatch(loadUser());
        Store.dispatch(getRates());
      } catch (error) {
        if (cancelled) return;
        Store.dispatch({
          type: "loadUserFailed",
          payload: error.response?.data?.message || "Could not finish signing you in",
        });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // re-run when the person signs in/out or switches organization
  }, [isLoaded, isSignedIn, userId, orgId, navigate]);

  return null;
};

export default ClerkBridge;
