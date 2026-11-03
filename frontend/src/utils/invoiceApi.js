import axios from "axios";
import { server } from "server";

const opts = { withCredentials: true };
export { apiMessage, money } from "utils/tripApi";

const get = async (path, params) => (await axios.get(`${server}${path}`, { ...opts, params })).data;
const post = async (path, body) => (await axios.post(`${server}${path}`, body || {}, opts)).data;
const put = async (path, body) => (await axios.put(`${server}${path}`, body, opts)).data;
const del = async (path) => (await axios.delete(`${server}${path}`, opts)).data;

// invoices
export const fetchInvoiceMeta = () => get("/invoice/meta");
export const fetchInvoices = (params) => get("/invoice/get-invoices", params);
export const fetchInvoice = (id) => get(`/invoice/get-invoice/${id}`);
export const createInvoice = (body) => post("/invoice/create-invoice", body);
export const updateInvoice = (id, body) => put(`/invoice/update-invoice/${id}`, body);
export const deleteInvoice = (id) => del(`/invoice/delete-invoice/${id}`);
export const issueInvoice = (id) => post(`/invoice/issue/${id}`);
export const voidInvoice = (id, reason) => post(`/invoice/void/${id}`, { reason });
export const addCreditNote = (id, body) => post(`/invoice/credit-note/${id}`, body);
export const draftFromTrips = (body) => post("/invoice/draft-from-trips", body);
export const draftFromJobs = (body) => post("/invoice/draft-from-jobs", body);
export const fetchReceivables = (params) => get("/invoice/receivables", params);
export const fetchUnbilled = () => get("/invoice/unbilled");

// payments
export const recordPayment = (body) => post("/payment/record-payment", body);
export const fetchPayments = (params) => get("/payment/get-payments", params);
export const deletePayment = (id) => del(`/payment/delete-payment/${id}`);

// quotations
export const fetchQuotations = (params) => get("/quotation/get-quotations", params);
export const fetchQuotation = (id) => get(`/quotation/get-quotation/${id}`);
export const createQuotation = (body) => post("/quotation/create-quotation", body);
export const updateQuotation = (id, body) => put(`/quotation/update-quotation/${id}`, body);
export const setQuotationStatus = (id, status) => post(`/quotation/set-status/${id}`, { status });
export const convertQuotation = (id) => post(`/quotation/convert/${id}`);
export const deleteQuotation = (id) => del(`/quotation/delete-quotation/${id}`);

// PDFs are fetched with the session attached (a plain link can't carry it in
// Clerk mode), then opened from memory in a new tab.
export const openPdf = async (path) => {
  const res = await axios.get(`${server}${path}`, { ...opts, responseType: "blob" });
  const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};
