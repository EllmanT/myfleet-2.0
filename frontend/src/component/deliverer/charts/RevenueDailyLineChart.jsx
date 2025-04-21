import React, { useEffect, useMemo, useState } from "react";
import { Box, useTheme } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { getAllOverallStatsDeliverer } from "redux/actions/overallStats";
import { ResponsiveLine } from "@nivo/line";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import DateProvider from "../DateProvider";
import { getDriverStats } from "redux/actions/driverStats";

const RevenueDailyLineChart = ({
  isDashboard = false,
  view,
  isDisabled,
  companyId,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { coOverallStats, isCoOverallStatsLoading } = useSelector(
    (state) => state.overallStats
  );
  useEffect(() => {
    dispatch(getAllOverallStatsDeliverer());
  }, [dispatch]);

  const currentDate = new Date();
  const starttDate = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [startDate, setStartDate] = useState(starttDate);
  const [endDate, setEndDate] = useState(currentDate);

  const [formattedData] = useMemo(() => {
    if (!coOverallStats) return []; // Add a check for driverStats

    const { dailyData } = coOverallStats;
    const totalRevenueLine = {
      id: "totalRevenue",
      color: theme.palette.secondary.main,
      data: [],
    };
    const totalMileageLine = {
      id: "totalMileage",
      color: theme.palette.secondary[600],
      data: [],
    };

    Object.values(dailyData).forEach(({ date, totalRevenue, totalMileage }) => {
      const dateFormatted = new Date(date);
      if (dateFormatted >= startDate && dateFormatted <= endDate) {
        const splitDate = dateFormatted.toLocaleDateString(undefined, {
          day: "2-digit",
          month: "2-digit",
        });
        // Format the splitDate as "dd-mm"
        totalMileageLine.data = [
          ...totalMileageLine.data,
          { x: splitDate, y: totalMileage },
        ];
        totalRevenueLine.data = [
          ...totalRevenueLine.data,
          { x: splitDate, y: totalRevenue },
        ];
      }
    });

    const formattedData = [totalMileageLine, totalRevenueLine];
    return [formattedData];
  }, [coOverallStats, startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Box height="75vh">
        <Box display="flex" justifyContent="flex-end">
          <Box>
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              disabled={isDisabled}
            />
          </Box>
          <Box>
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={startDate}
              disabled={isDisabled}
            />
          </Box>
        </Box>

        {coOverallStats ? (
          <ResponsiveLine
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
                container: {},
              },
            }}
            colors={{ datum: "color" }}
            margin={{ top: 50, right: 50, bottom: 70, left: 60 }}
            xScale={{ type: "point" }}
            yScale={{
              type: "linear",
              min: "auto",
              max: "auto",
              stacked: false,
              reverse: false,
            }}
            yFormat=" >-.2f"
            curve="catmullRom"
            axisTop={null}
            axisRight={null}
            axisBottom={{
              orient: "bottom",
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 90,
              legend: "Month",
              legendOffset: 60,
              legendPosition: "middle",
            }}
            axisLeft={{
              orient: "left",
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: "Total",
              legendOffset: -50,
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
            legends={[
              {
                anchor: "top-left",
                direction: "column",
                justify: false,
                translateX: 30,
                translateY: 10,
                itemsSpacing: 0,
                itemDirection: "left-to-right",
                itemWidth: 80,
                itemHeight: 20,
                itemOpacity: 0.7,
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
        ) : (
          <>Loading...</>
        )}
      </Box>
    </>
  );
};

export default RevenueDailyLineChart;
