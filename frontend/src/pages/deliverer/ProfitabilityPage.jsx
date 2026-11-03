import React, { useEffect, useState } from "react";
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from "@mui/material";
import { toast } from "react-hot-toast";
import FlexBetween from "component/deliverer/FlexBetween";
import Header from "component/deliverer/Header";
import StatBox from "component/deliverer/Statbox";
import { CATEGORY_LABELS, MONTHS, apiMessage, fetchProfitability, money } from "utils/expenseApi";

const EXPENSE_ORDER = ["fuel", "driver_salary", "owner_salary", "family_salary", "insurance", "service", "other"];

const ProfitabilityPage = () => {
  const theme = useTheme();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchProfitability(year)
      .then(setData)
      .catch((e) => toast.error(apiMessage(e)))
      .finally(() => setLoading(false));
  }, [year]);

  const profitColor = (n) => (n < 0 ? theme.palette.error?.main || "#d32f2f" : theme.palette.success?.main || "#2e7d32");
  const t = data?.totals;
  const cell = (n) => <TableCell align="right">{money(n)}</TableCell>;
  const profitCell = (n) => (
    <TableCell align="right" sx={{ color: profitColor(n), fontWeight: "bold" }}>{money(n)}</TableCell>
  );

  const Row = ({ label, o, bold }) => (
    <TableRow sx={bold ? { "& td": { fontWeight: "bold" } } : undefined}>
      <TableCell>{label}</TableCell>
      {cell(o.jobRevenue)}
      {cell(o.otherIncome)}
      {EXPENSE_ORDER.map((c) => <React.Fragment key={c}>{cell(o.expenses[c] || 0)}</React.Fragment>)}
      {cell(o.totalExpenses)}
      {profitCell(o.profit)}
      {cell(o.cashProfit)}
      {cell(o.privateFuel)}
    </TableRow>
  );

  const head = (
    <TableHead>
      <TableRow>
        <TableCell sx={{ fontWeight: "bold" }}>&nbsp;</TableCell>
        {["Job revenue", "Cash hires / other income", ...EXPENSE_ORDER.map((c) => CATEGORY_LABELS[c]), "Total costs", "Profit", "Cash profit*", "Private fuel (info)"].map((h) => (
          <TableCell key={h} align="right" sx={{ fontWeight: "bold", whiteSpace: "nowrap" }}>{h}</TableCell>
        ))}
      </TableRow>
    </TableHead>
  );

  return (
    <Box m={{ xs: "1rem 0.75rem", sm: "1.25rem 1.5rem", md: "1.5rem 2.5rem" }}>
      <FlexBetween>
        <Header title="PROFITABILITY" subtitle="Revenue minus fuel, salaries and other costs, by month and by vehicle." />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Year</InputLabel>
          <Select label="Year" value={year} onChange={(e) => setYear(e.target.value)}>
            {[2026, 2025].map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
        </FormControl>
      </FlexBetween>

      {!data ? (
        <Typography mt="2rem">{loading ? "Loading..." : "No data."}</Typography>
      ) : (
        <>
          <Box mt="1.5rem" display="grid" gridTemplateColumns="repeat(4, 1fr)" gap="1rem"
            sx={{ "& > div": { gridColumn: "span 1" }, "@media (max-width:900px)": { gridTemplateColumns: "repeat(2, 1fr)" } }}>
            <StatBox title="Revenue" value={money(t.revenue)} description={`${t.jobs} legs, ${Math.round(t.km).toLocaleString()} km`} />
            <StatBox title="Costs" value={money(t.totalExpenses)} description="Fuel, salaries, other" />
            <StatBox title="Profit" value={<span style={{ color: profitColor(t.profit) }}>{money(t.profit)}</span>} description="Revenue minus costs" />
            <StatBox title="Cash profit*" value={money(t.cashProfit)} description={`incl. ${money(t.retained)} left in business`} />
          </Box>

          <Typography mt="1.5rem" variant="h5" color={theme.palette.secondary[100]}>By month</Typography>
          <Box mt="0.5rem" sx={{ overflowX: "auto", backgroundColor: theme.palette.background.alt, borderRadius: "0.55rem" }}>
            <Table size="small">
              {head}
              <TableBody>
                {data.months.map((m) => <Row key={m.month} label={MONTHS[m.month - 1]} o={m} />)}
                <Row label="Total" o={t} bold />
              </TableBody>
            </Table>
          </Box>

          <Typography mt="1.5rem" variant="h5" color={theme.palette.secondary[100]}>By vehicle</Typography>
          <Box mt="0.5rem" sx={{ overflowX: "auto", backgroundColor: theme.palette.background.alt, borderRadius: "0.55rem" }}>
            <Table size="small">
              {head}
              <TableBody>
                {data.vehicles.map((v) => <Row key={v.vehicle} label={v.vehicle} o={v} />)}
                <Row label="Shared costs (not tied to a vehicle)" o={data.overhead} />
              </TableBody>
            </Table>
          </Box>

          <Typography mt="1rem" variant="body2" color={theme.palette.secondary[300]}>
            *Cash profit adds back salary that is left in the business (it is still a cost, but no cash leaves).
            Private fuel is shown for information only and is never part of costs or profit.
            Fuel marked "estimated" comes from kilometres driven; replace it with real receipts on the Expenses page when you have them.
            Insurance and service stay at $0 until you enter them.
          </Typography>
        </>
      )}
    </Box>
  );
};

export default ProfitabilityPage;
