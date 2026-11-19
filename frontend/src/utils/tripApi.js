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

// how far along the money is for a trip
export const PAY_LABELS = {
  not_invoiced: "Not invoiced",
  draft_invoice: "Invoice draft",
  invoiced: "Invoiced, unpaid",
  part_paid: "Part paid",
  paid: "Paid",
};

// purchase orders (received from clients)
export const fetchPurchaseOrders = async (params) => (await axios.get(`${server}/purchase-order/get-pos`, { ...opts, params })).data;
export const fetchPurchaseOrder = async (id) => (await axios.get(`${server}/purchase-order/get-po/${id}`, opts)).data;
export const createPurchaseOrder = async (body) => (await axios.post(`${server}/purchase-order/create-po`, body, opts)).data;
export const updatePurchaseOrder = async (id, body) => (await axios.put(`${server}/purchase-order/update-po/${id}`, body, opts)).data;
export const deletePurchaseOrder = async (id) => (await axios.delete(`${server}/purchase-order/delete-po/${id}`, opts)).data;
export const addPurchaseOrderTrips = async (id, count) => (await axios.post(`${server}/purchase-order/add-trips/${id}`, { count }, opts)).data;

const sendFile = async (url, field, file) => {
  const form = new FormData();
  form.append(field, file);
  return (await axios.post(url, form, opts)).data;
};
export const uploadPurchaseOrderDocument = (id, file) => sendFile(`${server}/purchase-order/document/${id}`, "document", file);

// delivery notes
export const createDeliveryNote = async (tripId) => (await axios.post(`${server}/trip/delivery-note/${tripId}`, {}, opts)).data;
export const uploadSignedCopy = (tripId, file) => sendFile(`${server}/trip/signed-copy/${tripId}`, "file", file);
export const removeSignedCopy = async (tripId) => (await axios.delete(`${server}/trip/signed-copy/${tripId}`, opts)).data;

// company letterhead (logo, phone, email, TIN, bank details...)
export const fetchLetterhead = async () => (await axios.get(`${server}/letterhead`, opts)).data;
export const saveLetterhead = async (body) => (await axios.put(`${server}/letterhead`, body, opts)).data;
export const uploadLogo = (file) => sendFile(`${server}/letterhead/logo`, "logo", file);
export const removeLogo = async () => (await axios.delete(`${server}/letterhead/logo`, opts)).data;
