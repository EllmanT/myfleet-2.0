import React, { useEffect, useMemo, useState } from "react";
import { Box, useTheme } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { getAllOverallStatsDeliverer } from "redux/actions/overallStats";
import { ResponsiveLine } from "@nivo/line";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import DateProvider from "../DateProvider";
import { getContractorStats } from "redux/actions/contractorStats";

const ContractorDailyLineChart = ({
  isDashboard = false,
  view,
  isDisabled,
  contractorId,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { contractorStats, isContractorStatsLoading } = useSelector(
    (state) => state.contractorStats
  );
  useEffect(() => {
    dispatch(getContractorStats(contractorId));
  }, [dispatch, contractorId]);

  const currentDate = new Date();
  const starttDate = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [startDate, setStartDate] = useState(starttDate);
  const [endDate, setEndDate] = useState(currentDate);

  const [formattedData] = useMemo(() => {
    if (!contractorStats) return []; // Add a check for contractorStats

    const { dailyData } = contractorStats;
    const totalJobsLine = {
      id: "totalJobs",
      color: theme.palette.secondary.main,
      data: [],
    };
    const totalRevenueLine = {
      id: "totalRevenue",
      color: theme.palette.secondary[600],
      data: [],
    };

    Object.values(dailyData).forEach(({ date, totalJobs, totalRevenue }) => {
      const dateFormatted = new Date(date);
      if (dateFormatted >= startDate && dateFormatted <= endDate) {
        const splitDate = dateFormatted.toLocaleDateString(undefined, {
          day: "2-digit",
          month: "2-digit",
        });
        // Format the splitDate as "dd-mm"
        totalJobsLine.data = [
          ...totalJobsLine.data,
          { x: splitDate, y: totalJobs },
        ];
        totalRevenueLine.data = [
          ...totalRevenueLine.data,
          { x: splitDate, y: totalRevenue },
        ];
      }
    });

    const formattedData = [totalJobsLine, totalRevenueLine];
    return [formattedData];
  }, [contractorStats, startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Box 
          height={isDashboard ? "400px" : "75vh"}
          minHeight={isDashboard ? "325px" : undefined}
          minWidth={isDashboard ? "500px" : undefined}//might affect responsicenes
          position="relative"
    
      >
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

        {contractorStats ? (
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
                anchor: "top-right",
                direction: "column",
                justify: false,
                translateX: 50,
                translateY: 20,
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

export default ContractorDailyLineChart;
