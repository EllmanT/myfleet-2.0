const mongoose = require("mongoose");

// One flat document per expense or extra-income entry.
// Kept separate from the old vehicleexpenses / employeeexpenses collections,
// which the seed and migrate scripts drop and rebuild.
const EXPENSE_CATEGORIES = [
  "fuel",
  "private_fuel", // tracked only, never counted in profit
  "driver_salary",
  "owner_salary",
  "family_salary",
  "insurance",
  "service",
  "other",
];
const INCOME_CATEGORIES = ["cash_hire", "other_income"];

const ExpenseSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deliverer",
      required: true,
    },
    type: {
      type: String,
      enum: ["expense", "income"],
      default: "expense",
    },
    date: { type: Date, required: true },
    category: {
      type: String,
      required: true,
      enum: [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES],
    },
    description: { type: String, default: "" },
    amount: { type: Number, required: true, min: 0 },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
    payee: { type: String, default: "" }, // salary recipient
    litres: { type: Number, min: 0 },
    pricePerLitre: { type: Number, min: 0 },
    isEstimate: { type: Boolean, default: false },
    // false = tracked for information only (e.g. private fuel)
    countsInProfit: { type: Boolean, default: true },
    // true = salary left in the business (e.g. Dad): a cost, but not cash out
    retainedInBusiness: { type: Boolean, default: false },
    notes: { type: String, default: "" },
    source: { type: String, default: "manual" },
    // lets imports be re-run without creating duplicates
    importKey: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

ExpenseSchema.index({ companyId: 1, date: 1 });
ExpenseSchema.index({ vehicleId: 1, date: 1 });
// Only expenses that HAVE an import key are kept unique. (A compound `sparse` index
// still indexes documents missing importKey, as null, so a company's second manual
// expense failed with a duplicate-key error.) Existing databases need
// scripts/fixExpenseIndex.js once, because an index can't be changed in place.
ExpenseSchema.index(
  { companyId: 1, importKey: 1 },
  { unique: true, partialFilterExpression: { importKey: { $type: "string" } } }
);

const Expense = mongoose.model("Expense", ExpenseSchema);
Expense.EXPENSE_CATEGORIES = EXPENSE_CATEGORIES;
Expense.INCOME_CATEGORIES = INCOME_CATEGORIES;
module.exports = Expense;
