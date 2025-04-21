import React, { useEffect, useMemo } from "react";
import { useTheme } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { getAllOverallStatsDeliverer } from "redux/actions/overallStats";
import { ResponsiveLine } from "@nivo/line";
const RevenueOverviewChart = ({ isDashboard = false, view }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { coOverallStats, isCoOverallStatsLoading } = useSelector(
    (state) => state.overallStats
  );

  useEffect(() => {
    dispatch(getAllOverallStatsDeliverer());
  }, [dispatch]);

  const [formattedData] = useMemo(() => {
    if (!coOverallStats) return []; // Add a check for coOverallStats

    const { monthlyData } = coOverallStats;
    const totalRevenueLine = {
      id: "totalRevenue",
      color: theme.palette.secondary.main,
      data: [],
    };
    const totalExpensesLine = {
      id: "totalExpenses",
      color: theme.palette.secondary[600],
      data: [],
    };

    Object.values(monthlyData).forEach(
      ({ month, totalRevenue, totalExpenses }) => {
        var shortMonth = new Date(
          Date.parse(month + " 1, 2000")
        ).toLocaleString("default", { month: "short" });
        // Format the splitDate as "dd-mm"
        totalRevenueLine.data = [
          ...totalRevenueLine.data,
          { x: shortMonth, y: totalRevenue },
        ];
        totalExpensesLine.data = [
          ...totalExpensesLine.data,
          { x: shortMonth, y: totalExpenses },
        ];
      }
    );

    const formattedData = [totalExpensesLine, totalRevenueLine];
    return [formattedData];
  }, [coOverallStats]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!coOverallStats || isCoOverallStatsLoading) return "Loading...";

  return (
    <ResponsiveLine
      data={formattedData}
      margin={{ top: 20, right: 110, bottom: 50, left: 60 }}
      xScale={{ type: "point" }}
      yScale={{
        type: "linear",
        min: "0",
        max: "auto",
        stacked: true,
        reverse: false,
      }}
      yFormat=" >-.2f"
      axisTop={null}
      axisRight={null}
      axisBottom={{
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        legend: " ",
        legendOffset: 30,
        legendPosition: "middle",
      }}
      axisLeft={{
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        legend: "Total Amounts",
        legendOffset: -50,
        legendPosition: "middle",
      }}
      pointSize={10}
      pointColor={{ theme: "background" }}
      pointBorderWidth={2}
      pointBorderColor={{ from: "serieColor" }}
      pointLabelYOffset={-12}
      useMesh={true}
      legends={[
        {
          anchor: "bottom-right",
          direction: "column",
          justify: false,
          translateX: 100,
          translateY: 0,
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
      ]}
    />
  );
};

export default RevenueOverviewChart;
