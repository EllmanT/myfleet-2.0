import React, { useEffect } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { ResponsivePie } from "@nivo/pie";
import { useDispatch, useSelector } from "react-redux";
import { getAllContractorsPage } from "redux/actions/contractor";
import { getDriverStats } from "redux/actions/driverStats";
import { useParams } from "react-router-dom";
import { chartColors, pieProps, pieLegendText } from "./chartColors";

const truncate = (s, n = 12) => {
  const str = String(s ?? "");
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
};

const DriverBreakdownChart = ({ isDashboard = false }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { driverId } = useParams();
  const { driverStats, isDriverStatsLoading } = useSelector((state) => state.driverStats);
  const { selectedYear } = useSelector((state) => state.filters);

  useEffect(() => {
    dispatch(getDriverStats(driverId, selectedYear));
    dispatch(getAllContractorsPage());
  }, [dispatch, driverId, selectedYear]);

  if (!driverStats || isDriverStatsLoading) return <Typography color="text.secondary">Loading...</Typography>;

  const entries = Object.entries(driverStats.jobsByContractor || {}).filter(([, v]) => Number(v) > 0);
  const palette = chartColors(theme, entries.length);
  const data = entries.map(([contractor, value], i) => ({
    id: contractor,
    label: contractor,
    value: Number(value),
    color: palette[i],
  }));

  if (data.length === 0) {
    return (
      <Box height={isDashboard ? "400px" : "100%"} minHeight={isDashboard ? "325px" : undefined} display="flex" alignItems="center" justifyContent="center">
        <Typography color="text.secondary">No data for this period</Typography>
      </Box>
    );
  }

  const margin = isDashboard
    ? { top: 30, right: 60, bottom: 20, left: 50 }
    : { top: 40, right: 90, bottom: 20, left: 90 };
  const legendColor = pieLegendText(theme);
  // link labels collide with many slices, the legend below covers those cases
  const showLinks = !isDashboard && data.length <= 8;

  return (
    <Box
      height={isDashboard ? "400px" : "100%"}
      width={undefined}
      minHeight={isDashboard ? "325px" : undefined}
      minWidth={isDashboard ? "325px" : undefined}
      display="flex"
      flexDirection="column"
    >
      <Box position="relative" flex="1 1 0" minHeight={0}>
        <ResponsivePie
          data={data}
          {...pieProps(theme)}
          margin={margin}
          innerRadius={0.55}
          enableArcLinkLabels={showLinks}
          arcLinkLabel={(d) => truncate(d.label)}
          arcLinkLabelsSkipAngle={12}
          legends={[]}
        />
        {/* centre label: same box as the plot area so it sits in the donut hole */}
        <Box
          position="absolute"
          top={margin.top}
          right={margin.right}
          bottom={margin.bottom}
          left={margin.left}
          display="flex"
          alignItems="center"
          justifyContent="center"
          textAlign="center"
          sx={{ pointerEvents: "none" }}
        >
          <Typography variant="h6" color="text.primary">
            {driverStats.yearlyJobs ?? 0} jobs
          </Typography>
        </Box>
      </Box>
      {/* wrapping legend: never clips or overlaps, however many contractors */}
      <Box
        display="flex"
        flexWrap="wrap"
        justifyContent="center"
        gap="6px 16px"
        px={1}
        pb={1}
        maxHeight={96}
        sx={{ overflowY: "auto" }}
      >
        {data.map((d) => (
          <Box key={d.id} display="flex" alignItems="center" gap="6px" maxWidth="100%" title={`${d.label}: ${d.value}`}>
            <Box
              sx={{ width: 12, height: 12, borderRadius: "50%", flexShrink: 0, backgroundColor: d.color }}
            />
            <Typography
              variant="caption"
              noWrap
              sx={{ color: legendColor, maxWidth: 140, fontSize: 12 }}
            >
              {d.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default DriverBreakdownChart;
