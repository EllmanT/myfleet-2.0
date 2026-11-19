import React, { useEffect } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { ResponsivePie } from "@nivo/pie";
import { useDispatch, useSelector } from "react-redux";
import { getAllOverallStatsDeliverer } from "redux/actions/overallStats";
import { getAllContractorsPage } from "redux/actions/contractor";
import { getLatestJobsDeliverer } from "redux/actions/job";
import { chartColors, pieProps } from "./charts/chartColors";

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
  if (!coOverallStats || isCoOverallStatsLoading) return "Loading...";

  if (
    !isCoOverallStatsLoading &&
    coOverallStats &&
    coOverallStats.jobsByContractor
  ) {
    const colors = chartColors(theme, Object.keys(coOverallStats.jobsByContractor).length);

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
        {...pieProps(theme)}
        margin={
          isDashboard
            ? { top: 10, right: 10, bottom: 50, left: 0 }
            : { top: 40, right: 80, bottom: 80, left: 80 }
        }
        innerRadius={0.45}
        enableArcLinkLabels={!isDashboard}
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
        <Typography variant="h6" color="text.primary">{coOverallStats.yearlyJobs} jobs</Typography>
      </Box>
    </Box>
  );
};

export default BreakdownChart;
