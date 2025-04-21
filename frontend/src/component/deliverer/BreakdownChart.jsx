import React, { useEffect } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { ResponsivePie } from "@nivo/pie";
import { useDispatch, useSelector } from "react-redux";
import { getAllOverallStatsDeliverer } from "redux/actions/overallStats";
import { getAllContractorsPage } from "redux/actions/contractor";
import { getLatestJobsDeliverer, getLatestJobsPage } from "redux/actions/job";

const BreakdownChart = ({ isDashboard = false }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { coOverallStats, isCoOverallStatsLoading } = useSelector(
    (state) => state.overallStats
  );

  useEffect(() => {
    dispatch(getLatestJobsDeliverer());
    dispatch(getAllOverallStatsDeliverer());
    dispatch(getAllContractorsPage());
  }, [dispatch]);
  let formattedData;
console.log(coOverallStats)
  console.log(formattedData);
  if (!coOverallStats || isCoOverallStatsLoading) return "Loading...";

  if (
    !isCoOverallStatsLoading &&
    coOverallStats &&
    coOverallStats.jobsByContractor
  ) {
    const colors = [
      theme.palette.secondary[200],
      theme.palette.secondary[400],
      theme.palette.secondary[300],
      theme.palette.secondary[800],
    ];

    formattedData = Object.entries(coOverallStats.jobsByContractor).map(
      ([contractor, jobs], i) => ({
        id: contractor,
        label: contractor,
        value: jobs,
        color: colors[i],
      })
    );
  }

  return (
    <Box
      height={isDashboard ? "400px" : "100%"}
      width={undefined}
      minHeight={isDashboard ? "325px" : undefined}
      minWidth={isDashboard ? "325px" : undefined}
      position="relative"
    >
      <ResponsivePie
        data={formattedData}
        theme={{
          axis: {
            domain: {
              line: {
                stroke: theme.palette.secondary[200],
              },
            },
            legend: {
              text: {
                fill: theme.palette.secondary[200],
              },
            },
            ticks: {
              line: {
                stroke: theme.palette.secondary[200],
                strokeWidth: 1,
              },
              text: {
                fill: theme.palette.secondary[200],
              },
            },
          },
          legends: {
            text: {
              fill: theme.palette.secondary[200],
            },
          },
          tooltip: {
            container: {
              color: theme.palette.primary,
            },
          },
        }}
        colors={{ datum: "data.color" }}
        margin={
          isDashboard
            ? { top: 10, right: 10, bottom: 50, left: 0 }
            : { top: 40, right: 80, bottom: 80, left: 80 }
        }
        sortByValue={true}
        innerRadius={0.45}
        activeOuterRadiusOffset={8}
        borderWidth={1}
        borderColor={{
          from: "color",
          modifiers: [["darker", 0.2]],
        }}
        enableArcLinkLabels={!isDashboard}
        arcLinkLabelsTextColor={theme.palette.secondary[200]}
        arcLinkLabelsThickness={2}
        arcLinkLabelsColor={{ from: "color" }}
        arcLabelsSkipAngle={10}
        arcLabelsTextColor={{
          from: "color",
          modifiers: [["darker", 2]],
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
      >
        <Typography variant="h6">{coOverallStats.yearlyJobs} jobs</Typography>
      </Box>
    </Box>
  );
};

export default BreakdownChart;
