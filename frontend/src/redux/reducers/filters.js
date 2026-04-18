import { createReducer } from "@reduxjs/toolkit";

const currentYear = new Date().getFullYear();

export const filtersReducer = createReducer(
  { selectedYear: currentYear },
  {
    setSelectedYear: (state, action) => {
      state.selectedYear = Number(action.payload) || currentYear;
    },
  }
);
