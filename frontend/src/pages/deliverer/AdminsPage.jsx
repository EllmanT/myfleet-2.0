import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Typography,
  useTheme,
  useMediaQuery,
  InputLabel,
  FormControl,
  DialogContent,
  DialogTitle,
  Dialog,
  DialogActions,
  TextField,
  Stepper,
  StepButton,
  Step,
  IconButton,
  DialogContentText,
} from "@mui/material";
import {
  Add,
  Close,
  EditSharp,
  GroupAdd,
  SecurityOutlined,
  Visibility,
} from "@mui/icons-material";
import FlexBetween from "component/deliverer/FlexBetween";
import Header from "component/deliverer/Header";
import Cities from "component/Cities";
import Roles from "component/Roles";
import { toast } from "react-hot-toast";
import { server } from "server";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { deleteAdmin, getAllAdminsPage, updateAdmin } from "redux/actions/user";
import { DataGrid, GridDeleteIcon } from "@mui/x-data-grid";
import DataGridCustomToolbar from "component/deliverer/DataGridCustomToolbar";

let steps = [];
const AdminsPage = () => {
  const isNonMobile = useMediaQuery("(min-width: 1000px)");
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [lastStep, setLastStep] = useState(0);

  const [disableSelect, setDisableSelect] = useState(false);
  const [pagee, setPagee] = useState(0);
  const [pageSizee, setPageSizee] = useState(25);
  const [sort, setSort] = useState({});
  const [search, setJobSearch] = useState("");
  const [results, setResults] = useState("");
  const [totalAdmins, setTotalAdmins] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const { adminsPage, totalCount, isPageAdminsLoading } = useSelector(
    (state) => state.user
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
      dispatch(getAllAdminsPage(page, pageSize, JSON.stringify(sort), search));
    }
  }, [page, pageSize, sort, search, dispatch]);

  useEffect(() => {
    if (adminsPage) {
      if (totalAdmins === 0) {
        setTotalAdmins(adminsPage.length);
      }
      if (search === "") {
        setResults(adminsPage.length);
        setTotalAdmins(adminsPage.length);
      }
      setResults(adminsPage.length);
    } else {
      setResults(0);
    }
  }, [adminsPage, totalAdmins, search]);

  const [open, setOpen] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [check, setCheck] = useState("");
  const [lastPassword, setLastPassword] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [role, setRole] = useState("");
  const [address, setAddress] = useState("");
  const [companyId, setCompanyId] = useState("");
  //the steps
  const [activeStep, setActiveStep] = React.useState(0);
  const [completed, setCompleted] = React.useState({});

  const [disable, setDisable] = useState(false);

  const [addedAdmin, setAddedAdmin] = useState("");
  const [chosenAdmin, setChosenAdmin] = useState({});
  const [isView, setIsView] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [isAddButtonn, setIsAddButtonn] = useState(false);
  const [isEditButtonn, setIsEditButtonn] = useState(false);
  const [isUpdateAccess, setIsUpdateAccess] = useState(false);

  //steps stuff start here START

  const totalSteps = () => {
    return steps.length;
  };

  const completedSteps = () => {
    return Object.keys(completed).length;
  };

  const isLastStep = () => {
    return activeStep === totalSteps() - 1;
  };

  const allStepsCompleted = () => {
    return completedSteps() === totalSteps();
  };

  const handleNext = () => {
    const newActiveStep =
      isLastStep() && !allStepsCompleted()
        ? // It's the last step, but not all steps have been completed,
          // find the first step that has been completed
          steps.findIndex((step, i) => !(i in completed))
        : activeStep + 1;
    setActiveStep(newActiveStep);
    if (isAddButtonn) {
      stepChecker();
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    if (isAddButtonn) {
      stepChecker();
    }
  };

  const handleStep = (step) => () => {
    setActiveStep(step);
  };

  const handleReset = () => {
    setActiveStep(0);
    setCompleted({});
  };
  //handle the changes from step to step check to see if step is complete
  const stepChecker = () => {
    if (activeStep === 0) {
      if (
        name !== "" &&
        companyId !== "" &&
        role !== "" &&
        city !== "" &&
        address !== "" &&
        phoneNumber !== ""
      ) {
        const newCompleted = completed;
        newCompleted[activeStep] = true;
        setCompleted(newCompleted);
      } else {
        const newCompleted = completed;
        newCompleted[activeStep] = false;
        setCompleted(newCompleted);
      }
    }

    if (activeStep === 1) {
      if (
        email !== "" &&
        password !== "" &&
        check !== "" &&
        password === check
      ) {
        const newCompleted = completed;
        newCompleted[activeStep] = true;
        setCompleted(newCompleted);
      } else {
        const newCompleted = completed;
        newCompleted[activeStep] = false;
        setCompleted(newCompleted);
      }
    }
  };

  //the steps ENDS

  //the steps

  const handleClickOpen = () => {
    setAdminId("");
    setName("");
    setEmail("");
    setPassword("");
    setCheck("");
    setPhoneNumber("");
    setRole("");
    setCity("");
    setLastPassword("");
    setCompanyId("");
    setAddress("");
    setDisableSelect(false);
    setDisable(false);
    setCompleted({});
    setIsUpdateAccess(true);
    setIsAddButtonn(true);
    setIsEditButtonn(false);
    steps = [];
    steps = ["General Info", "Access", "Preview"];
    setLastStep(steps.length - 1);
    setActiveStep(0);
    setOpen(true);
  };

  const handleClose = (event, reason) => {
    if (reason !== "backdropClick") {
      setOpen(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const config = { Headers: { "Content-type": "multipart/form-data" } };

    const newForm = new FormData();
    newForm.append("adminId", adminId);
    newForm.append("address", address);
    newForm.append("city", city);
    newForm.append("email", email);
    newForm.append("password", password);
    newForm.append("role", role);
    newForm.append("companyId", companyId);
    newForm.append("phoneNumber", phoneNumber);
    newForm.append("name", name);

    setDisable(true);

    if (
      //ensure that all fields are filled
      (isAddButtonn && completed[0] && completed[1]) ||
      isEditButtonn
    ) {
      if (isAddButtonn === true && isEditButtonn === false) {
        await axios
          .post(`${server}/user/create-user`, newForm, config)
          .then((res) => {
            toast.success(res.data.message);
            setName("");
            setAdminId("");
            setEmail("");
            setPassword("");
            setCheck("");
            setPhoneNumber("");
            setRole("");
            setCity("");
            setCompanyId("");
            setAddress("");
            setDisable(false);
            setCompleted({});

            dispatch(getAllAdminsPage());
            handleClose();
          })
          .catch((error) => {
            toast.error(error.response.data.message);
            setDisable(false);
          });
      }
      if (isAddButtonn === false && isEditButtonn === true) {
        dispatch(
          updateAdmin(adminId, name, email, phoneNumber, city, address, role)
        )
          .then(() => {
            toast.success("Admin updated successfully");
            handleClose();
            dispatch(getAllAdminsPage());
            dispatch({ type: "clearMessages" });
            setDisable(false);
          })
          .catch((error) => {
            toast.error(error.response.data.message);
            setDisable(false);
          });

        //edit the Admin
      }
    } else {
      if (password !== check) {
        toast.error("Passwords do not match");
        setDisable(false);
      }
      toast.error("Enter all fields");
      setDisable(false);
    }
  };

  const handleView = (adminId) => {
    const selectedAdmin =
      adminsPage && adminsPage.find((admin) => admin._id === adminId);

    setAdminId(adminId);
    setName(selectedAdmin.name);
    setEmail(selectedAdmin.email);
    setPhoneNumber(selectedAdmin.phoneNumber);
    setCity(selectedAdmin.city);
    setAddress(selectedAdmin.address);
    setRole(selectedAdmin.role);
    setCompanyId(selectedAdmin.companyId);

    steps = [];
    steps = ["General Info", "Preview"];
    setLastStep(steps.length - 1);
    setActiveStep(0);
    setDisableSelect(true);
    setIsUpdateAccess(false);
    setIsAddButtonn(false);
    setIsEditButtonn(false);
    setOpen(true);
  };

  const handleEdit = (adminId) => {
    const selectedAdmin =
      adminsPage && adminsPage.find((admin) => admin._id === adminId);
    setAdminId(adminId);
    setName(selectedAdmin.name);
    setEmail(selectedAdmin.email);
    setPhoneNumber(selectedAdmin.phoneNumber);
    setCity(selectedAdmin.city);
    setAddress(selectedAdmin.address);
    setRole(selectedAdmin.role);
    setCompanyId(selectedAdmin.companyId);
    steps = [];
    steps = ["General Info", "Preview"];
    setLastStep(steps.length - 1);
    setActiveStep(0);
    setDisableSelect(false);
    setIsUpdateAccess(false);
    setIsEditButtonn(true);
    setIsAddButtonn(false);
    setIsView(false);
    setIsEdit(true);
    setOpen(true);
  };
  const [isDelete, setIsDelete] = useState(false);
  const handleDelete = (adminId) => {
    dispatch(deleteAdmin(adminId))
      .then(() => {
        // The deleteAdmin action has successfully executed
        toast.success("Admin deleted successfully");
        dispatch(getAllAdminsPage());
        handleDeleteDialogueClose();
      })
      .catch((error) => {
        // An error occurred during the deleteAdmin action
        toast.error(error.response.data.message);
      });
  };

  const handleDeleteDialogue = (adminId) => {
    const selectedAdmin =
      adminsPage && adminsPage.find((admin) => admin._id === adminId);

    setAdminId(adminId);
    setName(selectedAdmin.name);
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
      field: "role",
      headerName: "Role",
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

  return (
    <Box m="1.5rem 2.5rem">
      <FlexBetween>
        <Header title="Admins" subtitle="See all your admins." />
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
            <SecurityOutlined sx={{ mr: "10px" }} />
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
            <Add sx={{ mr: "10px" }} />
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
            onClick={() => handleDelete(adminId)}
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      {/**Add contractor dialogue start */}
      <div>
        <Dialog disableEscapeKeyDown open={open} onClose={handleClose}>
          <form onSubmit={handleSubmit}>
            <DialogTitle variant="h3" sx={{ m: "0rem 6rem" }}>
              <Button
                disabled
                variant="outlined"
                sx={{
                  fontSize: "20px",
                  fontWeight: "bold",
                  padding: "10px 20px",
                  ":disabled": {
                    color: theme.palette.primary[100],
                  },
                }}
              >
                <GroupAdd sx={{ mr: "10px", fontSize: "25px" }} />
                Admin
              </Button>
              <Button
                onClick={handleClose}
                variant="outlined"
                color="info"
                sx={{ ml: "30px" }}
              >
                <Close sx={{ fontSize: "25px" }} />
              </Button>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ width: "100%" }}>
                <Stepper nonLinear activeStep={activeStep}>
                  {steps.map((label, index) => (
                    <Step key={label} completed={completed[index]}>
                      <StepButton color="inherent" onClick={handleStep(index)}>
                        {label}
                      </StepButton>
                    </Step>
                  ))}
                </Stepper>
                <div>
                  {
                    <React.Fragment>
                      <Box
                        sx={{ mt: "0.5rem" }}
                        display="flex"
                        maxWidth={"400px"}
                        margin={"auto"}
                        padding={"0rem 5rem"}
                        flexDirection="column"
                        alignItems={"center"}
                        justifyContent={"center"}
                      >
                        {activeStep === 0 && (
                          <Box display={"flex"} flexDirection={"column"}>
                            <FormControl sx={{ m: 1, minWidth: 250 }}>
                              <TextField
                                disabled={disableSelect}
                                required
                                variant="outlined"
                                type="text"
                                label="Name"
                                color="info"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                              />
                            </FormControl>

                            <FormControl sx={{ m: 1, minWidth: 250 }}>
                              <TextField
                                disabled={disableSelect}
                                required
                                variant="outlined"
                                type="text"
                                label="Company Id"
                                color="info"
                                value={companyId}
                                onChange={(e) => setCompanyId(e.target.value)}
                              />
                            </FormControl>
                            <Box display={"flex"}>
                              <FormControl sx={{ m: 1, minWidth: 200 }}>
                                <Roles
                                  name={role}
                                  onChange={(e) => setRole(e.target.value)}
                                  disabled={disableSelect}
                                />
                              </FormControl>
                              <FormControl sx={{ m: 1, minWidth: 150 }}>
                                <TextField
                                  disabled={disableSelect}
                                  required
                                  variant="outlined"
                                  type="text"
                                  label="Phone Number"
                                  color="info"
                                  value={phoneNumber}
                                  onChange={(e) =>
                                    setPhoneNumber(e.target.value)
                                  }
                                />
                              </FormControl>
                            </Box>
                            <Box display={"flex"}>
                              <FormControl sx={{ m: 1, minWidth: 200 }}>
                                <TextField
                                  disabled={disableSelect}
                                  required
                                  variant="outlined"
                                  type="text"
                                  label="Home Address"
                                  color="info"
                                  value={address}
                                  onChange={(e) => setAddress(e.target.value)}
                                />
                              </FormControl>
                              <FormControl sx={{ m: 1, minWidth: 150 }}>
                                <Cities
                                  name={city}
                                  onChange={(e) => setCity(e.target.value)}
                                  disabled={disableSelect}
                                />
                              </FormControl>
                            </Box>
                          </Box>
                        )}

                        {activeStep === 1 &&
                          (isAddButtonn || isUpdateAccess) && (
                            <Box display={"flex"} flexDirection={"column"}>
                              <FormControl sx={{ m: 1, minWidth: 250 }}>
                                <TextField
                                  disabled={disableSelect}
                                  required
                                  variant="outlined"
                                  type="text"
                                  label="Email Address"
                                  color="info"
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                />
                              </FormControl>
                              {isEditButtonn && (
                                <FormControl sx={{ m: 1, minWidth: 250 }}>
                                  <TextField
                                    required
                                    variant="outlined"
                                    type="password"
                                    label="Original Password"
                                    margin="normal"
                                    value={lastPassword}
                                    onChange={(e) =>
                                      setLastPassword(e.target.value)
                                    }
                                  />
                                </FormControl>
                              )}
                              {(isEditButtonn || isAddButtonn) && (
                                <>
                                  <FormControl sx={{ m: 1, minWidth: 250 }}>
                                    <TextField
                                      required
                                      color={
                                        check === password && password !== ""
                                          ? "success"
                                          : "info"
                                      }
                                      variant="outlined"
                                      type="password"
                                      label="Password"
                                      margin="normal"
                                      value={password}
                                      onChange={(e) =>
                                        setPassword(e.target.value)
                                      }
                                    />
                                  </FormControl>
                                  <FormControl sx={{ m: 1, minWidth: 250 }}>
                                    <TextField
                                      required
                                      color={
                                        check !== "" && check === password
                                          ? "success"
                                          : "error"
                                      }
                                      variant="outlined"
                                      type="password"
                                      label="Reenter Password"
                                      margin="normal"
                                      value={check}
                                      onChange={(e) => setCheck(e.target.value)}
                                    />
                                  </FormControl>
                                </>
                              )}
                            </Box>
                          )}
                        {activeStep === lastStep && (
                          <Box display={"flex"} flexDirection={"column"}>
                            <FormControl sx={{ m: 1, minWidth: 250 }}>
                              <TextField
                                disabled={true}
                                variant="outlined"
                                type="text"
                                label="Name"
                                color="info"
                                value={name}
                              />
                            </FormControl>
                            <FormControl sx={{ m: 1, minWidth: 250 }}>
                              <TextField
                                disabled={true}
                                variant="outlined"
                                type="text"
                                label="Name"
                                color="info"
                                value={email}
                              />
                            </FormControl>
                            <Box display={"flex"}>
                              <FormControl sx={{ m: 1, minWidth: 150 }}>
                                <Roles
                                  disabled={true}
                                  name={role}
                                  onChange={(e) => setRole(e.target.value)}
                                />
                              </FormControl>
                              <FormControl sx={{ m: 1, minWidth: 150 }}>
                                <TextField
                                  disabled={true}
                                  variant="outlined"
                                  type="text"
                                  label="Phone Number"
                                  color="info"
                                  value={phoneNumber}
                                />
                              </FormControl>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </React.Fragment>
                  }
                </div>
              </Box>
            </DialogContent>
            <DialogActions
              sx={{
                justifyContent: "center",
              }}
            >
              <Box display={"flex"}>
                <Button
                  disabled={activeStep === 0 || disable === true}
                  onClick={handleBack}
                  variant="contained"
                  size="large"
                  sx={{
                    color: theme.palette.secondary[300],

                    margin: "0.5rem",
                    border: "solid 1px",
                    ":hover": {
                      backgroundColor: theme.palette.secondary[800],
                    },
                    ":disabled": {
                      backgroundColor: theme.palette.secondary[800],
                    },
                  }}
                >
                  Back
                </Button>
                {activeStep !== lastStep && (
                  <Button
                    onClick={handleNext}
                    variant="outlined"
                    fontWeight="bold"
                    sx={{
                      color: theme.palette.secondary[100],
                      // backgroundColor: theme.palette.secondary[300],
                      margin: "0.5rem  ",
                      border: "solid 0.5px",
                      ":hover": {
                        backgroundColor: theme.palette.secondary[300],
                      },
                      ":disabled": {
                        backgroundColor: theme.palette.secondary[300],
                      },
                    }}
                  >
                    Next
                  </Button>
                )}

                {activeStep === lastStep && (isAddButtonn || isEditButtonn) && (
                  <Button
                    type={"submit"}
                    disabled={disable}
                    variant="outlined"
                    fontWeight="bold"
                    sx={{
                      color: theme.palette.secondary[100],
                      // backgroundColor: theme.palette.secondary[300],
                      margin: "0.5rem  ",
                      border: "solid 0.5px",
                      ":hover": {
                        backgroundColor: theme.palette.secondary[300],
                      },
                      ":disabled": {
                        backgroundColor: theme.palette.secondary[300],
                      },
                    }}
                  >
                    {isAddButtonn && !isEditButtonn && <>Add Admin</>}
                    {!isAddButtonn && isEditButtonn && <>Edit Admin</>}
                  </Button>
                )}
              </Box>
            </DialogActions>
          </form>
        </Dialog>
      </div>
      {/**Add contractor dialogue ends
       *
       */}

      {/**Where the info goes */}
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
          loading={isPageAdminsLoading || !adminsPage}
          getRowId={(row) => row._id}
          rows={(adminsPage && adminsPage) || []}
          columns={columns}
          rowCount={totalCount || 0}
          rowsPerPageOptions={[25, 50, 100]}
          pagination
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          paginationMode="server"
          sortingMode="server"
          onPageChange={(newPage) => setPagee(newPage)}
          onPageSizeChange={(newPageSize) => setPageSizee(newPageSize)}
          onSortModelChange={(newSortModel) => setSort(...newSortModel)}
          components={{ Toolbar: DataGridCustomToolbar }}
          componentsProps={{
            toolbar: { searchInput, setSearchInput, setJobSearch, results },
          }}
        />
      </Box>
      {/**Where the info ends */}
    </Box>
  );
};

export default AdminsPage;
