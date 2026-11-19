import React, { useEffect } from "react";
import { Box, useTheme } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { ResponsiveBar } from "@nivo/bar";
import { chartColors, nivoTheme } from "./chartColors";

const RevenueBarChart = ({ isDashboard = false, view }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { coOverallStats, isCoOverallStatsLoading } = useSelector(
    (state) => state.overallStats
  );

  useEffect(() => {
    // dispatch(getAllOverallStatsDeliverer());
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
      minWidth={isDashboard ? "325px" : undefined}
      position="relative"
    >
      <ResponsiveBar
        data={monthlyData}
        keys={
          isDashboard === true
            ? view === "totalRevenue"
              ? ["totalRevenue"]
              : ["totalExpenses"]
            : ["totalRevenue", "totalExpenses", "totalProfit"]
        }
        indexBy="month"
        groupMode="grouped"
        margin={{ top: 50, right: 0, bottom: 50, left: 60 }}
        padding={0.4}
        valueScale={{ type: "linear" }}
        theme={nivoTheme(theme)}
        colors={chartColors(theme, 3)}
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
          legend: `Total ${
            view === "revenue" ? "Amount" : "Jobs"
          } for the year`,
          legendPosition: "middle",
          legendOffset: -50,
        }}
        axisBottom={{
          format: (v) => {
             return v.slice(0, 3);
           
            
          },//dea
          tickRotation: 90,
          tickSize: 5,
          tickPadding: 5,
  
  
         }}
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
            
            itemOpacity: 1,
            symbolSize: 12,
            symbolShape: "circle",
            symbolBorderColor: "transparent",
            effects: [
              {
                on: "hover",
                style: {
                  itemBackground: theme.palette.action.hover,
                  itemOpacity: 1,
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
      ></Box>
    </Box>
  );
};

export default RevenueBarChart;
