import React, { useEffect, useState } from "react";
import { Box, Button } from "@mui/material";
import { Print } from "@mui/icons-material";
import JobsDailyLineChart from "component/deliverer/charts/JobsDailyLineChart";
import Header from "component/deliverer/Header";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import { getAllDeliverersPage } from "redux/actions/deliverer";
import DriverDailyLineChart from "component/deliverer/charts/DriverDailyLineChart";
import RevenueBarChart from "component/deliverer/charts/RevenueBarChart";

const handlePrint = () => {
  const printContent = document.getElementById("print-content");
  const windowUrl = window.location.href;
  const uniqueWindowName = window.open(windowUrl, "_blank");
  uniqueWindowName.document.open();
  uniqueWindowName.document.write(`
      <html>
        <head>
          <title>Revenue MonthlyData</title>
          <style>
          
  
            h1 {
              font-size: 24px;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <h1>Monthly Jobs Analysis </h1>
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
const DashRevenueMonthlyPage = () => {
  const { companyId} = useParams();


console.log("year", companyId)
  return (
    <Box m="1.5rem 2.5rem">
      <Box display="flex">
        {/* Your Header component */}
        <Header
          title={`MONTHLY REVENUE ANALYSIS`}
          subtitle="Chart of monthly revenue info"
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
        <RevenueBarChart isDashboard={false} year={companyId} view={"revenue"}/>
      </Box>
    </Box>
  );
};

export default DashRevenueMonthlyPage;
