import React, { useEffect, useState } from "react";
import { Box, Button } from "@mui/material";
import { Print } from "@mui/icons-material";
import JobsDailyLineChart from "component/deliverer/charts/JobsDailyLineChart";
import Header from "component/deliverer/Header";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import { getAllDeliverersPage } from "redux/actions/deliverer";
import VehicleDailyLineChart from "component/deliverer/charts/VehicleDailyLineChart";

const handlePrint = () => {
  const printContent = document.getElementById("print-content");
  const windowUrl = window.location.href;
  const uniqueWindowName = window.open(windowUrl, "_blank");
  uniqueWindowName.document.open();
  uniqueWindowName.document.write(`
      <html>
        <head>
          <title>DailyData</title>
          <style>
          
  
            h1 {
              font-size: 24px;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <h1> Daily Data Analysis </h1>
          ${printContent.innerHTML}
          <script type="text/javascript">
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);
  uniqueWindowName.document.close();
};
const DashVehicleDataPage = () => {
  const { vehicleId } = useParams();

  return (
    <Box m="1.5rem 2.5rem">
      <Box display="flex">
        {/* Your Header component */}
        <Header
          title="DAILY JOBS INFO FOR THE VEHICLE"
          subtitle="Chart of daily jobs and mileages"
        />
      </Box>
      <Button
        variant="outlined"
        size="small"
        color="info"
        onClick={handlePrint}
      >
        <Print /> Print Chart
      </Button>
      <Box height="75vh" id="print-content">
        {/* Your JobsDailyLineChart component */}
        <VehicleDailyLineChart vehicleId={vehicleId} />
      </Box>
    </Box>
  );
};

export default DashVehicleDataPage;
