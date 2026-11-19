import React, { useEffect } from "react";
import { Box, useTheme } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { getAllOverallStatsDeliverer } from "redux/actions/overallStats";
import { ResponsiveBar } from "@nivo/bar";
import { chartColors, nivoTheme } from "./chartColors";

const JobsBarChart = ({ isDashboard = false , view}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { coOverallStats, isCoOverallStatsLoading } = useSelector(
    (state) => state.overallStats
  );

  useEffect(() => {
    dispatch(getAllOverallStatsDeliverer());
    // dispatch(getAllContractorsPage());
  }, [dispatch]);

  if (!coOverallStats) return [];

  const { monthlyData } = coOverallStats;

  if (!coOverallStats || isCoOverallStatsLoading) return "Loading...";

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
        keys={view === "mileage" ? ["totalMileage"] : ["totalJobs"]}
        indexBy="month"
        margin={{ top: 30, right: 0, bottom: 70, left: 60 }}
        padding={0.4}
        valueScale={{ type: "linear" }}
        theme={nivoTheme(theme)}
        colors={chartColors(theme, 1)}
        borderRadius={3}
        enableGridX={false}
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

export default JobsBarChart;
