import {
  AddTask,
  AnalyticsOutlined,
  DownloadOutlined,
  Email,
  Groups,
  MonetizationOn,
  ReceiptLongOutlined,
  TrendingDownOutlined,
  TrendingUpOutlined,
} from "@mui/icons-material";
import {
  Box,
  Button,
  FormControl,
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
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { getAllContractorsPage } from "redux/actions/contractor";
import { getAllDeliverersPage } from "redux/actions/deliverer";
import { getLatestJobsDeliverer, getLatestJobsPage } from "redux/actions/job";
import { getAllOverallStatsDeliverer } from "redux/actions/overallStats";
import { loadUser } from "redux/actions/user";

const DashOrdersPage = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const isNonMediumScreens = useMediaQuery("(min-width: 1200px)");
  const { user, loading } = useSelector((state) => state.user);
  const { coOverallStats, isCoOverallStatsLoading } = useSelector(
    (state) => state.overallStats
  );
  const { latestJobsDeliverer, latestJobsDelivererLoading } = useSelector(
    (state) => state.jobs
  );
  const { deliverersPage, isPageDeliverersLoading } = useSelector(
    (state) => state.deliverers
  );
  let deliverer;
  let delivererId;

  deliverer =
    deliverersPage &&
    !isPageDeliverersLoading &&
    user &&
    deliverersPage.find((d) => d._id === user.companyId);
  console.log(deliverer);

  if (deliverer) {
    delivererId = deliverer._id;
  }

    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear]=useState(currentYear);
  
    useEffect(()=>{
      console.log("selected Year", selectedYear)
      dispatch(getAllOverallStatsDeliverer(selectedYear));
    },[dispatch,selectedYear])

  useEffect(() => {
    // dispatch(getAllOverallStatsDeliverer());
    dispatch(getLatestJobsDeliverer());
    dispatch(getAllDeliverersPage());
    dispatch(loadUser());
  }, [dispatch]);

  let highestRevenue = 0;
  let topContractorRevenue = "";
  let topContractorJobs = "";
  let mostJobs = 0;

  console.log(user)

  if (
    !isCoOverallStatsLoading &&
    coOverallStats &&
    coOverallStats.jobsByContractor &&
    coOverallStats.revenueByContractor
  ) {
    const jobsByContractor = coOverallStats.jobsByContractor;
    const revenueByContractor = coOverallStats.revenueByContractor;
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
  let textColor="";
  let secondLatestMonth = "";
  let isPercentage = false;
  let latestMonthJobs = 0;

  if (coOverallStats && coOverallStats.monthlyData) {
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

    const jobsMonthlyData = coOverallStats && coOverallStats.monthlyData;
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
        percentage = "+" + percentage.toFixed(2);
      } else {
        percentage = "-" + percentage.toFixed(2);
      }
      textColor = percentage > 0 ? 'green' : 'red';
    }
  }

    //converting date
    const shortMonth = (month) => {
      var shortMonth = new Date(Date.parse(month + " 1, 2000")).toLocaleString(
        "default",
        { month: "short" }
      );
      return shortMonth;
    };
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
      flex: 1,
      sortable: false,
      valueFormatter:(params)=>{
        const cost = parseFloat(params.value).toFixed(2);
        return cost;
      }
      //renderCell: (params) => params.value.length,
    },
    {
      field: "orderDate",
      headerName: "Order Date",
      flex: 1.5,
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

  const handleAnalytics = (delivererId) => {
    console.log(delivererId);
    navigate(`/job-analytics/${delivererId}`);
  };
  const handleReports = (delivererId) => {
    console.log(delivererId);
    navigate(`/reports`);
  };

  return (
    <Box m="1.5rem 2.5rem">
      <FlexBetween>
        <Header title={deliverer && deliverer.companyName} />
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
                //  backgroundColor: theme.palette.secondary[100],
              },
            }}
            onClick={() => handleAnalytics(delivererId)}
          >
            <AnalyticsOutlined sx={{ mr: "10px" }} />
            Analytics
          </Button>
          <Button
            variant="outlined"
            color="info"
            sx={{
              m: "1rem",
              fontSize: "14px",
              fontWeight: "bold",
              padding: "10px 20px",
              ":hover": {
                //     backgroundColor: theme.palette.secondary[100],
              },
            }}
            onClick={() => handleReports()}
          >
            <DownloadOutlined sx={{ mr: "10px" }} />
            Reports
          </Button>
        </Box>
        <FormControl sx={{ ml: "1rem" }}>
              <Select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                color="info"
                size="small"
                defaultValue="jobs"
                inputProps={{ "aria-label": "Select an option" }}
              >
                <MenuItem value="2025" selected>
                  2025
                </MenuItem>
                <MenuItem value="2024">2024</MenuItem>
              </Select>
            </FormControl>
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
        <StatBox
          title="Total Jobs"
          value={coOverallStats && coOverallStats.yearlyJobs}
          // increase={
          //   !isPercentage
          //     ? shortMonth(latestMonth)
          //     : shortMonth(secondLatestMonth)
          // }          description={
          //   <span style={{ color: textColor }}>{
          //   !isPercentage ? `${latestMonthJobs} jobs` : `${percentage}%`}
          //   </span>
          // }
          icon={
            <Email
              sx={{ color: theme.palette.secondary[300], fontSize: "26px" }}
            />
          }
        />
        <StatBox
          title="Tot Income"
          value={coOverallStats && coOverallStats.yearlyRevenue}
          // increase={topContractorRevenue && topContractorRevenue}
          // description={topContractorRevenue && `$${highestRevenue}`}
          icon={
            <MonetizationOn
              sx={{ color: theme.palette.secondary[300], fontSize: "26px" }}
            />
          }
        />
        <Box
          display={"flex"}
          flexDirection={"column"}
          alignItems={"center"}
          gridColumn="span 8"
          gridRow="span 2"
          backgroundColor={theme.palette.background.alt}
          p="1rem"
          borderRadius="0.55rem"
        >
          <Typography variant="h5" fontWeight={"bold"}>
            All Jobs Info
          </Typography>
          <OverviewChart view={"jobs"} isDashboard={true} />
        </Box>
        <StatBox
          title="Customers"
          value={coOverallStats && coOverallStats.totalCustomers}
          increase=""
          icon={
            <Groups
              sx={{ color: theme.palette.secondary[300], fontSize: "26px" }}
            />
          }
        />
        <StatBox
          title="Contractors"
          value={coOverallStats && coOverallStats.totalContractors}
          increase={topContractorJobs && topContractorJobs}
          description={topContractorJobs && `${mostJobs} jobs`}
          icon={
            <ReceiptLongOutlined
              sx={{ color: theme.palette.secondary[300], fontSize: "26px" }}
            />
          }
        />

        {/* ROW 2 */}

        <Box
          alignItems="center"
          display="flex"
          flexDirection="column"
          gridColumn="span 6"
          gridRow="span 3"
          backgroundColor={theme.palette.background.alt}
          p="1.5rem"
          borderRadius="0.55rem"
        >
          <Typography variant="h6" fontWeight="bold">
            Orders By Contractor
          </Typography>
          <BreakdownChart isDashboard={true} />
          <Typography
            p="0 0.6rem"
            fontSize="0.8rem"
            sx={{ color: theme.palette.secondary[200] }}
          >
            Breakdown of all time jobs by contractor
          </Typography>
        </Box>

        <Box
          p="1.5rem"
          gridColumn="span 6"
          gridRow="span 3"
          backgroundColor={theme.palette.background.alt}
          alignItems="center"
          display="flex"
          flexDirection="column"
          sx={{
            "& .MuiDataGrid-root": {
              width:'100%',
              border: "solid , 0.1rem",
              //borderWidth:"10px",
              // borderRadius: "5rem",
            },
            "& .MuiDataGrid-cell": {
              borderBottom: "none",
            },
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: theme.palette.background.alt,
              color: theme.palette.secondary[100],
              //borderBottom: "none",
            },
            "& .MuiDataGrid-virtualScroller": {
              backgroundColor: theme.palette.background.alt,
            },
            "& .MuiDataGrid-footerContainer": {
              backgroundColor: theme.palette.background.alt,
              color: theme.palette.secondary[100],
              // borderTop: "none",
            },
            "& .MuiDataGrid-toolbarContainer .MuiButton-text": {
              color: `${theme.palette.secondary[200]} !important`,
            },
          }}
        >
          <Typography fontWeight="bold">Latest Orders</Typography>
          <DataGrid
            loading={latestJobsDelivererLoading || !latestJobsDeliverer}
            getRowId={(row) => row._id}
            rows={(latestJobsDeliverer && latestJobsDeliverer) || []}
            columns={columns}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default DashOrdersPage;
