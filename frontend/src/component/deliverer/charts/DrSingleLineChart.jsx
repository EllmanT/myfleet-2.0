import React, { useEffect, useMemo } from "react";
import { useTheme } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { getAllOverallStatsDeliverer } from "redux/actions/overallStats";
import { ResponsiveLine } from "@nivo/line";
import { getDriverStats } from "redux/actions/driverStats";
const DrSingleLineChart = ({ isDashboard = false, view , driverId }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { driverStats, isDriverStatsLoading } = useSelector(
    (state) => state.driverStats
  );


  useEffect(() => {
    dispatch(getDriverStats(driverId));
  },[dispatch]);

  const [totalJobsLine, totalMileageLine] = useMemo(() => {
    if (!driverStats) return [];

    const { monthlyData } = driverStats;
    const totalJobsLine = {
      id: "totalJobs",
      color: theme.palette.secondary.main,
      data: [],
    };
    const totalMileageLine = {
      id: "totalMileage",
      color: theme.palette.secondary[600],
      data: [],
    };

    Object.values(monthlyData).reduce(
      (acc, { month, totalJobs, totalMileage }) => {
        const curJobs =  totalJobs;
        const curMileage =  totalMileage;

        totalJobsLine.data = [
          ...totalJobsLine.data,
          { x: month, y: curJobs },
        ];
        totalMileageLine.data = [
          ...totalMileageLine.data,
          { x: month, y: curMileage },
        ];

        return { jobs: curJobs, mileage: curMileage };
      },
      { jobs: 0, mileage: 0 }
    );

    return [[totalJobsLine], [totalMileageLine]];
  }, [driverStats]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!driverStats || isDriverStatsLoading) return "Loading...";

  return (
    <ResponsiveLine
      data={view === "jobs" ? totalJobsLine : totalMileageLine}
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
            color: theme.palette.primary[100],
          },
        },
      }}
      margin={{ top: 20, right: 50, bottom: 50, left: 70 }}
      xScale={{ type: "point" }}
      yScale={{
        type: "linear",
        min: "0",
        max: "auto",
        stacked: false,
        reverse: false,
      }}
      yFormat=" >-.2f"
      curve="catmullRom"
     // enableArea={isDashboard}
      axisTop={null}
      axisRight={null}
      axisBottom={{
        format: (v) => {
          if (isDashboard) return v.slice(0, 3);
          return v;
        },
        orient: "bottom",
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        legend: isDashboard ? "" : "Month",
        legendOffset: 36,
        legendPosition: "middle",
      }}
      axisLeft={{
        orient: "left",
        tickValues: 5,
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        legend: !isDashboard
          ? ""
          : `Total ${view === "jobs" ? "Jobs" : "Mileage"} for the Year`,
        legendOffset: -60,
        legendPosition: "middle",
      }}
      enableGridX={false}
      enableGridY={false}
      pointSize={10}
      pointColor={{ theme: "background" }}
      pointBorderWidth={2}
      pointBorderColor={{ from: "serieColor" }}
      pointLabelYOffset={-12}
      useMesh={true}
      legends={
        !isDashboard
          ? [
              {
                anchor: "bottom-right",
                direction: "column",
                justify: false,
                translateX: 30,
                translateY: -40,
                itemsSpacing: 0,
                itemDirection: "left-to-right",
                itemWidth: 80,
                itemHeight: 20,
                itemOpacity: 0.75,
                symbolSize: 12,
                symbolShape: "circle",
                symbolBorderColor: "rgba(0, 0, 0, .5)",
                effects: [
                  {
                    on: "hover",
                    style: {
                      itemBackground: "rgba(0, 0, 0, .03)",
                      itemOpacity: 1,
                    },
                  },
                ],
              },
            ]
          : undefined
      }
    />
  
  );
};

export default DrSingleLineChart;
