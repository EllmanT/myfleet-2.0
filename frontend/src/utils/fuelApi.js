import axios from "axios";
import { server } from "server";

const opts = { withCredentials: true };

export const fetchFuelMeta = async () => (await axios.get(`${server}/fuel/meta`, opts)).data;
export const fetchFills = async (params) =>
  (await axios.get(`${server}/fuel/get-fills`, { ...opts, params })).data;
export const fetchWeekly = async (date) =>
  (await axios.get(`${server}/fuel/weekly`, { ...opts, params: { date } })).data;
export const createFill = async (body) => (await axios.post(`${server}/fuel/create-fill`, body, opts)).data;
export const updateFill = async (id, body) =>
  (await axios.put(`${server}/fuel/update-fill/${id}`, body, opts)).data;
export const deleteFill = async (id) => (await axios.delete(`${server}/fuel/delete-fill/${id}`, opts)).data;

export const STATUS_LABEL = { ok: "OK", check: "Check", review: "Review" };
export const STATUS_HELP = {
  ok: "Normal fuel use",
  check: "Ask the driver to explain",
  review: "Take to the owner",
};
