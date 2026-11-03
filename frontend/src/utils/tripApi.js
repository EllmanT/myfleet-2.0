import axios from "axios";
import { server } from "server";

const opts = { withCredentials: true };

export const apiMessage = (e) => e?.response?.data?.message || e.message || "Something went wrong";

export const money = (n, currency = "USD") =>
  `${currency === "USD" ? "$" : currency + " "}${Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const COST_LABELS = {
  fuel: "Fuel",
  toll: "Toll",
  zinara: "ZINARA",
  border_fee: "Border fee",
  transit_fee: "Transit fee",
  permit: "Permit",
  agent_fee: "Clearing agent",
  parking: "Parking",
  fine: "Fine",
  allowance: "Driver allowance",
  repairs: "Repairs",
  other: "Other",
};

export const DOC_LABELS = {
  yellow_card: "COMESA Yellow Card",
  vehicle_licence: "Vehicle licence",
  roadworthy: "Roadworthy certificate",
  insurance: "Insurance",
  sadc_permit: "SADC cross-border permit",
  carbon_tax: "Carbon tax",
  drivers_licence: "Driver's licence",
  prdp: "PrDP",
  passport: "Passport",
  other: "Other",
};

export const STATUS_LABELS = {
  planned: "Planned",
  in_transit: "In transit",
  delivered: "Delivered",
  closed: "Closed",
  cancelled: "Cancelled",
};

// trips
export const fetchTripMeta = async () => (await axios.get(`${server}/trip/meta`, opts)).data;
export const fetchTrips = async (params) => (await axios.get(`${server}/trip/get-trips`, { ...opts, params })).data;
export const fetchTripSummary = async (params) => (await axios.get(`${server}/trip/summary`, { ...opts, params })).data;
export const createTrip = async (body) => (await axios.post(`${server}/trip/create-trip`, body, opts)).data;
export const updateTrip = async (id, body) => (await axios.put(`${server}/trip/update-trip/${id}`, body, opts)).data;
export const deleteTrip = async (id) => (await axios.delete(`${server}/trip/delete-trip/${id}`, opts)).data;

// trailers
export const fetchTrailers = async () => (await axios.get(`${server}/trailer/get-trailers`, opts)).data;
export const createTrailer = async (body) => (await axios.post(`${server}/trailer/create-trailer`, body, opts)).data;
export const updateTrailer = async (id, body) => (await axios.put(`${server}/trailer/update-trailer/${id}`, body, opts)).data;
export const deleteTrailer = async (id) => (await axios.delete(`${server}/trailer/delete-trailer/${id}`, opts)).data;

// compliance documents
export const fetchDocMeta = async () => (await axios.get(`${server}/compliance/meta`, opts)).data;
export const fetchDocs = async (params) => (await axios.get(`${server}/compliance/get-docs`, { ...opts, params })).data;
export const createDoc = async (body) => (await axios.post(`${server}/compliance/create-doc`, body, opts)).data;
export const updateDoc = async (id, body) => (await axios.put(`${server}/compliance/update-doc/${id}`, body, opts)).data;
export const deleteDoc = async (id) => (await axios.delete(`${server}/compliance/delete-doc/${id}`, opts)).data;
