import React from 'react'
import { getAllOverallStatsDeliverer } from 'redux/actions/overallStats';



const JobsMultiLineChart = ({ isDashboard = false, view  }) => {
    const theme = useTheme();
    const dispatch = useDispatch();
    const { coOverallStats, isCoOverallStatsLoading } = useSelector(
      (state) => state.overallStats
    );
  
  
    useEffect(() => {
      dispatch(getAllOverallStatsDeliverer());
    },[dispatch]);
  
    const [totalJobsLine, totalMileageLine] = useMemo(() => {
      if (!coOverallStats) return [];
  
      const { monthlyData } = coOverallStats;
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
    }, [coOverallStats]); // eslint-disable-line react-hooks/exhaustive-deps
  
    if (!coOverallStats || isCoOverallStatsLoading) return "Loading...";

  return (
    <>
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
                container: {
                  color: theme.palette.primary.main,
                },
              },
            }}
            colors={{ datum: "color" }}
            margin={{ top: 50, right: 50, bottom: 70, left: 60 }}
            xScale={{ type: "point" }}
            yScale={{
              type: "linear",
              min: "0",
              max: "auto",
              stacked: false,
              reverse: false,
            }}
            yFormat=" >-.2f"
            // curve="catmullRom"
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
        ) : (
          <>Loading...</>
        )}
    </>
  )
}

export default JobsMultiLineChart