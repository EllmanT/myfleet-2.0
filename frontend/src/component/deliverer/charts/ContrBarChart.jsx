import React, { useEffect } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { ResponsivePie } from "@nivo/pie";
import { useDispatch, useSelector } from "react-redux";
import { getAllOverallStatsDeliverer } from "redux/actions/overallStats";
import { getAllContractorsPage } from "redux/actions/contractor";
import { getContractorStats } from "redux/actions/contractorStats";
import { useParams } from "react-router-dom";
import { ResponsiveBar } from "@nivo/bar";

const ContrBarChart = ({ isDashboard = false, view }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { contractorId } = useParams();
  const { contractorStats, isContractorStatsLoading } = useSelector(
    (state) => state.contractorStats
  );

  useEffect(() => {
    dispatch(getContractorStats(contractorId));
    // dispatch(getAllContractorsPage());
  }, [dispatch]);

  if (!contractorStats) return [];

  const { monthlyData } = contractorStats;

  if (!contractorStats || isContractorStatsLoading) return "Loading...";

  ////

  return (
    <Box
      height={isDashboard ? "400px" : "100%"}
      width={undefined}
      minHeight={isDashboard ? "325px" : undefined}
      minWidth={isDashboard ? "400px" : undefined}//might affect responsiveness
      position="relative"
    >
      <ResponsiveBar
        data={monthlyData}
        keys={view === "revenue" ? ["totalRevenue"] : ["totalJobs"]}
        indexBy="month"
        margin={{ top: 50, right: 0, bottom: 70, left: 60 }}
        padding={0.4}
        valueScale={{ type: "linear" }}
        colors={{ scheme: "category10" }}
        animate={true}
        enableLabel={false}
        axisTop={null}
        axisRight={null}
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: `Total ${view==="mileage" ? "Dist(km)" : "Jobs"} for the year`,
          legendPosition: "middle",
          legendOffset: -50,
        }}
        axisBottom={{
          format: (v) => {
            if (isDashboard) return v.slice(0, 3);
            return v;
          },
          tickRotation: 90,
          tickSize: 5,
          tickPadding: 5,
  
  
         }}
      />

      <Box
        position="absolute"
        top="50%"
        left="50%"
        textAlign="center"
        pointerEvents="none"
        sx={{
          transform: isDashboard
            ? "translate(-75%, -170%)"
            : "translate(-50%, -100%)",
        }}
      ></Box>
    </Box>
  );
};

export default ContrBarChart;
