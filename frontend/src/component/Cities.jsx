import { InputLabel, MenuItem, Select } from "@mui/material";
import React, { useState } from "react";

const cities = [
  "Mutare",

  "Harare",

  "Bulawayo",

  "Rusape",

  "Chinhoyi",

  "Gweru",
  "Kadoma",
  "Chegutu",
  "Victoria Falls",
  "Masvingo",
  "Hwange",
  "Marondera",
  "Chipinge",
  "Chimanimani",
  "Nyanga",
  "Kariba",
  "BeitBridge",
  "Chirundu",
];
cities.sort();
export default function Cities({ name, onChange, disabled }) {
  return (
    <>
      <InputLabel id="demo-simple-select-autowidth-label">City</InputLabel>
      <Select
        disabled={disabled}
        color="info"
        labelId="simple-select-autowidth-label"
        id="demo-simple-select-autowidth"
        value={name}
        onChange={onChange}
        autoWidth
        label="City"
      >
        {cities.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
    </>
  );
}
