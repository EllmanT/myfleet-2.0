import axios from "axios";
import { server } from "server";

const opts = { withCredentials: true };
export { apiMessage, money } from "utils/tripApi";

const get = async (path, params) => (await axios.get(`${server}/maintenance${path}`, { ...opts, params })).data;
const post = async (path, body) => (await axios.post(`${server}/maintenance${path}`, body || {}, opts)).data;
const put = async (path, body) => (await axios.put(`${server}/maintenance${path}`, body, opts)).data;
const del = async (path) => (await axios.delete(`${server}/maintenance${path}`, opts)).data;

export const fetchMeta = () => get("/meta");
export const fetchPlans = () => get("/get-plans");
export const createPlan = (b) => post("/create-plan", b);
export const updatePlan = (id, b) => put(`/update-plan/${id}`, b);
export const deletePlan = (id) => del(`/delete-plan/${id}`);
export const fetchRecords = (p) => get("/get-records", p);
export const createRecord = (b) => post("/create-record", b);
export const updateRecord = (id, b) => put(`/update-record/${id}`, b);
export const deleteRecord = (id) => del(`/delete-record/${id}`);
export const fetchTyres = (p) => get("/get-tyres", p);
export const createTyre = (b) => post("/create-tyre", b);
export const deleteTyre = (id) => del(`/delete-tyre/${id}`);
export const fitTyre = (b) => post("/fit-tyre", b);
export const removeTyre = (fitmentId, b) => post(`/remove-tyre/${fitmentId}`, b);
export const fetchTruckCosts = (p) => get("/truck-costs", p);
