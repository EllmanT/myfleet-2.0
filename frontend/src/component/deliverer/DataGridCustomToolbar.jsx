import React, { useState, useRef } from "react";
import { Refresh, Search } from "@mui/icons-material";
import { TextField, InputAdornment, Button } from "@mui/material";
import FlexBetween from "./FlexBetween";
import axios from "axios";
import { server } from "server";

const DataGridCustomToolbar = ({
  searchInput,
  setSearchInput,
  setJobSearch,
  results,
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
    setSearchInput("");
    setJobSearch("");
    setView("");
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
    link.download = `jobs-export.${type === "csv" ? "csv" : "pdf"}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(href);
  };

  return (
    <div>
      <FlexBetween width="100%">
        <FlexBetween>
          {exportParams?.enabled ? (
            <>
              <Button
                variant="outlined"
                size="small"
                sx={{ mr: "0.5rem" }}
                onClick={() => triggerDownload("csv")}
              >
                Export CSV
              </Button>
              <Button
                variant="outlined"
                size="small"
                sx={{ mr: "0.5rem" }}
                onClick={() => triggerDownload("pdf")}
              >
                Export PDF
              </Button>
            </>
          ) : null}
        </FlexBetween>

        <FlexBetween>
          <Button
            variant="outlined"
            color="info"
            sx={{ mr: "1rem" }}
            onClick={handleReset}
          >
            <Refresh />
          </Button>
          <Button variant="outlined" color="info" sx={{ mr: "1rem" }}>
            {view !== "" ? (
              <>
                <b>{view} </b> <span>&nbsp;</span> : <span>&nbsp;</span>{" "}
                {results}
              </>
            ) : (
              <>
                Results <span>&nbsp;</span> : <span>&nbsp;</span> {results}
              </>
            )}
          </Button>
          <TextField
            label="Search..."
            sx={{ mb: 0.5, width: "250px" }}
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
        </FlexBetween>
      </FlexBetween>
    </div>
  );
};

export default DataGridCustomToolbar;
