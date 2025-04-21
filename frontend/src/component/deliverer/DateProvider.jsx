import * as React from "react";
import dayjs from "dayjs";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

export default function DateProvider({
  isEditOrUpdate,
  title,
  date,
  onChange,
  disabled,
  defaultDate,
}) {
  const convertedDate = dayjs(defaultDate, "YYYY-MM-DD").format("YYYY-MM-DD");
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DatePicker
        label={isEditOrUpdate ? `Done : ${convertedDate}` : "Order Date"}
        value={date}
        onChange={onChange}
        disabled={disabled}
      />
    </LocalizationProvider>
  );
}
