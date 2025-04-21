import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Typography,
  useTheme,
  useMediaQuery,
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
} from "@mui/material";
import {
  AddBusiness,
  AddToQueue,
  Business,
  Close,
  EditSharp,
  GroupAdd,
  Visibility,
} from "@mui/icons-material";
import FlexBetween from "component/deliverer/FlexBetween";
import Header from "component/deliverer/Header";
import GoodsTypes from "component/deliverer/GoodsType";
import Cities from "component/Cities";
import { useDispatch, useSelector } from "react-redux";
import VehicleTypes from "component/deliverer/VehicleTypes";
import DeliveryTypes from "component/deliverer/DeliveryTypes";
import {
  createDeliverer,
  getAllDeliverersPage,
  updateDeliverer,
} from "redux/actions/deliverer";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { DataGrid, GridDeleteIcon } from "@mui/x-data-grid";
import DataGridCustomToolbar from "component/deliverer/DataGridCustomToolbar";

const steps = ["General Details", "Rates", "Preview"];

const DeliverersPage = () => {
  const isNonMobile = useMediaQuery("(min-width: 1000px)");
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [isAddButtonn, setIsAddButtonn] = useState(false);
  const [isEditButtonn, setIsEditButtonn] = useState(false);
  const [addedAdmin, setAddedAdmin] = useState("");
  const [chosenDeliverer, setChosenDeliverer] = useState({});
  const [isView, setIsView] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [lastStep, setLastStep] = useState(0);
  const [disableSelect, setDisableSelect] = useState(false);

  const [pagee, setPagee] = useState(1);
  const [pageSizee, setPageSizee] = useState(20);
  const [sort, setSort] = useState({});
  const [search, setJobSearch] = useState("");
  const [results, setResults] = useState("");
  const [totalDeliverers, setTotalDeliverers] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const { deliverersPage, totalCount, isPageDeliverersLoading } = useSelector(
    (state) => state.deliverers
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
        getAllDeliverersPage(page, pageSize, JSON.stringify(sort), search)
      );
    }
  }, [page, pageSize, sort, search, dispatch]);

  useEffect(() => {
    if (deliverersPage) {
      if (totalDeliverers === 0) {
        setTotalDeliverers(deliverersPage.length);
      }
      if (search === "") {
        setResults(deliverersPage.length);
      }
      setResults(deliverersPage.length);
    } else {
      setResults(0);
    }
  }, [deliverersPage, totalDeliverers, search]);

  const { success, error } = useSelector((state) => state.deliverers);
  const [open, setOpen] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [goodsType, setGoodsType] = useState([]);
  const [vehiclesType, setVehiclesType] = useState([]);
  const [deliveryType, setDeliveryType] = useState([]);
  const [city, setCity] = useState("");
  const [prefix, setPrefix] = useState("");
  const [companyId, setCompanyId] = useState("");

  //the steps
  const [activeStep, setActiveStep] = React.useState(0);
  let [completed, setCompleted] = React.useState({});

  const [disable, setDisable] = useState(false);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
    if (success) {
      toast.success("Deliverer created successfully");
      navigate("/del-deliverers");
      window.location.reload();
    }
  }, [dispatch, error, success]);

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
    if (isAddButtonn || isEditButtonn) {
      stepChecker();
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    if (isAddButtonn || isEditButtonn) {
      stepChecker();
    }
  };

  const handleStep = (step) => () => {
    setActiveStep(step);
  };

  //handle the changes from step to step check to see if step is complete
  const stepChecker = () => {
    if (activeStep === 0) {
      if (
        companyName !== "" &&
        city !== "" &&
        address !== "" &&
        goodsType.length !== 0
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
      if (vehiclesType.length !== 0 && deliveryType.length !== 0) {
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

  const handleClickOpen = () => {
    setCompanyName("");
    setAddress("");
    setCity("");
    setPrefix("");
    setCompanyId("");
    setGoodsType([]);
    setVehiclesType([]);
    setDeliveryType([]);
    setCompleted({});
    setLastStep(steps.length - 1);
    setActiveStep(0);
    setIsAddButtonn(true);
    setIsEditButtonn(false);
    setDisable(false);
    setDisableSelect(false);
    setOpen(true);
  };

  const handleDelete = () => {};
  const handleView = (delivererId) => {
    const selectedDeliverer =
      deliverersPage &&
      deliverersPage.find((deliverer) => deliverer._id === delivererId);
    setCompanyId(selectedDeliverer._id);
    setCompanyName(selectedDeliverer.companyName);
    setContact(selectedDeliverer.contact);
    setAddress(selectedDeliverer.address);
    setPrefix(selectedDeliverer.prefix);
    setCity(selectedDeliverer.city);
    setGoodsType(selectedDeliverer.goodsType);
    setVehiclesType(selectedDeliverer.vehiclesType);
    setDeliveryType(selectedDeliverer.deliveryType);
    // setPageRates(selectedDeliverer.v);
    setLastStep(steps.length - 1);
    setActiveStep(0);
    setCompleted({});
    setDisableSelect(true);
    setIsAddButtonn(false);
    setIsEditButtonn(false);
    setOpen(true);
  };

  const handleEdit = (delivererId) => {
    const selectedDeliverer =
      deliverersPage &&
      deliverersPage.find((deliverer) => deliverer._id === delivererId);
    setCompanyId(selectedDeliverer._id);
    setCompanyName(selectedDeliverer.companyName);
    setContact(selectedDeliverer.contact);
    setAddress(selectedDeliverer.address);
    setPrefix(selectedDeliverer.prefix);
    setCity(selectedDeliverer.city);
    setGoodsType(selectedDeliverer.goodsType);
    setVehiclesType(selectedDeliverer.vehiclesType);
    setDeliveryType(selectedDeliverer.deliveryType);
    //setPageRates(selectedDeliverer.v);
    setLastStep(steps.length - 1);
    completed = setActiveStep(0);
    setDisable(false);
    setDisableSelect(false);
    setIsEditButtonn(true);
    setIsAddButtonn(false);
    setOpen(true);
  };

  const handleClose = (event, reason) => {
    if (reason !== "backdropClick") {
      setOpen(false);
    }
  };

  const handleSubmit = async (e) => {
    setDisable(true);

    e.preventDefault();

    const newForm = new FormData();

    newForm.append("id", companyId);
    newForm.append("companyName", companyName);
    newForm.append("address", address);
    newForm.append("city", city);
    newForm.append("prefix", prefix);
    newForm.append("goodsType", goodsType);
    newForm.append("vehiclesType", vehiclesType);
    newForm.append("deliveryType", deliveryType);
    if (completed[0] && completed[1]) {
      if (isAddButtonn === true && isEditButtonn === false) {
        dispatch(createDeliverer(newForm)).then(() => {
          dispatch(getAllDeliverersPage());
          handleClose();
          dispatch({ type: "clearMessages" });
        });
      }

      if (isAddButtonn === false && isEditButtonn === true) {
        dispatch(
          updateDeliverer(
            companyId,
            companyName,
            contact,
            city,
            address,
            prefix,
            goodsType,
            vehiclesType,
            deliveryType
          )
        )
          .then(() => {
            toast.success("Deliverer updated successfully");
            dispatch(getAllDeliverersPage());
            handleClose();
            dispatch({ type: "clearMessages" });
          })
          .catch((error) => {
            toast.error(error.response.data.message);
          });

        //edit the customer
      }
    } else {
      toast.error("fill in all fields");
      setDisable(false);
    }
  };

  const columns = [
    {
      field: "companyName",
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
      field: "contact",
      headerName: "Contact",
      flex: 1.5,
      sortable: false,
    },
    {
      field: "totalJobs",
      headerName: "Total Jobs",
      flex: 1.5,
      sortable: false,
    },
    {
      field: "totalIncome",
      headerName: "Total Income",
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
            onClick={() => handleDelete(params.row._id)}
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
        <Header title="Deliverers" subtitle="See all your deliverers." />
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
            onClick={handleClickOpen}
          >
            <Business sx={{ mr: "10px" }} />
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
            <AddBusiness sx={{ mr: "10px" }} />
            Add
          </Button>
        </Box>
      </FlexBetween>
      {/**Add Deliverer dialogue start */}
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
                Deliverer
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
                                label="Company Name"
                                color="info"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                              />
                            </FormControl>
                            <Box display={"flex"}>
                              <FormControl sx={{ m: 1, minWidth: 180 }}>
                                <Cities
                                  name={city}
                                  onChange={(e) => setCity(e.target.value)}
                                  disabled={disableSelect}
                                />
                              </FormControl>
                              <FormControl sx={{ m: 1, minWidth: 250 }}>
                                <TextField
                                  disabled={disableSelect}
                                  required
                                  variant="outlined"
                                  type="text"
                                  label="Address"
                                  value={address}
                                  onChange={(e) => setAddress(e.target.value)}
                                  color="info"
                                />
                              </FormControl>
                            </Box>
                            <FormControl sx={{ m: 1, minWidth: 250 }}>
                              <TextField
                                disabled
                                variant="standard"
                                type="text"
                                label="Select the type of goods that you manufacture/sell?"
                                color="info"
                              />
                            </FormControl>
                            <FormControl sx={{ m: 1, minWidth: 250 }}>
                              <Box>
                                <GoodsTypes
                                  selected={goodsType}
                                  onChange={setGoodsType}
                                  disabled={disableSelect}
                                />
                              </Box>
                            </FormControl>
                          </Box>
                        )}

                        {activeStep === 1 && (
                          <Box display={"flex"} flexDirection={"column"}>
                            <FormControl sx={{ m: 1, minWidth: 250 }}>
                              <TextField
                                disabled={disableSelect}
                                required
                                variant="outlined"
                                type="text"
                                label="Prefix letters only! (e.g JN0001 , LM0002)"
                                color="info"
                                value={prefix}
                                onChange={(e) =>
                                  setPrefix(
                                    e.target.value
                                      .toUpperCase()
                                      .replace(/[^a-zA-Z\s]/g, "")
                                  )
                                }
                                inputProps={{ maxLength: 4 }}
                              />
                            </FormControl>
                            <FormControl sx={{ m: 1, minWidth: 300 }}>
                              <TextField
                                disabled
                                variant="standard"
                                type="text"
                                label="What type of vehicles do you have?"
                                color="info"
                              />
                            </FormControl>

                            <FormControl sx={{ m: 1, minWidth: 250 }}>
                              <Box>
                                <VehicleTypes
                                  selected={vehiclesType}
                                  onChange={setVehiclesType}
                                  disabled={disableSelect}
                                />
                              </Box>
                            </FormControl>

                            <FormControl sx={{ m: 1, minWidth: 250 }}>
                              <TextField
                                disabled
                                variant="standard"
                                type="text"
                                label="Where can you deliver to?"
                                color="info"
                              />
                            </FormControl>

                            <FormControl sx={{ m: 1, minWidth: 250 }}>
                              <Box>
                                <DeliveryTypes
                                  selected={deliveryType}
                                  onChange={setDeliveryType}
                                  disabled={disableSelect}
                                />
                              </Box>
                            </FormControl>
                          </Box>
                        )}
                        {activeStep === 2 && (
                          <Box display={"flex"} flexDirection={"column"}>
                            <FormControl sx={{ m: 1, minWidth: 250 }}>
                              <TextField
                                size="small"
                                variant="outlined"
                                type="text"
                                label="Company Name"
                                color="info"
                                value={companyName}
                                disabled
                              />
                            </FormControl>
                            <FormControl sx={{ m: 1, minWidth: 250 }}>
                              <Box>
                                <GoodsTypes
                                  disabled={true}
                                  selected={goodsType}
                                  onChange={setGoodsType}
                                />
                              </Box>
                            </FormControl>
                            <Box display={"flex"}>
                              <Box display={"flex"} flexDirection={"column"}>
                                <FormControl sx={{ m: 1, minWidth: 150 }}>
                                  <TextField
                                    size="small"
                                    disabled={true}
                                    variant="standard"
                                    type="text"
                                    label="What  vehicles do you have?"
                                    color="info"
                                  />
                                </FormControl>

                                <FormControl sx={{ m: 1, minWidth: 150 }}>
                                  <Box>
                                    <VehicleTypes
                                      disabled={true}
                                      selected={vehiclesType}
                                      onChange={setVehiclesType}
                                    />
                                  </Box>
                                </FormControl>
                              </Box>
                              <Box display={"flex"} flexDirection={"column"}>
                                <FormControl sx={{ m: 1, minWidth: 150 }}>
                                  <TextField
                                    size="small"
                                    disabled={true}
                                    variant="standard"
                                    type="text"
                                    label="Where can you deliver?"
                                    color="info"
                                  />
                                </FormControl>

                                <FormControl sx={{ m: 1, minWidth: 150 }}>
                                  <Box>
                                    <DeliveryTypes
                                      disabled={true}
                                      selected={deliveryType}
                                      onChange={deliveryType}
                                    />
                                  </Box>
                                </FormControl>
                              </Box>
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
      {/**Add Deliverer dialogue ends
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
          loading={isPageDeliverersLoading || !deliverersPage}
          getRowId={(row) => row._id}
          rows={(deliverersPage && deliverersPage) || []}
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

export default DeliverersPage;
