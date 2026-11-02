import axios from "axios";
import { server } from "server";

const opts = { withCredentials: true };
const msg = (e) => e?.response?.data?.message || e.message || "Something went wrong";

export const CATEGORY_LABELS = {
  fuel: "Fuel (business)",
  private_fuel: "Private fuel (not in profit)",
  driver_salary: "Driver salary",
  owner_salary: "Owner salary",
  family_salary: "Family salary",
  insurance: "Insurance",
  service: "Service / repairs",
  other: "Other",
  cash_hire: "Cash hires",
  other_income: "Other income",
};

export const money = (n) =>
  `$${Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const apiMessage = msg;

export const fetchMeta = async () =>
  (await axios.get(`${server}/expense/meta`, opts)).data;

export const fetchExpenses = async (params) =>
  (await axios.get(`${server}/expense/get-expenses`, { ...opts, params })).data;

export const createExpense = async (body) =>
  (await axios.post(`${server}/expense/create-expense`, body, opts)).data;

export const updateExpense = async (id, body) =>
  (await axios.put(`${server}/expense/update-expense/${id}`, body, opts)).data;

export const deleteExpense = async (id) =>
  (await axios.delete(`${server}/expense/delete-expense/${id}`, opts)).data;

export const fetchProfitability = async (year) =>
  (await axios.get(`${server}/expense/profitability`, { ...opts, params: { year } })).data;
