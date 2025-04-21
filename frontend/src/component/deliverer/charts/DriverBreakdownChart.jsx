import React, { useEffect } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { ResponsivePie } from "@nivo/pie";
import { useDispatch, useSelector } from "react-redux";
import { getAllOverallStatsDeliverer } from "redux/actions/overallStats";
import { getAllContractorsPage } from "redux/actions/contractor";
import { getDriverStats } from "redux/actions/driverStats";
import { useParams } from "react-router-dom";

const DriverBreakdownChart = ({ isDashboard = false }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { driverId } = useParams();
  const { driverStats, isDriverStatsLoading } = useSelector(
    (state) => state.driverStats
  );

  console.log(driverStats)
  useEffect(() => {
    dispatch(getDriverStats(driverId));
    dispatch(getAllContractorsPage());
  }, [dispatch]);
  let formattedData;
  

  if (!driverStats || isDriverStatsLoading) return "Loading...";

  if (!isDriverStatsLoading && driverStats && driverStats.jobsByContractor) {
    const colors = [
      theme.palette.secondary[200],
      theme.palette.secondary[400],
      theme.palette.secondary[300],
      theme.palette.secondary[800],
    ];

    formattedData = Object.entries(driverStats.jobsByContractor).map(
      ([contractor, jobs], i) => ({
        id: contractor,
        label: contractor,
        value: jobs,
        color: colors[i],
      })
    );
  }
  console.log(formattedData)

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
            ? { top: 40, right: 80, bottom: 100, left: 50 }
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
        legends={[
          {
            anchor: "bottom",
            direction: "row",
            justify: false,
            translateX: isDashboard ? 20 : 0,
            translateY: isDashboard ? 50 : 56,
            itemsSpacing: 15,
            itemWidth: 85,
            itemHeight: 18,
            itemTextColor: "#000",
            itemDirection: "left-to-right",
            itemOpacity: 1,
            symbolSize: 12,
            symbolShape: "circle",
            effects: [
              {
                on: "hover",
                style: {
                  itemTextColor: theme.palette.primary[500],
                },
              },
            ],
          },
        ]}
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
        <Typography variant="h6">{driverStats.yearlyJobs} jobs</Typography>
      </Box>
    </Box>
  );
};

export default DriverBreakdownChart;
