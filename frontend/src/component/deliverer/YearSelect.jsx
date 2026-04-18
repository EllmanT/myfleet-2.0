import React from "react";
import { FormControl, MenuItem, Select } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";

const YearSelect = ({ minYear = 2020 }) => {
  const dispatch = useDispatch();
  const selectedYear = useSelector((state) => state.filters.selectedYear);
  const currentYear = new Date().getFullYear();
  const years = [];

  for (let year = currentYear; year >= minYear; year -= 1) {
    years.push(year);
  }

  return (
    <FormControl sx={{ ml: "1rem", minWidth: "100px" }} size="small">
      <Select
        color="info"
        value={selectedYear}
        onChange={(e) =>
          dispatch({ type: "setSelectedYear", payload: Number(e.target.value) })
        }
        inputProps={{ "aria-label": "Select year" }}
      >
        {years.map((year) => (
          <MenuItem key={year} value={year}>
            {year}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default YearSelect;
