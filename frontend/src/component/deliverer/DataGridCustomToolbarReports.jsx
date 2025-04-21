import React, { useState } from "react";
import { Refresh, Search } from "@mui/icons-material";
import {
  IconButton,
  TextField,
  InputAdornment,
  Button,
  Box,
} from "@mui/material";
import {
  GridToolbarDensitySelector,
  GridToolbarContainer,
  GridToolbarExport,
  GridToolbarColumnsButton,
} from "@mui/x-data-grid";
import FlexBetween from "./FlexBetween";
import ReactDatePicker from "react-datepicker";

const DataGridCustomToolbarReports = ({
  searchInput,
  setSearchInput,
  setJobSearch,
  results,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  totalJobsDistance,
  totalJobsCost,
  totalJobsCount,
  delivererName,
  contractorName,
  vehicleRegNumber,
  driverName,
}) => {
  const [view, setView] = useState("");

  // const [startDate, setStartDate] = useState(starttDate);
  //const [endDate, setEndDate] = useState(currentDate);
  const [isDisabled, setIsDisabled] = useState(false);

  const handleReset = () => {
    setJobSearch("");
    setView("");
  };

  return (
    <GridToolbarContainer>
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
          <GridToolbarColumnsButton />
          <GridToolbarDensitySelector />
          <GridToolbarExport />
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
          <Box display={"flex"}>
            <ReactDatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              disabled={isDisabled}
            />

            <ReactDatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={startDate}
              disabled={isDisabled}
            />
          </Box>
        </FlexBetween>
      </FlexBetween>
    </GridToolbarContainer>
  );
};

export default DataGridCustomToolbarReports;
