import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  useTheme,
} from "@mui/material";
import {
  DataGrid,
  GridDeleteIcon,
  GridVisibilityOffIcon,
} from "@mui/x-data-grid";
import {
  Close,
  EditNotifications,
  EditSharp,
  Group,
  GroupAdd,
  Visibility,
} from "@mui/icons-material";
import FlexBetween from "component/deliverer/FlexBetween";
import Header from "component/deliverer/Header";
import { toast } from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import {
  createCustomer,
  deleteCustomer,
  getAllCustomersPage,
} from "redux/actions/customer";
import AddCustomerPopup from "component/addCustomerPopup";
import Store from "redux/store";
import DataGridCustomToolbar from "component/deliverer/DataGridCustomToolbar";

const PaymentsPage = () => {
  const { user } = useSelector((state) => state.user);

  const theme = useTheme();
  const dispatch = useDispatch();

  const [pagee, setPagee] = useState(0);
  const [pageSizee, setPageSizee] = useState(25);
  const [sort, setSort] = useState({});
  const [search, setJobSearch] = useState("");
  const [results, setResults] = useState("");
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const { customersPage, totalCount, isPageCustomerLoading } = useSelector(
    (state) => state.customers
  );

  const [paginationModel, setPaginationModel] = React.useState({
    pageSize: 25,
    page: 0,
  });

  let pageSize;
  let page;
  pageSize = paginationModel.pageSize;
  page = paginationModel.page;

  useEffect(() => {
    if (page < 0) {
      setPagee(0); // Reset to the first page if the value is negative
    } else {
      dispatch(
        getAllCustomersPage(page, pageSize, JSON.stringify(sort), search)
      );
    }
  }, [page, pageSize, sort, search, dispatch]);

  console.log(customersPage);
  const [disable, setDisable] = useState(false);
  const [open, setOpen] = useState(false);

  const [addedCustomer, setAddedCustomer] = useState("");
  const [chosenCustomer, setChosenCustomer] = useState({});
  const [isView, setIsView] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [isAddButtonn, setIsAddButtonn] = useState(false);
  const [isEditButtonn, setIsEditButtonn] = useState(false);
  const [name, setName] = useState(false);
  const [customerId, setCustomerId] = useState("");

  const handleClickOpen = () => {
    setIsAddButtonn(true);
    setIsEditButtonn(false);
    setIsView(false);
    setIsEdit(false);
    setOpen(true);
  };

  const isReset = () => {};

  const handleClose = (event, reason) => {
    if (reason !== "backdropClick") {
      setOpen(false);
    }
  };

  const handleView = (customerId) => {
    const selectedCustomer =
      customersPage &&
      customersPage.find((customer) => customer._id === customerId);
    setChosenCustomer(selectedCustomer);
    setIsView(true);
    setIsEdit(false);
    setIsAddButtonn(false);
    setIsEditButtonn(false);
    setOpen(true);
  };

  const handleEdit = (customerId) => {
    const selectedCustomer =
      customersPage &&
      customersPage.find((customer) => customer._id === customerId);
    setChosenCustomer(selectedCustomer);
    setIsEditButtonn(true);
    setIsAddButtonn(false);
    setIsView(false);
    setIsEdit(true);
    setOpen(true);
  };
  const [isDelete, setIsDelete] = useState(false);
  const handleDelete = (customerId) => {
    dispatch(deleteCustomer(customerId))
      .then(() => {
        // The deleteCustomer action has successfully executed
        toast.success("Customer deleted successfully");
        dispatch(getAllCustomersPage());
        handleDeleteDialogueClose();
      })
      .catch((error) => {
        // An error occurred during the deleteCustomer action
        toast.error(error.response.data.message);
      });
  };
  const handleDeleteDialogue = (customerId) => {
    const selectedCustomer =
      customersPage &&
      customersPage.find((customer) => customer._id === customerId);

    setCustomerId(customerId);
    setName(selectedCustomer.name);
    setIsDelete(true);
  };

  const handleDeleteDialogueClose = () => {
    setIsDelete(false);
  };

  const columns = [
    {
      field: "name",
      headerName: "Name",
      flex: 1,
    },
    {
      field: "address",
      headerName: "Address",
      flex: 1,
    },
    {
      field: "city",
      headerName: "City",
      flex: 1,
    },
    {
      field: "phoneNumber",
      headerName: "Phone Number",
      flex: 1.5,
      sortable: false,
    },
    {
      field: "options",
      headerName: "Options",
      flex: 1,
      renderCell: (params) => (
        <>
          <IconButton
            aria-label="View"
            onClick={() => handleView(params.row._id)}
          >
            <Visibility />
          </IconButton>
          <IconButton
            aria-label="Edit"
            onClick={() => handleEdit(params.row._id)}
          >
            <EditSharp />
          </IconButton>
          <IconButton
            aria-label="Delete"
            onClick={() => handleDeleteDialogue(params.row._id)}
          >
            <GridDeleteIcon />
          </IconButton>
        </>
      ),
    },
  ];

  console.log(customersPage);
  return (
    <Box m="1.5rem 2.5rem">
      <FlexBetween>
        <Header title="Payments" subtitle="See all your payments and Invoices." />

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
            <Group sx={{ mr: "10px" }} />
            {totalCount}
          </Button>
        </Box>

        <Box>
          <Button
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
            onClick={handleClickOpen}
          >
            <GroupAdd sx={{ mr: "10px" }} />
            Add
          </Button>
        </Box>
      </FlexBetween>
      <Dialog
        open={isDelete}
        onClose={handleDeleteDialogueClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title" fontWeight={"bold"}>
          {`Delete Admin : ${name}?`}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to remove <b> {name} </b> from the system ?
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
            onClick={() => handleDelete(customerId)}
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      {/**This is where the add customer dialogue starts */}
      {open && (
        <AddCustomerPopup
          open={true}
          handleClose={handleClose}
          isReset={isReset}
          selectedCustomer={chosenCustomer}
          isView={isView}
          isEdit={isEdit}
          isAddButton={isAddButtonn}
          isEditButton={isEditButtonn}
          name={addedCustomer}
          onChange={(e) => setAddedCustomer(e.target.value)}
        />
      )}
      {/**This is where the add customer dialogue ends */}

      {/**This is where the content goes */}
      <Box
        height="80vh"
        sx={{
          "& .MuiDataGrid-root": {
            border: "none",
          },
          "& .MuiDataGrid-cell": {
            borderBottom: "none",
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
            color: `${theme.palette.secondary[200]} !important`,
          },
        }}
      >
        <DataGrid
          loading={isPageCustomerLoading || !customersPage}
          getRowId={(row) => row._id}
          rows={(customersPage && customersPage) || []}
          columns={columns}
          rowCount={totalCount || 0}
          rowsPerPageOptions={[20, 50, 100]}
          pagination
          page={page}
          pageSize={pageSize}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          paginationMode="server"
          sortingMode="server"
          onSortModelChange={(newSortModel) => setSort(...newSortModel)}
          components={{ Toolbar: DataGridCustomToolbar }}
          componentsProps={{
            toolbar: { searchInput, setSearchInput, setJobSearch, results },
          }}
        />
      </Box>
      {/**This is where the content ends */}
    </Box>
  );
};

export default PaymentsPage;
