import { ChevronRightOutlined, Close, Edit } from "@mui/icons-material";
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Step,
  StepButton,
  Stepper,
  TextField,
  TextareaAutosize,
  useTheme,
} from "@mui/material";
import { DataGrid, GridDeleteIcon } from "@mui/x-data-grid";
import { CalendarIcon } from "@mui/x-date-pickers";
import AddCustomerPopup from "component/addCustomerPopup";
import DataGridCustomToolbar from "component/deliverer/DataGridCustomToolbar";
import FlexBetween from "component/deliverer/FlexBetween";
import Header from "component/deliverer/Header";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { getAllJobsPage, updateJob } from "redux/actions/job";
import DateProvider from "./DateProvider";
import toast from "react-hot-toast";
import { getAllCustomersDeliverer } from "redux/actions/customer";
import { getAllVehiclesCompany } from "redux/actions/vehicle";
import { getAllDriversCompany } from "redux/actions/driver";
import { getRates } from "redux/actions/rate";
import { getAllContractorsDeliverer } from "redux/actions/contractor";

let steps = [];

const UpdateJobPopup = ({
  open,
  isDisableInput,
  handleClose,
  selectedJob,
  isView,
  isEdit,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  //getting the states from our redux
  const { user } = useSelector((state) => state.user);
  const { success, error } = useSelector((state) => state.jobs);
  const { coVehicles, isCoVehLoading } = useSelector((state) => state.vehicles);
  const { coDrivers, isCoDrLoading } = useSelector((state) => state.drivers);
  const { rates, ratesLoading } = useSelector((state) => state.rates);

  const { delCustomers, isDelCustLoading } = useSelector(
    (state) => state.customers
  );
  const { delContractors, isContrDelLoading } = useSelector(
    (state) => state.contractors
  );

  useEffect(() => {
    dispatch(getAllCustomersDeliverer());
    dispatch(getAllContractorsDeliverer());
    dispatch(getAllVehiclesCompany());
    dispatch(getAllDriversCompany());
    dispatch(getRates());
  }, [dispatch]);
  //creating the arrays for the deliverer info S
  let dCustomers = [];
  if (!isDelCustLoading) {
    dCustomers = delCustomers ? delCustomers.flatMap((i) => i.customers) : [];
  }


  let dContractors = [];
  if (!isContrDelLoading) {
    dContractors = delContractors
      ? delContractors.flatMap((i) => i.contractors)
      : [];
  }

  let dDrivers = [];
  if (!isCoDrLoading) {
    dDrivers = coDrivers ? coDrivers.flatMap((i) => i.drivers) : [];
  }

  const [isEditButtonn, setIsEditButtonn] = useState(false);
  const [lastStep, setLastStep] = useState("");
  const [disableSelect, setDisableSelect] = useState(false);

  //page control variables
  const [activeStep, setActiveStep] = React.useState(0);
  const [completed, setCompleted] = React.useState({});
  const [disable, setDisable] = useState(false);

  //the customer info
  const [jobId, setJobId] = useState("");
  const [jobNum, setJobNum] = useState("");
  const [pageJob, setPageJob] = useState("");
  const [pageCustomerId, setPageCustomerId] = useState("");
  const [fromId, setFromId] = useState("");
  const [pageCustomer, setPageCustomer] = useState("");
  const [from, setFrom] = useState("");
  const [description, setDescription] = useState("");
  const [contractorId, setContractorId] = useState("");
  const [orderDate, setOrderDate] = useState(null);
  const [mileageIn, setMileageIn] = useState("");
  const [mileageOut, setMileageOut] = useState("");
  const [deliveryType, setDeliveryType] = useState("");
  const [distance, setDistance] = useState("");
  const [cost, setCost] = useState("");
  const [defaultDate, setDefaultDate] = useState(null);

  //the company info
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");

  var viewDate;
  useEffect(() => {
    if (error) {
      toast.error(error.message);
      dispatch({ type: "clearErrors" });
    }
    if (success) {
      toast.success("Job added successfully!");
      dispatch({ type: "clearMessages" });
    }
  }, [dispatch, error, success]);

  //dealing with the editing
  useEffect(() => {
    if (isView) {
      setJobNum(selectedJob.jobNumber);
      setFrom(selectedJob.from);
      setPageCustomer(selectedJob.customer);
      setFromId(selectedJob.from._id);
      setPageCustomerId(selectedJob.customer._id);
      setDescription(selectedJob.description);
      setVehicleId(selectedJob.vehicleId);
      setContractorId(selectedJob.contractorId._id);
      setDriverId(selectedJob.driverId);
      setMileageIn(selectedJob.mileageIn);
      setMileageOut(selectedJob.mileageOut);
      setDeliveryType(selectedJob.deliveryType);
      setCost(selectedJob.cost);
      setDistance(selectedJob.distance);
      setLastStep(totalSteps - 1);
      setDefaultDate(selectedJob.orderDate);
      setActiveStep(0);

      setIsEditButtonn(false);
      setDisableSelect(true);
      steps = [];
      steps = ["Order Details", "Company Info"];
      setLastStep(steps.length - 1);
    }
  }, [isView, selectedJob]);

  //dealing with the updating
  useEffect(() => {
    if (isEdit) {
      setJobId(selectedJob._id);
      setJobNum(selectedJob.jobNumber);
      setFrom(selectedJob.from);
      setPageCustomer(selectedJob.customer);
      setFromId(selectedJob.from._id);
      setPageCustomerId(selectedJob.customer._id);
      setDescription(selectedJob.description);
      setVehicleId(selectedJob.vehicleId);
      setContractorId(selectedJob.contractorId._id);
      setDriverId(selectedJob.driverId);
      setMileageIn(selectedJob.mileageIn);
      setMileageOut(selectedJob.mileageOut);
      setDeliveryType(selectedJob.deliveryType);
      setCost(selectedJob.cost);
      setDistance(selectedJob.distance);
      setDefaultDate(selectedJob.orderDate);

      setActiveStep(0);
      setIsEditButtonn(true);
      setDisableSelect(false);
      steps = [];
      steps = ["Order Details", "Company Info", "Preview"];
      setLastStep(steps.length - 1);
    }
  }, [isEdit, selectedJob]);

  console.log(dCustomers);
  console.log(fromId, "from");
  console.log(pageCustomerId, "customer");

  //the preview

  //logic for the steps
  const totalSteps = () => {
    return steps.length;
  };

  const isLastStep = () => {
    return activeStep === totalSteps() - 1;
  };

  const handleNext = () => {
    const newActiveStep = isLastStep()
      ? // It's the last step, but not all steps have been completed,
        // find the first step that has been completed
        steps.findIndex((step, i) => !(i in completed))
      : activeStep + 1;
    setActiveStep(newActiveStep);
    if (
      // Job !== "" &&
      from !== "" &&
      pageJob !== "" &&
      contractorId !== "" &&
      orderDate !== null
    ) {
      const newCompleted = completed;
      newCompleted[activeStep] = true;
      setCompleted(newCompleted);
    }
  };
  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };
  const handleStep = (step) => () => {
    setActiveStep(step);
  };

  //calculations for the total distance and total cost
  //total distance
  let totalDistance = mileageIn - mileageOut;

  //first get the size of the vehicle
  const getContractor = dContractors.find((d) => d._id === contractorId);
  let rate = 1;
  let totalCost = 0;
  let jobNumber = 0;
  let jobNu = "";
  let dVehicles = [];
  if (getContractor) {
    jobNumber = getContractor.lastOrder + 202;
    jobNu = getContractor.prefix + jobNumber.toString().padStart(4, "0");
    if (!isCoVehLoading) {
      const vTypes = Array.isArray(getContractor.vehiclesTypes)
        ? getContractor.vehiclesTypes
        : [];
      dVehicles = coVehicles
        .flatMap((i) => i.vehicles)
        .filter((veh) => vTypes.includes(veh.size));
    }
  }
  const getVehicle = dVehicles.find((v) => v._id === vehicleId);

  let specificRates = [];

  if (getContractor) {
    if (!ratesLoading) {
      specificRates = rates
        ? rates?.find(
            (r) =>
              r.deliverer === user.companyId && r.contractor === contractorId
          )
        : [];
    }
  }

  if (getContractor && getVehicle) {
    const checkRateType = specificRates.rateTypes.find(
      (r) => r.rateType === deliveryType
    );
    if (checkRateType) {
      rate = checkRateType[getVehicle.size];
      totalCost = (totalDistance * rate).toFixed(2);
    } else {
    }
  } else {
    if (getContractor === undefined || getVehicle === undefined) {
    } else {
      toast.error("Enter contractor first");
    }
  }

  //handle the submitting of the updated job

  const handleSubmit = (e) => {
    e.preventDefault();
    setDisableSelect(true);

    // Assuming you have the orderDate variable defined somewhere in your code
    // and it holds the desired date value
    // var orderDate = ...;

    var orderDatte = new Date(orderDate);
    var localDate = new Date(
      orderDatte.getTime() - orderDatte.getTimezoneOffset() * 60000
    );

    var dDate = new Date(defaultDate);
    // localDate = JSON.stringify(localDate);
    // var dDate = JSON.stringify(defaultDate);

    var orderDatee;
    if (isEditButtonn === true) {
      if (orderDate === null) {
        orderDatee = defaultDate;
      } else {
        orderDatee = localDate.toISOString();
      }

      dispatch(
        updateJob(
          jobId,
          jobNum,
          from._id,
          pageCustomer._id,
          description,
          vehicleId,
          contractorId,
          driverId,
          mileageIn,
          mileageOut,
          deliveryType,
          totalCost,
          totalDistance,
          orderDatee
        )
      )
        .then(() => {
          toast.success("Job updated successfully");
          handleResetInputs();

          dispatch(getAllJobsPage());
          dispatch({ type: "clearMessages" });
        })
        .catch((error) => {
          toast.error(error.response.data.message);
        });

      // edit the customer
    }
  };
  console.log(from)
  console.log(fromId)
  //resetting the page to allow us to enter other jobs
  const handleResetInputs = () => {
    //initialising everything to ensure all fields are empty
    setJobNum(0);
    setFrom("");
    setPageCustomer("");
    setDescription("");
    setContractorId("");
    setContractorId("");
    setVehicleId("");
    setDriverId("");
    setMileageIn("");
    setMileageOut("");
    setCompleted({});
    setOrderDate(null);
    setActiveStep(0);
    setDeliveryType([]);

    setIsEditButtonn(false);
    setDisable(false);
    handleClose();
  };

  return (
    <div>
      <Dialog disableEscapeKeyDown open={open} onClose={handleClose}>
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
            <Edit sx={{ mr: "10px", fontSize: "20px" }} />
            J/N :{jobNum}
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
          <form onSubmit={handleSubmit}>
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
                      maxWidth={"600px"}
                      padding={"20px 20px 20px 20px"}
                      margin={"auto"}
                      flexDirection="column"
                      alignItems={"center"}
                      justifyContent={"center"}
                      borderRadius={"20px"}
                      border="solid 1px"
                      borderColor={"#cca752"}
                      boxShadow={"1px 1px 2px #cca752"}
                    >
                      {activeStep === 0 && (
                        <Box display={"flex"} flexDirection={"column"}>
                          <Box display={"flex"}>
                            <FormControl sx={{ m: 1, minWidth: 50 }}>
                              <TextField
                                disabled={disableSelect}
                                label="Job Number"
                                id="outlined-start-adornment"
                                value={jobNum}
                              />
                            </FormControl>
                            <FormControl sx={{ m: 1, minWidth: 200 }}>
                              <InputLabel id="demo-simple-select-autowidth-label">
                                Contractor
                              </InputLabel>
                              <Select
                                disabled={disableSelect}
                                labelId="simple-select-autowidth-label"
                                id="demo-simple-select-autowidth"
                                value={contractorId}
                                onChange={(e) =>
                                  setContractorId(e.target.value)
                                }
                                autoWidth
                                label="Contractor"
                              >
                                {dContractors &&
                                  dContractors.map((contractor) => (
                                    <MenuItem
                                      key={contractor._id}
                                      value={contractor._id}
                                    >
                                      {contractor.companyName}
                                    </MenuItem>
                                  ))}
                              </Select>
                            </FormControl>

                            <FormControl sx={{ m: 1, minWidth: 100 }}>
                              <InputLabel id="demo-simple-select-autowidth-label">
                                Job Type
                              </InputLabel>
                              <Select
                                disabled={disableSelect}
                                labelId="simple-select-autowidth-label"
                                id="demo-simple-select-autowidth"
                                value={deliveryType}
                                onChange={(e) =>
                                  setDeliveryType(e.target.value)
                                }
                                autoWidth
                                label="Job Type"
                              >
                                {specificRates &&
                                  specificRates.rateTypes &&
                                  specificRates.rateTypes.map((r) => (
                                    <MenuItem
                                      key={r.rateType}
                                      value={r.rateType}
                                    >
                                      {r.rateType}
                                    </MenuItem>
                                  ))}
                              </Select>
                            </FormControl>
                          </Box>

                          <Box display="flex">
                            <FormControl sx={{ m: 1, minWidth: 100 }}>
                              <div>
                                <Autocomplete
                                  disabled={disableSelect}
                                  disablePortal
                                  value={from}
                                  onChange={(e, newValue) => setFrom(newValue)}
                                  id={`combo-box-demo`}
                                  options={dCustomers}
                                  getOptionLabel={(from) => (from && from.name) || "Unknown Customer"}
                                  isOptionEqualToValue={(option, value) =>
                                    option._id === value._id
                                  }
                                  sx={{ width: 250 }}
                                  renderInput={(params) => (
                                    <TextField {...params} label={"From"} />
                                  )}
                                />
                              </div>
                            </FormControl>
                            <FormControl sx={{ m: 1, minWidth: 100 }}>
                              <div>
                                <Autocomplete
                                  disabled={disableSelect}
                                  disablePortal
                                  value={pageCustomer}
                                  onChange={(e, newValue) => setPageCustomer(newValue)}
                                  id={`combo-box-demo`}
                                  options={dCustomers}
                                  getOptionLabel={(customer) => (customer && customer.name) || "Unknown Customer"}
                                  isOptionEqualToValue={(option, value) =>
                                    option._id === value._id
                                  }
                                  sx={{ width: 250 }}
                                  renderInput={(params) => (
                                    <TextField {...params} label={"To"} />
                                  )}
                                />
                              </div>
                            </FormControl>
                          </Box>
                          <Box display={"flex"}>
                            <Box display={"flex"}>
                              <FormControl sx={{ m: 1, minWidth: 300 }}>
                                <TextareaAutosize
                                  disabled={disableSelect}
                                  required
                                  placeholder="Order details"
                                  minRows={8}
                                  size="lg"
                                  variant="outlined"
                                  value={description}
                                  onChange={(e) =>
                                    setDescription(e.target.value)
                                  }
                                />
                              </FormControl>
                            </Box>
                            <Box display={"flex"} flexDirection={"column"}>
                              <FormControl sx={{ m: 1, minWidth: 100 }}>
                                <DateProvider
                                  title={"Order Date"}
                                  date={orderDate}
                                  defaultDate={defaultDate}
                                  onChange={(e) => setOrderDate(e)}
                                  disabled={disableSelect}
                                  isEditOrUpdate={true}
                                />
                              </FormControl>

                              <Box display={"flex"}>
                                <FormControl sx={{ m: 1, maxWidth: 100 }}>
                                  <TextField
                                    disabled={true}
                                    variant="outlined"
                                    type="text"
                                    label="Total Cost"
                                    color="info"
                                    value={`${distance} km `}
                                  />
                                </FormControl>
                                <FormControl sx={{ m: 1, maxWidth: 100 }}>
                                  <TextField
                                    disabled={true}
                                    variant="outlined"
                                    type="text"
                                    label="Total Cost"
                                    color="info"
                                    value={`$ ${cost} `}
                                  />
                                </FormControl>
                              </Box>
                            </Box>
                          </Box>

                          {/**The add customer */}
                        </Box>
                      )}

                      {activeStep === 1 && (
                        <Box display={"flex"} flexDirection={"column"}>
                          <Box display={"flex"}>
                            <FormControl sx={{ m: 1, minWidth: 250 }}>
                              <InputLabel id="demo-simple-select-autowidth-label">
                                Driver
                              </InputLabel>
                              <Select
                                disabled={disableSelect}
                                labelId="simple-select-autowidth-label"
                                id="demo-simple-select-autowidth"
                                value={driverId}
                                onChange={(e) => setDriverId(e.target.value)}
                                autoWidth
                                label="Driver"
                              >
                                {dDrivers.map((driver) => (
                                  <MenuItem key={driver._id} value={driver._id}>
                                    {driver.name}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <FormControl sx={{ m: 1, minWidth: 250 }}>
                              <InputLabel id="demo-simple-select-autowidth-label">
                                Vehicle
                              </InputLabel>
                              <Select
                                disabled={disableSelect}
                                labelId="simple-select-autowidth-label"
                                id="demo-simple-select-autowidth"
                                value={vehicleId}
                                onChange={(e) => setVehicleId(e.target.value)}
                                autoWidth
                                label="Driver"
                              >
                                {!getContractor ? (
                                  <MenuItem>Select contractor first</MenuItem>
                                ) : (
                                  dVehicles.map((vehicle) => (
                                    <MenuItem
                                      key={vehicle._id}
                                      value={vehicle._id}
                                    >
                                      {vehicle.make} {vehicle.regNumber}
                                    </MenuItem>
                                  ))
                                )}
                              </Select>
                            </FormControl>
                          </Box>

                          <Box display="flex">
                            <FormControl sx={{ m: 1, minWidth: 100 }}>
                              <Box
                                display="flex"
                                flexDirection={"column"}
                                alignItems="center"
                              >
                                <label htmlFor="myInput" sx={{ mr: "20px" }}>
                                  {from.name}
                                </label>
                                <TextField
                                  disabled={disableSelect}
                                  variant="outlined"
                                  type="text"
                                  inputMode="numeric"
                                  label="Mileage In"
                                  value={mileageOut}
                                  onChange={(e) =>
                                    setMileageOut(e.target.value)
                                  }
                                  inputProps={{
                                    maxLength: 6,
                                    pattern: "[0-9]*",
                                    onKeyPress: (event) => {
                                      const keyValue = event.key;

                                      if (!/^\d$/.test(keyValue)) {
                                        event.preventDefault();
                                      }
                                    },
                                  }}
                                />
                              </Box>
                            </FormControl>
                            <FormControl sx={{ mt: 1, ml: 4 }}>
                              <Box
                                display="flex"
                                flexDirection={"column"}
                                alignItems="center"
                              >
                                <ChevronRightOutlined sx={{ mt: 5 }} />
                              </Box>
                            </FormControl>
                            <FormControl sx={{ mt: 1, ml: 4, minWidth: 100 }}>
                              <Box
                                display="flex"
                                flexDirection={"column"}
                                alignItems="center"
                              >
                                <label htmlFor="myInput" sx={{ mr: "20px" }}>
                                  {pageCustomer.name}
                                </label>
                                <TextField
                                  disabled={disableSelect}
                                  variant="outlined"
                                  type="text"
                                  inputMode="numeric"
                                  label="Mileage In"
                                  value={mileageIn}
                                  onChange={(e) => setMileageIn(e.target.value)}
                                  inputProps={{
                                    maxLength: 6,
                                    pattern: "[0-9]*",
                                    onKeyPress: (event) => {
                                      const keyValue = event.key;

                                      if (!/^\d$/.test(keyValue)) {
                                        event.preventDefault();
                                      }
                                    },
                                  }}
                                />
                              </Box>
                            </FormControl>
                          </Box>
                          <Box display={"flex"}>
                            <FormControl sx={{ m: 1, minWidth: 50 }}>
                              <TextField
                                disabled={true}
                                variant="outlined"
                                type="text"
                                label="Total Distance"
                                color="info"
                                value={` ${totalDistance} km`}
                              />
                            </FormControl>
                            <FormControl sx={{ m: 1, minWidth: 50 }}>
                              <TextField
                                disabled={true}
                                variant="outlined"
                                type="text"
                                label="Rate"
                                color="info"
                                value={`$ ${rate} /km`}
                              />
                            </FormControl>
                            <FormControl sx={{ m: 1, minWidth: 100 }}>
                              <TextField
                                disabled={true}
                                variant="outlined"
                                type="text"
                                label="Total Cost"
                                color="info"
                                value={`$ ${totalCost} `}
                              />
                            </FormControl>
                          </Box>
                        </Box>
                      )}
                      {activeStep === 2 && (
                        <Box display={"flex"} flexDirection={"column"}>
                          <Box display={"flex"}>
                            <FormControl sx={{ m: 1, minWidth: 100 }}>
                              <TextField
                                disabled={true}
                                label="Job Number"
                                id="outlined-start-adornment"
                                value={jobNu}
                              />
                            </FormControl>
                            <FormControl sx={{ m: 1, minWidth: 100 }}>
                              <DateProvider
                                title={"Order Date"}
                                date={orderDate}
                                defaultDate={defaultDate}
                                disabled={true}
                                isEditOrUpdate={true}
                              />
                            </FormControl>
                            <FormControl sx={{ m: 1, minWidth: 100 }}>
                              <TextField
                                variant="outlined"
                                type="text"
                                label="Vehicle "
                                color="info"
                                value={
                                  getVehicle &&
                                  getVehicle.make + " " + getVehicle.regNumber
                                }
                                disabled={true}
                              />
                            </FormControl>
                          </Box>

                          <Box display="flex" justifyContent={"center"}>
                            <label htmlFor="myInput">{from.name}</label>

                            <>
                              <ChevronRightOutlined sx={{ ml: 4, mr: 4 }} />
                              <span
                                style={{
                                  fontWeight: "bold",
                                  fontSize: "12px",
                                }}
                              ></span>
                            </>

                            <label htmlFor="myInput">{pageCustomer.name}</label>
                          </Box>

                          <Box display={"flex"}>
                            <FormControl sx={{ m: 1, minWidth: 100 }}>
                              <TextField
                                disabled={true}
                                variant="outlined"
                                type="text"
                                label="Total Distance"
                                color="info"
                                value={` ${totalDistance} km`}
                              />
                            </FormControl>
                            <FormControl sx={{ m: 1, minWidth: 100 }}>
                              <TextField
                                disabled={true}
                                variant="outlined"
                                type="text"
                                label="Rate"
                                color="info"
                                value={`$ ${rate} /km`}
                              />
                            </FormControl>
                            <FormControl sx={{ m: 1, minWidth: 100 }}>
                              <TextField
                                disabled={true}
                                variant="outlined"
                                type="text"
                                label="Total Cost"
                                color="info"
                                value={`$ ${totalCost} `}
                              />
                            </FormControl>
                          </Box>
                        </Box>
                      )}
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

                        {activeStep === lastStep && isEditButtonn && (
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
                            {isEditButtonn && <>Edit Job</>}
                          </Button>
                        )}
                      </Box>
                    </Box>
                  </React.Fragment>
                }
              </div>
            </Box>
          </form>
        </DialogContent>
        <DialogActions></DialogActions>
      </Dialog>
    </div>
  );
};

export default UpdateJobPopup;
