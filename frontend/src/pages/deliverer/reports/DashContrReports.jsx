import {
  AddTaskOutlined,
  Business,
  CalendarToday,
  CalendarViewMonth,
  EditSharp,
  Group,
  GroupAdd,
  Print,
  Task,
  Visibility,
  Work,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  useTheme,
} from "@mui/material";
import { DataGrid, GridDeleteIcon } from "@mui/x-data-grid";
import { CalendarIcon } from "@mui/x-date-pickers";
import AddCustomerPopup from "component/addCustomerPopup";
import DataGridCustomToolbar from "component/deliverer/DataGridCustomToolbar";
import DataGridCustomToolbarReports from "component/deliverer/DataGridCustomToolbarReports";
import FlexBetween from "component/deliverer/FlexBetween";
import Header from "component/deliverer/Header";
import UpdateJobPopup from "component/deliverer/updateJobPopup";
import React, { useEffect, useMemo, useState } from "react";
import ReactDatePicker from "react-datepicker";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  deleteJob,
  getAllJobsPage,
  getAllJobsReportContr,
  getAllJobsReportDeliverer,
} from "redux/actions/job";

const AllContrReportsPage = () => {
  const { user } = useSelector((state) => state.user);

  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { contractorId } = useParams();
  console.log(contractorId);

  const { pageContractors, isPageContrLoading } = useSelector(
    (state) => state.contractors
  );
  let contractor;
  let contractorName;
  contractor =
    pageContractors && pageContractors.find((c) => c._id === contractorId);
  contractorName = contractor && contractor.companyName;
  console.log(contractorName);
  console.log(contractor);

  const [pagee, setPagee] = useState(0);
  const [pageSizee, setPageSizee] = useState(25);
  const [sorta, setSorta] = useState({});
  const [sort, setSort] = useState({});
  const [searcha, setSearcha] = useState("");
  const [jobSearch, setJobSearch] = useState("");

  //dealing with the server side pagination
  const [paginationModel, setPaginationModel] = React.useState({
    pageSize: 25,
    page: 0,
  });

  let pageSize;
  let page;
  pageSize = paginationModel.pageSize;
  page = paginationModel.page;

  console.log(page);
  console.log(pageSize);
  console.log(paginationModel);

  //dealing with the editing and viewing job
  const [isUpdatePopupOpen, setIsUpdatePopup] = useState(false);
  const [isDisableInput, setIsDisableInput] = useState(false);
  const [isViewPopup, setIsViewPopup] = useState(false);
  const [isEditPopup, setIsEditPopup] = useState(false);
  //editing and updating ends here

  const [disable, setDisable] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [deliveryTypes, setDeliveryTypes] = useState([]);
  const [results, setResults] = useState("");
  const [totalJobs, setTotalJobs] = useState(0);
  const [chosenJob, setChosenJob] = useState({});

  const [jobId, setJobId] = useState("");
  const [jobNumber, setJobNumber] = useState("");

  const currentDate = new Date();
  const starttDate = new Date(currentDate.getTime() - 50 * 24 * 60 * 60 * 1000);
  const [startDate, setStartDate] = useState(starttDate);
  const [endDate, setEndDate] = useState(currentDate);

  console.log(page);
  console.log(sort);

  const handleClose = (event, reason) => {
    if (reason !== "backdropClick") {
      setIsUpdatePopup(false);
    }
  };
  const handleDelete = () => {};
  const handleView = () => {};

  const [isDelete, setIsDelete] = useState(false);

  const handleDeleteDialogueClose = () => {
    setIsDelete(false);
  };

  const columns = [
    {
      field: "jobNumber",
      headerName: "J/N",
      flex: 0.5,
    },
    {
      field: "deliveryType",
      headerName: "D/T",
      flex: 0.5,
    },

    {
      field: "from",
      headerName: "From",
      flex: 1,
      valueGetter: (params) => params.row.from.name,
    },
    {
      field: "customer",
      headerName: "Customer",
      flex: 1,

      valueGetter: (params) => params.row.customer.name,
    },
    {
      field: "distance",
      headerName: "Dist",
      flex: 0.5,
      sortable: false,
    },
    {
      field: "cost",
      headerName: "Cost",
      flex: 0.5,
      sortable: false,
      valueFormatter: (params) => {
        const cost = parseFloat(params.value).toFixed(2);
        return cost;
      },
    },
    {
      field: "orderDate",
      headerName: "Job Date",
      flex: 1,
      valueFormatter: (params) => {
        const date = new Date(params.value);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      },
    },
    {
      field: "options",
      headerName: "Options",
      flex: 0.5,
      renderCell: (params) => (
        <>
          <IconButton
            aria-label="View"
            onClick={() => handleView(params.row._id)}
          >
            <Print />
          </IconButton>
        </>
      ),
    },
  ];

  const {
    AllJobsReportContr,
    totalCount,

    isAllJobsReportContrLoading,
  } = useSelector((state) => state.jobs);
  console.log(AllJobsReportContr);
  useEffect(() => {
    dispatch(getAllJobsReportContr(contractorId));
  }, [dispatch]);

  //
  let allReportsContr;
  let formattedJobData = [""];
  let totalJobsCount = 0;
  let totalJobsDistance = 0;
  let totalJobsCost = 0;

  const [formattedData] = useMemo(() => {
    if (!AllJobsReportContr) return []; // Add a check for coOverallStats

    let totalJobs = [];

    Object.values(AllJobsReportContr).forEach(
      ({
        orderDate,
        _id,
        jobNumber,
        from,
        customer,
        distance,
        cost,
        description,
        deliveryType,
        vehicleId,
      }) => {
        const dateFormatted = new Date(orderDate);
        if (dateFormatted >= startDate && dateFormatted <= endDate) {
          const splitDate = dateFormatted.toLocaleDateString(undefined, {
            day: "2-digit",
            month: "2-digit",
          });
          // Format the splitDate as "dd-mm"
          totalJobs = [
            ...totalJobs,
            {
              _id: _id,
              jobNumber: jobNumber,
              from: from,
              customer: customer,
              distance: distance,
              cost: cost,
              description: description,
              deliveryType: deliveryType,

              vehicleId: vehicleId,
              orderDate,
            },
          ];

          totalJobsCost += cost;
          totalJobsDistance += distance;
        }
      }
    );

    formattedJobData = [totalJobs];
    allReportsContr = formattedJobData[0];
    totalJobsCount = allReportsContr.length;
    return [
      allReportsContr,
      formattedJobData,
      totalJobsCount,
      totalJobsCost,
      totalJobsDistance,
    ];
  }, [AllJobsReportContr, startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  console.log(AllJobsReportContr);

  allReportsContr = formattedJobData[0];
  console.log(formattedJobData);
  console.log(allReportsContr);
  console.log(AllJobsReportContr);
  console.log(startDate);
  console.log(endDate);

  console.log(totalJobsCost);
  console.log(totalJobsDistance);
  return (
    <Box m="1.5rem 2.5rem">
      <FlexBetween>
        <Header title="Job Reports" subtitle="Reports of all jobs." />

        <Box>
          <Button
            disabled
            sx={{
              backgroundColor: theme.palette.secondary.light,
              color: theme.palette.background.alt,
              fontSize: "16px",
              fontWeight: "bold",
              padding: "10px 20px",
            }}
          >
            <CalendarToday sx={{ mr: "10px" }} />
            {totalCount}{" "}
          </Button>
        </Box>

        <Box>
          <Button
            component={Link} // Use the Link component from react-router-dom
            to="/add-job" // Specify the path to the addJobPage.jsx
            sx={{
              backgroundColor: theme.palette.secondary.light,
              color: theme.palette.background.alt,
              fontSize: "14px",
              fontWeight: "bold",
              padding: "10px 20px",
              ":hover": {
                backgroundColor: theme.palette.secondary[100],
              },
            }}
          >
            <AddTaskOutlined sx={{ mr: "10px" }} />
            Add
          </Button>
        </Box>
      </FlexBetween>
      {/**This is where the add customer dialogue starts */}

      <Dialog
        open={isDelete}
        onClose={handleDeleteDialogueClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title" fontWeight={"bold"}>
          {`Delete Job : ${jobNumber}?`}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to remove <b> {jobNumber} </b> from the system
            ?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            color="info"
            onClick={() => handleDeleteDialogueClose()}
          >
            Cancel
          </Button>
          <Button
            variant="outlined"
            color="warning"
            onClick={() => handleDelete(jobId)}
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/**This is where the add customer dialogue ends */}
      <Box>
        <UpdateJobPopup
          open={isUpdatePopupOpen}
          handleClose={handleClose}
          isDisableInput={isDisableInput}
          selectedJob={chosenJob}
          isView={isViewPopup}
          isEdit={isEditPopup}
        />
      </Box>

      {/**This is where the content goes */}
      <Box
        height="80vh"
        sx={{
          "& .MuiDataGrid-root": {
            border: "none",
          },
          "& .MuiDataGrid-cell": {
            borderBottom: "solid 0.2px",
          },
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: theme.palette.background.alt,
            color: theme.palette.secondary[100],
            borderBottom: "none",
          },
          "& .MuiDataGrid-virtualScroller": {
            backgroundColor: theme.palette.primary.light,
          },
          "& .MuiDataGrid-footerContainer": {
            backgroundColor: theme.palette.background.alt,
            color: theme.palette.secondary[100],
            borderTop: "none",
          },
          "& .MuiDataGrid-toolbarContainer .MuiButton-text": {
            color: `${theme.palette.secondary[100]} !important`,
          },
        }}
      >
        <DataGrid
          loading={isAllJobsReportContrLoading || !allReportsContr}
          Header="hello"
          getRowId={(row) => row._id}
          rows={(AllJobsReportContr && allReportsContr) || []}
          columns={columns}
          rowCount={totalJobsCount || 0}
          components={{ Toolbar: DataGridCustomToolbarReports }}
          componentsProps={{
            toolbar: {
              searchInput,
              setSearchInput,
              setJobSearch,
              results,
              startDate,
              setStartDate,
              endDate,
              setEndDate,
              totalJobsDistance,
              totalJobsCost,
              totalJobsCount,
              contractorName,
            },
          }}
        />
      </Box>
      {/**This is where the content ends */}
    </Box>
  );
};

export default AllContrReportsPage;
