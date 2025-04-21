import {
  AddTask,
  AnalyticsOutlined,
  DownloadOutlined,
  Email,
  Groups,
  MonetizationOn,
  Print,
  ReceiptLongOutlined,
  RemoveRedEyeOutlined,
  TrendingDownOutlined,
  TrendingUpOutlined,
} from "@mui/icons-material";
import {
  Box,
  Button,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import BreakdownChart from "component/deliverer/BreakdownChart";
import FlexBetween from "component/deliverer/FlexBetween";
import Header from "component/deliverer/Header";
import OverviewChart from "component/deliverer/OverviewChart";
import StatBox from "component/deliverer/Statbox";
import JobsBarChart from "component/deliverer/charts/JobsBarChart";
import JobsDailyLineChart from "component/deliverer/charts/JobsDailyLineChart";
import VehSingleLineChart from "component/deliverer/charts/VehSingleLineChart";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { getAllContractorsPage } from "redux/actions/contractor";
import { getAllDeliverersPage } from "redux/actions/deliverer";
import {
  getLatestJobsContractor,
  getLatestJobsDeliverer,
  getLatestJobsPage,
  getLatestJobsVehicle,
} from "redux/actions/job";
import { getAllOverallStatsDeliverer } from "redux/actions/overallStats";
import { loadUser } from "redux/actions/user";
import { getAllVehiclesPage } from "redux/actions/vehicle";
import { getVehicleStats } from "redux/actions/vehicleStats";
import html2pdf from "html2pdf.js";
import VehicleBreakdownChart from "component/deliverer/charts/VehicleBreakdownChart";
import VehicleDailyLineChart from "component/deliverer/charts/VehicleDailyLineChart";
import VehicleBarChart from "component/deliverer/charts/VehicleBarChart";
import { getContractorStats } from "redux/actions/contractorStats";
import ContrSingleLineChart from "component/deliverer/charts/ContrSingleLineChart";
import ContractorDailyLineChart from "component/deliverer/charts/ContrDailyLineChart";
import ContrBarChart from "component/deliverer/charts/ContrBarChart";

const DashContrAnalytics = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { contractorId } = useParams();

  console.log(contractorId);

  const [selectedOptionSLC, setSelectedOptionSLC] = useState("jobs");
  const [selectedOptionBC, setSelectedOptionBC] = useState("revenue");
  const [selectedOptionMLC, setSelectedOptionMLC] = useState("");
  const [selectedOptionPC, setSelectedOptionPC] = useState("");

  const isNonMediumScreens = useMediaQuery("(min-width: 1200px)");
  const { contractorStats, isContractorStatsLoading } = useSelector(
    (state) => state.overallStats
  );
  const { latestJobsDeliverer, latestJobsDelivererLoading } = useSelector(
    (state) => state.jobs
  );
  const { pageContractors, isPageContrLoading } = useSelector(
    (state) => state.contractors
  );
  let contractor;
  contractor =
    pageContractors && pageContractors.find((c) => c._id === contractorId);
console.log(contractor)
  useEffect(() => {
    dispatch(getContractorStats(contractorId));
    dispatch(getLatestJobsContractor(contractorId));
    dispatch(getAllContractorsPage());
    dispatch(loadUser());
  }, [dispatch]);

  let highestRevenue = 0;
  let topContractorRevenue = "";
  let topContractorJobs = "";
  let mostJobs = 0;

  if (
    !isContractorStatsLoading &&
    contractorStats &&
    contractorStats.jobsByContractor &&
    contractorStats.revenueByContractor
  ) {
    const jobsByContractor = contractorStats.jobsByContractor;
    const revenueByContractor = contractorStats.revenueByContractor;
    //getting the contractor that gives most jobs
    for (const contractorId in jobsByContractor) {
      if (jobsByContractor.hasOwnProperty(contractorId)) {
        const job = jobsByContractor[contractorId];

        if (job > mostJobs) {
          mostJobs = job;
          topContractorJobs = contractorId;
        }
      }
    }
    //getting the contractor that gives most revenue
    for (const contractorId in revenueByContractor) {
      if (revenueByContractor.hasOwnProperty(contractorId)) {
        const revenue = revenueByContractor[contractorId];

        if (revenue > highestRevenue) {
          highestRevenue = revenue;
          topContractorRevenue = contractorId;
        }
      }
    }
  }

  //getting the %increase in sales for the
  let percentage = "";
  let latestMonth = "";
  let secondLatestMonth = "";
  let isPercentage = false;
  let latestMonthJobs = 0;

  if (contractorStats && contractorStats.monthlyData) {
    let numberofMonths = 0;
    let findSecondLatestMonth = 0;
    let secondLatestMonthJobs = 0;
    let findThirdLatestMonth = 0;
    let thirdLatestMonth = "";
    let thirdLatestMonthJobs = 0;
    let findLatestMonth = 0;
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleString("default", {
      month: "long",
    }); // Get month name

    const jobsMonthlyData = contractorStats && contractorStats.monthlyData;
    findLatestMonth = jobsMonthlyData.length - 1;
    latestMonth = jobsMonthlyData[findLatestMonth].month;
    const latestMonthData = jobsMonthlyData.find(
      (job) => job.month === latestMonth
    );
    latestMonthJobs = latestMonthData.totalJobs;

    //we are using this logic because we are saying
    //lets assume that there are 3 months.
    //the last month indicates to us that information for month 2 has been completed assumption
    numberofMonths = jobsMonthlyData.length;

    if (numberofMonths >= 3) {
      isPercentage = true;
    } else {
      isPercentage = false;
    }

    if (isPercentage === true) {
      findSecondLatestMonth = findLatestMonth - 1;
      secondLatestMonth = jobsMonthlyData[findSecondLatestMonth].month;
      const secondLatestMonthData = jobsMonthlyData.find(
        (job) => job.month === secondLatestMonth
      );
      secondLatestMonthJobs = secondLatestMonthData.totalJobs;

      findThirdLatestMonth = findLatestMonth - 2;
      thirdLatestMonth = jobsMonthlyData[findThirdLatestMonth].month;
      const thirdLatestMonthData = jobsMonthlyData.find(
        (job) => job.month === thirdLatestMonth
      );
      thirdLatestMonthJobs = thirdLatestMonthData.totalJobs;

      const change = secondLatestMonthJobs - thirdLatestMonthJobs;
      percentage = (change / thirdLatestMonthJobs) * 100;

      console.log(change);

      if (percentage > 0) {
        percentage = "+" + percentage;
      } else {
        percentage = "-" + percentage;
      }
    }
  }

  //getting the total number of contractors

  const columns = [
    {
      field: "from",
      headerName: "From",
      flex: 2,
      valueGetter: (params) => params.row.from.name,
    },
    {
      field: "customer",
      headerName: "To",
      flex: 2,
      valueGetter: (params) => params.row.customer.name,
    },

    {
      field: "cost",
      headerName: "cost",
      flex: 0.5,
      sortable: false,
      //renderCell: (params) => params.value.length,
    },
    {
      field: "orderDate",
      headerName: "Order Date",
      flex: 2,
      valueFormatter: (params) => {
        const date = new Date(params.value);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      },
    },
  ];
  const addOrder = () => {
    navigate("/add-job");
  };

  const handlePrintSLC = () => {};
  const handlePrintBC = () => {};
  const handlePrintMLC = () => {};
  const handlePrintPC = () => {};

  const handleDownloadSLC = (companyName) => {
    const element = document.getElementById("print-content-slc");
    html2pdf().from(element).save(`${companyName}_Overview_LineChart.pdf`);
  };
  const handleDownloadBC = (companyName) => {
    const element = document.getElementById("print-content-bc");
    html2pdf().from(element).save(`${companyName}_Overview_Barchart.pdf`);
  };

  const handleDownloadPC = (companyName) => {
    const element = document.getElementById("print-content-pc");
    html2pdf().from(element).save(`${companyName}_Overview_Piechart.pdf`);
  };

  const handleDownloadMLC = (companyName) => {
    const element = document.getElementById("print-content-mlc");
    html2pdf().from(element).save(`${companyName}_Overview_Multilinechart.pdf`);
  };

  const handleViewMLC = (vehicleId) => {
    navigate(`/contractor-analytics/daily-data/${vehicleId}`);
  };

  return (
    <Box m="1.5rem 2.5rem">
      <FlexBetween>
        <Header title={contractor && contractor.companyName} />
        <Box>
          <Button
            variant="outlined"
            color="info"
            sx={{
              m: "1rem",
              fontSize: "14px",
              fontWeight: "bold",
              padding: "10px 20px",
              ":hover": {
                //   backgroundColor: theme.palette.secondary[100],
              },
            }}
          >
            <DownloadOutlined sx={{ mr: "10px" }} />
            All
          </Button>
        </Box>
        <Box>
          <Button
            onClick={addOrder}
            variant="outlined"
            color="success"
            sx={{
              fontSize: "14px",
              fontWeight: "bold",
              padding: "10px 20px",
              ":hover": {
                // backgroundColor: theme.palette.secondary[300],
              },
            }}
          >
            <TrendingUpOutlined sx={{ mr: "10px" }} />+ job
          </Button>
        </Box>
      </FlexBetween>

      <Box
        mt="20px"
        display="grid"
        gridTemplateColumns="repeat(12, 1fr)"
        gridAutoRows="160px"
        gap="20px"
        sx={{
          "& > div": { gridColumn: isNonMediumScreens ? undefined : "span 12" },
        }}
      >
        {/* ROW 1 */}

        <Box
          id="print-content-bc"
          display={"flex"}
          flexDirection={"column"}
          alignItems={"center"}
          gridColumn="span 6"
          gridRow="span 2"
          backgroundColor={theme.palette.background.alt}
          p="1rem"
          borderRadius="0.55rem"
        >
          <Box display={"flex"}>
            <Typography variant="h5" fontWeight={"bold"}>
              Breakdown of {selectedOptionBC}
            </Typography>
            <FormControl sx={{ ml: "3rem" }}>
              <Select
                value={selectedOptionBC}
                onChange={(e) => setSelectedOptionBC(e.target.value)}
                color="info"
                size="small"
                defaultValue="jobs"
                inputProps={{ "aria-label": "Select an option" }}
              >
                <MenuItem value="revenue" selected>
                  Revenue
                </MenuItem>
                <MenuItem value="jobs">Jobs</MenuItem>
              </Select>
            </FormControl>

            <IconButton
              sx={{ ml: "0.5rem" }}
              onClick={() => handleDownloadBC(contractor.companyName)}
            >
              <DownloadOutlined />
            </IconButton>
          </Box>
          <ContrBarChart
            contractorId={contractorId}
            view={selectedOptionBC}
            isDashboard={true}
          />
        </Box>
        <Box
          id="print-content-slc"
          display="flex"
          position={"relative"}
          flexDirection="column"
          alignItems="center"
          gridColumn="span 6"
          gridRow="span 2"
          backgroundColor={theme.palette.background.alt}
          p="1rem"
          borderRadius="0.55rem"
        >
          <Box display={"flex"}>
            <Typography variant="h5" fontWeight={"bold"}>
              Analysis of the {selectedOptionSLC}
            </Typography>
            <FormControl sx={{ ml: "6rem" }}>
              <Select
                value={selectedOptionSLC}
                onChange={(e) => setSelectedOptionSLC(e.target.value)}
                color="info"
                size="small"
                defaultValue="jobs"
                inputProps={{ "aria-label": "Select an option" }}
              >
                <MenuItem value="mileage">Mileage</MenuItem>
                <MenuItem value="jobs">Jobs</MenuItem>
              </Select>
            </FormControl>
            <IconButton
              sx={{ ml: "0.5rem" }}
              onClick={() => handleDownloadSLC(contractor.companyName)}
            >
              <DownloadOutlined />
            </IconButton>
          </Box>
          <ContrSingleLineChart
            contractorId={contractorId}
            view={selectedOptionSLC}
            isDashboard={true}
          />
        </Box>

        {/* ROW 2 */}
        <Box
          id="print-content-mlc"
          alignItems="center"
          display="flex"
          flexDirection="column"
          gridColumn="span 6"
          gridRow="span 3"
          backgroundColor={theme.palette.background.alt}
          p="1.5rem"
          borderRadius="0.55rem"
        >
          <Box display={"flex"}>
            <Typography variant="h6" fontWeight="bold">
              Daily Data (last 30 days) 
            </Typography>
            <IconButton
              sx={{ ml: "8rem" }}
              onClick={() => handleViewMLC(contractorId)}
            >
              <RemoveRedEyeOutlined />
            </IconButton>
            <IconButton
              sx={{ ml: "0.1rem" }}
              onClick={() => handleDownloadMLC(contractor.companyName)}
            >
              <DownloadOutlined />
            </IconButton>
          </Box>

          <ContractorDailyLineChart
            contractorId={contractorId}
            isDashboard={true}
            view="jobs"
            isDisabled={true}
          />
        </Box>

        <Box
          id="print-content-pc"
          alignItems="center"
          display="flex"
          flexDirection="column"
          gridColumn="span 6"
          gridRow="span 3"
          backgroundColor={theme.palette.background.alt}
          p="1.5rem"
          borderRadius="0.55rem"
        >
          <Box display={"flex"}>
            <Typography variant="h6" fontWeight="bold">
              Jobs By Contractor
            </Typography>
            <IconButton
              sx={{ ml: "12rem" }}
              onClick={() => handleDownloadPC(contractor.companyName)}
            >
              <DownloadOutlined />
            </IconButton>
          </Box>

          <Typography
            p="0 0.6rem"
            fontSize="0.8rem"
            sx={{ color: theme.palette.secondary[200] }}
          >
            Breakdown of all time jobs for the year
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default DashContrAnalytics;
