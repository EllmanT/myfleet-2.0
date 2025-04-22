import {
  AddTask,
  AnalyticsOutlined,
  DownloadOutlined,
  Email,
  Groups,
  MonetizationOn,
  ReceiptLongOutlined,
  RemoveRedEye,
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
import RevenueBarChart from "component/deliverer/charts/RevenueBarChart";
import RevenueBreakdownChart from "component/deliverer/charts/RevenueBreakdownChart";
import RevenueOverviewChart from "component/deliverer/charts/RevenueOverviewChart";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { getAllContractorsPage } from "redux/actions/contractor";
import { getAllDeliverersPage } from "redux/actions/deliverer";
import { getLatestJobsDeliverer, getLatestJobsPage } from "redux/actions/job";
import { getAllOverallStatsDeliverer } from "redux/actions/overallStats";
import { loadUser } from "redux/actions/user";

import html2pdf from "html2pdf.js";

const DashRevenuePage = () => {
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

  const [selectedOptionSLC, setSelectedOptionSLC] = useState("totalRevenue");
  const [selectedOptionBC, setSelectedOptionBC] = useState("totalRevenue");

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear]=useState(currentYear);

  useEffect(()=>{
    console.log("selected Year", selectedYear)
    dispatch(getAllOverallStatsDeliverer(selectedYear));
  },[dispatch,selectedYear])

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
  useEffect(() => {
    // dispatch(getAllOverallStatsDeliverer());
    dispatch(getLatestJobsDeliverer());
    dispatch(getAllDeliverersPage());
    //dispatch(loadUser());
  }, [dispatch]);
console.log(coOverallStats.yearlyExpenses);
  let highestRevenue = 0;
  let topContractorRevenue = "";

  if (
    !isCoOverallStatsLoading &&
    coOverallStats &&
    coOverallStats.jobsByContractor &&
    coOverallStats.revenueByContractor
  ) {
    const revenueByContractor = coOverallStats.revenueByContractor;

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
  let percentageRevenue = "";
  let percentageProfit = "";
  let percentageExpenses = "";
  let latestMonth = "";
  let secondLatestMonth = "";
  let isPercentage = false;
  let latestMonthRevenue = 0;
  let latestMonthProfit = 0;
  let latestMonthExpenses = 0;
  let textColorRevenue="";
  let textColorProfit="";
  let textColorExpense="";

  if (coOverallStats && coOverallStats.monthlyData) {
    let numberofMonths = 0;
    let findSecondLatestMonth = 0;
    let secondLatestMonthRevenue = 0;
    let secondLatestMonthProfit = 0;
    let secondLatestMonthExpenses = 0;
    let findThirdLatestMonth = 0;
    let thirdLatestMonth = "";
    let thirdLatestMonthRevenue = 0;
    let thirdLatestMonthProfit = 0;
    let thirdLatestMonthExpenses = 0;
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
    latestMonthRevenue = latestMonthData.totalRevenue;
    latestMonthProfit = latestMonthData.totalProfit;
    latestMonthExpenses = latestMonthData.totalExpenses;

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
      secondLatestMonthRevenue = secondLatestMonthData.totalRevenue;
      secondLatestMonthProfit = secondLatestMonthData.totalProfit;
      secondLatestMonthExpenses = secondLatestMonthData.totalExpenses;

      findThirdLatestMonth = findLatestMonth - 2;
      thirdLatestMonth = jobsMonthlyData[findThirdLatestMonth].month;
      const thirdLatestMonthData = jobsMonthlyData.find(
        (job) => job.month === thirdLatestMonth
      );
      thirdLatestMonthRevenue = thirdLatestMonthData.totalRevenue;
      thirdLatestMonthProfit = thirdLatestMonthData.totalProfit;
      thirdLatestMonthExpenses = thirdLatestMonthData.totalExpenses;

      const changeRevenue = secondLatestMonthRevenue - thirdLatestMonthRevenue;
      const changeProfit = secondLatestMonthProfit - thirdLatestMonthProfit;
     
      let changeExpenses =
    
        secondLatestMonthExpenses - thirdLatestMonthExpenses;
        console.log(thirdLatestMonthExpenses);
        console.log(changeExpenses);
        if(thirdLatestMonthExpenses===0){
          percentageExpenses=changeExpenses;
        }else{
          percentageExpenses=(changeExpenses/thirdLatestMonthExpenses)*100;

        }

      percentageRevenue = (changeRevenue / thirdLatestMonthRevenue) * 100;
      percentageProfit = (changeProfit / thirdLatestMonthProfit) * 100;

      if (percentageRevenue > 0) {
        percentageRevenue = "+" + percentageRevenue.toFixed(2);
      } else {
        percentageRevenue = "-" + percentageRevenue.toFixed(2);
      }
      if (percentageProfit > 0) {
        percentageProfit = "+" + percentageProfit.toFixed(2);
      } else {
        percentageProfit = "-" + percentageProfit.toFixed(2);
      }
      if (percentageExpenses > 0) {
        percentageExpenses = "+" + percentageExpenses.toFixed(2);
      } else {
        percentageExpenses = "-" + percentageExpenses.toFixed(2);
      }

       textColorRevenue = percentageRevenue > 0 ? 'green' : 'red';
       textColorProfit = percentageProfit > 0 ? 'green' : 'red';
       textColorExpense = percentageExpenses <= 0 ? 'green' : 'red';


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

  const handleDownloadBC = () => {
    const element = document.getElementById("print-content-bc");
    html2pdf().from(element).save("Revenue_Barchart.pdf");
  };

  const handleDownloadPC = () => {
    const element = document.getElementById("print-content-pc");
    html2pdf().from(element).save("Revenue_Breakdown_Piechart.pdf");
  };

  const handleDownloadSLC = () => {
    const element = document.getElementById("print-content-slc");
    html2pdf().from(element).save("Revenue_Multilinechart.pdf");
  };

  const handleViewPC = (companyId) => {
    navigate(`/revenue-analytics/breakdown/${companyId}`);
  };
  const handleViewBC = (companyId) => {
    navigate(`/revenue-analytics/monthly/${companyId}`);
  };
  const handleViewMLC = (companyId) => {
    navigate(`/revenue-analytics/daily-data/${companyId}`);
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
          title="Revenue"
          value={coOverallStats && coOverallStats.yearlyRevenue}
          // increase={
          //   !isPercentage
          //     ? shortMonth(latestMonth)
          //     : shortMonth(secondLatestMonth)
          // }
          // description={
          //   <span style={{ color: textColorRevenue }}>
          //   {!isPercentage ? `${latestMonthRevenue}` : `${percentageRevenue}%`}
          // </span>          }
          icon={
            <MonetizationOn
              sx={{ color: theme.palette.secondary[300], fontSize: "26px" }}
            />
          }
        />
        <StatBox
          title="Profit"
          value={coOverallStats && coOverallStats.yearlyProfit}
  //         increase={
  //           !isPercentage
  //             ? shortMonth(latestMonth)
  //             : shortMonth(secondLatestMonth)
  //         }
  //         description={
  //           <span style={{ color: textColorProfit }}>
  //   {!isPercentage ? `${latestMonthProfit}` : `${percentageProfit}%`}
  // </span>
  //         }
          icon={
            <TrendingUpOutlined
              sx={{ color: theme.palette.secondary[300], fontSize: "26px" }}
            />
          }
        />

        <Box
          id="print-content-slc"
          position={"relative"}
          display={"flex"}
          flexDirection={"column"}
          alignItems={"center"}
          gridColumn="span 8"
          gridRow="span 2"
          backgroundColor={theme.palette.background.alt}
          p="1rem"
          borderRadius="0.55rem"
        >
          <Box display={"flex"}>
            <Typography variant="h5" fontWeight={"bold"}>
              Yearly Analysis
            </Typography>

            <IconButton
              sx={{ ml: "8rem" }}
              onClick={() => handleViewMLC(delivererId)}
            >
              <RemoveRedEye />
            </IconButton>
            <IconButton
              sx={{ ml: "0.5rem" }}
              onClick={() => handleDownloadSLC()}
            >
              <DownloadOutlined />
            </IconButton>
          </Box>
          <RevenueOverviewChart view={"revenue"} isDashboard={true} />
        </Box>

        <StatBox
          title="Expenses"
          value={coOverallStats && coOverallStats.yearlyExpenses}
          // increase={
          //   !isPercentage
          //     ? shortMonth(latestMonth)
          //     : shortMonth(secondLatestMonth)
          // }
          // description={
          //   <span style={{ color: textColorExpense }}>
          //   {!isPercentage ? latestMonthExpenses ? `${latestMonthExpenses}` : `${percentageExpenses}%` : coOverallStats.yearlyExpenses}
          // </span>          }
          icon={
            <TrendingDownOutlined
              sx={{ color: theme.palette.secondary[300], fontSize: "26px" }}
            />
          }
        />
        <StatBox
          title="Contractors"
          value={coOverallStats && coOverallStats.totalContractors}
          // increase={topContractorRevenue && topContractorRevenue}
          // description={topContractorRevenue && `$${highestRevenue}`}
          icon={
            <ReceiptLongOutlined
              sx={{ color: theme.palette.secondary[300], fontSize: "26px" }}
            />
          }
        />

        {/* ROW 2 */}

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
              Revenue By Contractor
            </Typography>
            <IconButton
              sx={{ ml: "8rem" }}
              onClick={() => handleViewPC(delivererId)}
            >
              <RemoveRedEye />
            </IconButton>
            <IconButton
              sx={{ ml: "0.5rem" }}
              onClick={() => handleDownloadPC()}
            >
              <DownloadOutlined />
            </IconButton>
          </Box>
          <RevenueBreakdownChart isDashboard={true} />
          <Typography
            p="0 0.6rem"
            fontSize="0.8rem"
            sx={{ color: theme.palette.secondary[200] }}
          >
            Breakdown of all time revenue by contractor
          </Typography>
        </Box>
        <Box
          id="print-content-bc"
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
            <Typography variant="h5" fontWeight={"bold"}>
              Breakdown of {selectedOptionBC}
            </Typography>
            <FormControl sx={{ ml: "1rem" }}>
              <Select
                value={selectedOptionBC}
                onChange={(e) => setSelectedOptionBC(e.target.value)}
                color="info"
                size="small"
                defaultValue="jobs"
                inputProps={{ "aria-label": "Select an option" }}
              >
                <MenuItem value="totalRevenue" selected>
                  Total Revenue
                </MenuItem>
                <MenuItem value="totalExpenses">Total Expenses</MenuItem>
              </Select>
            </FormControl>

            <IconButton
              sx={{ ml: "1rem" }}
              onClick={() => handleViewBC(delivererId)}
            >
              <RemoveRedEye />
            </IconButton>
            <IconButton
              sx={{ ml: "0.5rem" }}
              onClick={() => handleDownloadBC()}
            >
              <DownloadOutlined />
            </IconButton>
          </Box>
          <RevenueBarChart view={selectedOptionBC} isDashboard={true} />
          <Typography
            p="0 0.6rem"
            fontSize="0.8rem"
            sx={{ color: theme.palette.secondary[200] }}
          >
            Breakdown of all time revenue by contractor
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default DashRevenuePage;
