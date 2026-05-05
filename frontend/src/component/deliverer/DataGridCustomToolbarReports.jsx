import React, { useState, useRef } from "react";
import { Refresh, Search } from "@mui/icons-material";
import {
  IconButton,
  TextField,
  InputAdornment,
  Button,
  Box,
  FormControl,
  MenuItem,
  Select,
} from "@mui/material";
import FlexBetween from "./FlexBetween";
import ReactDatePicker from "react-datepicker";
import axios from "axios";
import { server } from "server";

const DataGridCustomToolbarReports = ({
  searchInput,
  setSearchInput,
  setJobSearch,
  results,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  defaultStartDate,
  defaultEndDate,
  totalJobsDistance,
  totalJobsCost,
  totalJobsCount,
  delivererName,
  contractorName,
  vehicleRegNumber,
  driverName,
  selectedYear,
  setSelectedYear,
  exportParams = {},
}) => {
  const [view, setView] = useState("");
  const debounceTimer = useRef(null);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setJobSearch(value);
    }, 400);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      setJobSearch(searchInput);
    }
    if (e.key === "Escape") {
      handleReset();
    }
  };

  const handleReset = () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setJobSearch("");
    setSearchInput("");
    setView("");
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
  };

  const triggerDownload = async (type) => {
    const response = await axios.get(`${server}/job/export-jobs-${type}`, {
      withCredentials: true,
      params: exportParams,
      responseType: "blob",
    });
    const href = window.URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = href;
    const ext = type === "csv" ? "csv" : "pdf";
    const today = new Date().toISOString().split("T")[0];
    const clean = (s) => String(s || "").trim().replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    let filename;
    if (exportParams?.scope === "vehicle" && exportParams?.vehicleMake) {
      filename = `${clean(exportParams.vehicleMake)}-${clean(exportParams.entityName)}-${today}-jobs.${ext}`;
    } else {
      filename = `${clean(exportParams?.entityName)}-${today}-jobs.${ext}`;
    }
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(href);
  };

  return (
    <div>
      <FlexBetween width="100%">
        <FlexBetween>
          <Button variant="outlined" color="info" sx={{ mr: "1rem" }}>
            {view !== "" ? (
              <>
                <b>{view} </b> <span>&nbsp;</span> : <span>&nbsp;</span>{" "}
                <b>{results}</b>
              </>
            ) : (
              <>
                <span>&nbsp;</span> <span>&nbsp;</span>
                {delivererName !== null && delivererName}
                {contractorName !== null && contractorName}
                {vehicleRegNumber !== null && vehicleRegNumber}
                {driverName !== null && driverName}
              </>
            )}
          </Button>
        </FlexBetween>

        <FlexBetween>
          <Button variant="outlined" color="info" sx={{ mr: "1rem" }}>
            {view !== "" ? (
              <>
                <b>{view} </b> <span>&nbsp;</span> : <span>&nbsp;</span>{" "}
                {results}
              </>
            ) : (
              <>
                Jobs <span>&nbsp;</span> : <span>&nbsp;</span> {totalJobsCount}
              </>
            )}
          </Button>
          <Button variant="outlined" color="info" sx={{ mr: "1rem" }}>
            {view !== "" ? (
              <>
                <b>{view} </b> <span>&nbsp;</span> : <span>&nbsp;</span>{" "}
                {results}
              </>
            ) : (
              <>
                Dist : <span>&nbsp;</span>
                <b>{totalJobsDistance}</b>km
              </>
            )}
          </Button>
          <Button variant="outlined" color="info">
            {view !== "" ? (
              <>
                <b>{view} </b> <span>&nbsp;</span> : <span>&nbsp;</span>{" "}
                {results}
              </>
            ) : (
              <>
                Cost : <span>&nbsp;</span> $<b>{totalJobsCost.toFixed(2)}</b>
              </>
            )}
          </Button>
        </FlexBetween>
      </FlexBetween>
      <FlexBetween width="100%">
        <FlexBetween>
          {exportParams?.enabled ? (
            <>
              <Button
                size="small"
                variant="outlined"
                color="info"
                sx={{ mr: "0.5rem" }}
                onClick={() => triggerDownload("csv")}
              >
                Export CSV
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="info"
                sx={{ mr: "0.5rem" }}
                onClick={() => triggerDownload("pdf")}
              >
                Export PDF
              </Button>
            </>
          ) : null}
          <Button
            size="small"
            variant="outlined"
            color="info"
            sx={{ mr: "0.5rem" }}
            onClick={handleReset}
          >
            <Refresh />
          </Button>
        </FlexBetween>

        <FlexBetween>
          <TextField
            label="Search..."
            sx={{ mr: "0.5rem", width: "220px" }}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            value={searchInput}
            variant="outlined"
            size="small"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <Box display={"flex"}>
            <FormControl size="small" sx={{ mr: "0.5rem", minWidth: "100px" }}>
              <Select
                color="info"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {Array.from(
                  { length: new Date().getFullYear() - 2019 },
                  (_, i) => new Date().getFullYear() - i
                ).map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <ReactDatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              selectsStart
              startDate={startDate}
              endDate={endDate}
            />

            <ReactDatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={startDate}
            />
          </Box>
        </FlexBetween>
      </FlexBetween>
    </div>
  );
};

export default DataGridCustomToolbarReports;
