import * as React from "react";
import Box from "@mui/material/Box";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepButton from "@mui/material/StepButton";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import {
  Autocomplete,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  TextareaAutosize,
  useTheme,
} from "@mui/material";
import {
  Add,
  ChevronRightOutlined,
  GroupAddOutlined,
  Remove,
} from "@mui/icons-material";
import { useState } from "react";
import DateProvider from "component/deliverer/DateProvider";
import Header from "component/deliverer/Header";
import { toast } from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import AddCustomerPopup from "component/addCustomerPopup";
import { getAllCustomersDeliverer } from "redux/actions/customer";
import { getAllContractorsDeliverer } from "redux/actions/contractor";
import { createJob } from "redux/actions/job";
import { useEffect } from "react";
import { getAllVehiclesCompany } from "redux/actions/vehicle";
import { getAllDriversCompany } from "redux/actions/driver";
import { getRates } from "redux/actions/rate";

const steps = ["Order Details", "Company Info", "Preview"];

const AddJobPage = () => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const [isAddButtonn, setIsAddButtonn] = useState(true);
  const [isEditButtonn, setIsEditButtonn] = useState(false);

  const lastStep = steps.length - 1;
  //getting the states from our redux
  const { user } = useSelector((state) => state.user);
  const { success, error } = useSelector((state) => state.jobs);

  const { coVehicles, isCoVehLoading } = useSelector((state) => state.vehicles);
  const { coDrivers, isCoDrLoading } = useSelector((state) => state.drivers);
  const { rates, ratesLoading } = useSelector((state) => state.rates);

  useEffect(() => {
    if (error) {
      toast.error(error.message);
      dispatch({ type: "clearErrors" });
    }
    if (success) {
      toast.success("Job added successfully!");
      dispatch({ type: "clearMessages" });
      // handleResetInputs();
    }
  }, [dispatch, error, success]);

  useEffect(() => {
    dispatch(getAllCustomersDeliverer());
    dispatch(getAllContractorsDeliverer());
    dispatch(getAllVehiclesCompany());
    dispatch(getAllDriversCompany());
    dispatch(getRates());
  }, [dispatch]);

  const { delCustomers, isDelCustLoading } = useSelector(
    (state) => state.customers
  );
    const { delContractors, isContrDelLoading } = useSelector(
      (state) => state.contractors
    );
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


  //page control variables
  const [activeStep, setActiveStep] = React.useState(0);
  const [completed, setCompleted] = React.useState({});
  const [disable, setDisable] = useState(false);
  const [addCustomerOpen, setCustomerOpen] = useState(false);
  const [addedCustomer, setAddedCustomer] = useState("");

  //the customer info
  const [jobNum, setJobNum] = useState("");
  const [pageCustomer, setPageCustomer] = useState("");
  const [from, setFrom] = useState("");
  const [description, setDescription] = useState("");
  const [contractorId, setContractorId] = useState("");
  const [orderDate, setOrderDate] = useState(null);
  const [orderDatee, setOrderDatee] = useState(null);

  //the company info
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [deliveryType, setDeliveryType] = useState("");

  //the preview

  //logic for the steps
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
    if (
      // customer !== "" &&
      from !== "" &&
      pageCustomer !== "" &&
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
  const handleComplete = () => {
    const newCompleted = completed;
    newCompleted[activeStep] = true;
    setCompleted(newCompleted);
    handleNext();
  };
  const handleReset = () => {
    setActiveStep(0);
    setCompleted({});
  };

  //open the add customer popup
  const handleAddCustomer = () => {
    setCustomerOpen(true);
  };
  //close the add customer popup
  const handleAddCustomerClose = () => {
    setCustomerOpen(false);
  };

  //handling the costs and the destnations
  const [destinations, setDestinations] = useState([]);
  const [labels, setLabels] = useState([]);
  const [mileages, setMileages] = useState([]);

  //Handling the destinations
  const addAutocomplete = () => {
    setDestinations([...destinations, null]);
    setMileages([...mileages, ""]);
    setLabels([...labels, null]);
  };

  const handleAutocompleteChange = (index, selectedDest, newCustomer) => {
    const updatedDestinations = [...destinations];
    updatedDestinations[index] = selectedDest;
    if (newCustomer) {
      updatedDestinations[index] = newCustomer;
    }
    updatedDestinations[index] = selectedDest;
    setDestinations(updatedDestinations);

    const updatedLabels = [...labels];
    if (selectedDest === null) {
      updatedLabels[index] = "";
      setLabels(updatedLabels);
    } else {
      updatedLabels[index] = selectedDest.name;
      setLabels(updatedLabels);
    }
  };
  const removeAutocomplete = (index) => {
    const updatedDestinations = [...destinations];
    updatedDestinations.splice(index, 1);
    setDestinations(updatedDestinations);

    const updatedLabels = [...labels];
    updatedLabels.splice(index, 1);
    setLabels(updatedLabels);

    const updatedMileages = [...mileages];
    updatedMileages.splice(index, 1);
    setMileages(updatedMileages);
  };

  const handleUpdateMileage = (index, addMileage) => {
    //validate the milleage

    const updatedMileage = [...mileages];
    updatedMileage[index] = addMileage;
    setMileages(updatedMileage);
  };

  //total distance
  let totalDistance = 0;
  if (mileages.length > 0) {
    totalDistance = mileages[mileages.length - 1] - mileages[0];
  }

  //first get the size of the vehicle
  const getContractor = dContractors.find((d) => d._id === contractorId);
  let rate = 1;
  let totalCost = 0;
  let jobNumber = 0;
  let jobNu = "";
  let dVehicles = [];
  if (getContractor) {
    jobNumber = getContractor.lastOrder;
    jobNu = getContractor.prefix + jobNumber.toString().padStart(4, "0");
    if (!isCoVehLoading) {
    //  console.log(getContractor.vehiclesTypes);
      const vTypes = Array.isArray(getContractor.vehiclesTypes)
        ? getContractor.vehiclesTypes
        : [];
      dVehicles = coVehicles
        .flatMap((i) => i.vehicles)
        .filter((veh) => vTypes.includes(veh.size));

      
    }
  }
  //console.log(dVehicles);
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
      //console.log("rate not found");
    }
  } else {
    if (getContractor === undefined || getVehicle === undefined) {
    } else {
      toast.error("Enter contractor first");
    }
  }

  //handle the submitting of he jobs
  const [jobs, setJobs] = useState([]);

  const handleSubmit = (e) => {
    e.preventDefault();

    let x = 0;
    const newJobs = [];

    var orderDatte = new Date(orderDate);
    var localDate = new Date(
      orderDatte.getTime() - orderDatte.getTimezoneOffset() * 60000
    );

    while (x < destinations.length - 1) {
      let dist = mileages[x + 1] - mileages[x];
      const jobInfo = {
        jobNumber: jobNu,
        from: destinations[x]._id,
        customer: destinations[x + 1]._id,
        description: description,
        deliveryType: deliveryType,
        orderDate: localDate, // Use localDate instead of orderDatee
        contractorId: contractorId,
        delivererId: user.companyId,
        vehicleId: vehicleId,
        driverId: driverId,
        mileageOut: mileages[x],
        mileageIn: mileages[x + 1],
        distance: dist,
        cost: (rate * dist).toFixed(2),
      };

      newJobs.push(jobInfo);
      x = x + 1;
    }

    setJobs([...jobs, ...newJobs]);
    dispatch(createJob(newJobs))
      .then(() => {
        // handleResetInputs();
        dispatch(getAllContractorsDeliverer());
      })
      .catch((error) => {
        toast.error(error.response.data.message);
      });
  };


  //resetting the page to allow us to enter other jobs
  const handleResetInputs = () => {
    //initialising everything to ensure all fields are empty
    setJobNum(0);
    setFrom("");
    setPageCustomer("");
    setDestinations([]);
    setDescription("");
    setDeliveryType([]);
    setContractorId("");
    setOrderDate(null);
    setContractorId("");
    setVehicleId("");
    setDriverId("");
    setMileages([]);
    setCompleted({});
    setActiveStep(0);

    setIsEditButtonn(false);
    setIsAddButtonn(true);
    setDisable(false);
  };

  return (
    <>
      <Box m="0.1rem 5rem">
        <Box
          display="flex"
          margin={"auto"}
          flexDirection="column"
          alignItems={"center"}
          justifyContent={"center"}
        >
          {" "}
          <Header title="Add Job" />
        </Box>
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
              {allStepsCompleted() ? (
                <React.Fragment>
                  <Typography sx={{ mt: 1, mb: 1 }}>
                    All steps completed - you&apos;re finished
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: "row", pt: 2 }}>
                    <Box sx={{ flex: "1 1 auto" }} />
                    <Button onClick={handleReset}>Reset</Button>
                  </Box>
                </React.Fragment>
              ) : (
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
                          <FormControl sx={{ m: 1, minWidth: 150 }}>
                            <InputLabel id="demo-simple-select-autowidth-label">
                              Contractor
                            </InputLabel>
                            <Select
                              labelId="simple-select-autowidth-label"
                              id="demo-simple-select-autowidth"
                              value={contractorId}
                              onChange={(e) => setContractorId(e.target.value)}
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
                              labelId="simple-select-autowidth-label"
                              id="demo-simple-select-autowidth"
                              value={deliveryType}
                              onChange={(e) => setDeliveryType(e.target.value)}
                              autoWidth
                              label="Job Type"
                            >
                              {specificRates &&
                                specificRates.rateTypes &&
                                specificRates.rateTypes.map((r) => (
                                  <MenuItem key={r.rateType} value={r.rateType}>
                                    {r.rateType}
                                  </MenuItem>
                                ))}
                            </Select>
                          </FormControl>

                          <FormControl sx={{ m: 1, minWidth: 100 }}>
                            <DateProvider
                              title={"Order Date"}
                              date={orderDate}
                              onChange={(e) => setOrderDate(e)}
                              disabled={false}
                              isEditOrUpdate={false}
                            />
                          </FormControl>
                        </Box>
                        <Box display={"flex"}>
                          <FormControl sx={{ m: 1, minWidth: 525 }}>
                          <TextField
                    id="outlined-multiline-static"
                    label="Description"
                    multiline
                    rows={4}
                    defaultValue=""
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                          </FormControl>
                        </Box>

                        {/**The add customer */}

                        <div>
                          <FormControl sx={{ m: 1, minWidth: 100 }}>
                            <Box display="flex">
                              {destinations.length === 0 && (
                                <>
                                  <Button
                                    onClick={addAutocomplete}
                                    sx={{
                                      backgroundColor:
                                        theme.palette.secondary.light,
                                      color: theme.palette.background.alt,
                                      fontSize: "14px",
                                      fontWeight: "bold",
                                      padding: "10px 20px",
                                      ":hover": {
                                        backgroundColor:
                                          theme.palette.secondary[100],
                                      },
                                      mr: 1,
                                    }}
                                  >
                                    <Add sx={{ mr: "10px" }} />
                                    {destinations.length === 0 ? "From" : "To"}
                                  </Button>
                                </>
                              )}
                            </Box>
                          </FormControl>

                          <Box display="flex" flexDirection="column">
                            {Array.from({
                              length: Math.ceil(destinations.length / 2),
                            }).map((_, rowIndex) => (
                              <Box key={rowIndex} display="flex">
                                {destinations
                                  .slice(rowIndex * 2, rowIndex * 2 + 2)
                                  .map((value, index) => (
                                    <FormControl
                                      sx={{ m: 1, minWidth: 100 }}
                                      key={index}
                                    >
                                      <div>
                                        <Autocomplete
                                          disablePortal
                                          value={value}
                                          onChange={(event, selectedDest) =>
                                            handleAutocompleteChange(
                                              index + rowIndex * 2,
                                              selectedDest
                                            )
                                          }
                                          id={`combo-box-demo-${index}`}
                                          options={dCustomers}
                                          getOptionLabel={(customer) =>
                                            customer.name
                                          }
                                          isOptionEqualToValue={(
                                            option,
                                            value
                                          ) => option._id === value._id}
                                          sx={{ width: 250 }}
                                          renderInput={(params) => (
                                            <TextField
                                              {...params}
                                              label={
                                                index === 0 && rowIndex === 0
                                                  ? "From"
                                                  : "To"
                                              }
                                            />
                                          )}
                                        />
                                        <Button
                                          onClick={() =>
                                            removeAutocomplete(
                                              index + rowIndex * 2
                                            )
                                          }
                                          sx={{
                                            backgroundColor:
                                              theme.palette.secondary.light,
                                            color: theme.palette.background.alt,
                                            fontSize: "5px",
                                            fontWeight: "bold",
                                            padding: "10px 20px",
                                            ":hover": {
                                              backgroundColor:
                                                theme.palette.secondary[100],
                                            },
                                            mt: 1,
                                          }}
                                        >
                                          <Remove sx={{ mr: "10px" }} />
                                        </Button>
                                        {rowIndex ===
                                          Math.ceil(destinations.length / 2) -
                                            1 && (
                                          <>
                                            <Button
                                              onClick={addAutocomplete}
                                              sx={{
                                                backgroundColor:
                                                  theme.palette.secondary.light,
                                                color:
                                                  theme.palette.background.alt,
                                                fontSize: "14px",
                                                fontWeight: "bold",
                                                padding: "10px 20px",
                                                ":hover": {
                                                  backgroundColor:
                                                    theme.palette
                                                      .secondary[100],
                                                },
                                                ml: 11,
                                                mt: 1,
                                                visibility:
                                                  (index === 0 &&
                                                    destinations.length % 2 !==
                                                      0) ||
                                                  (index === 1 &&
                                                    destinations.length % 2 ===
                                                      0)
                                                    ? "visible"
                                                    : "hidden",
                                              }}
                                            >
                                              <Add sx={{ ml: "10px" }} />
                                              {destinations.length === 0
                                                ? "From"
                                                : "To"}
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    </FormControl>
                                  ))}
                              </Box>
                            ))}
                          </Box>
                        </div>
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
                        {Array.from({
                          length: Math.ceil(mileages.length / 2),
                        }).map((_, rowIndex) => (
                          <Box key={rowIndex} display="flex">
                            {mileages
                              .slice(rowIndex * 2, rowIndex * 2 + 2)
                              .map((value, index, array) => (
                                <FormControl
                                  sx={{ m: 1, minWidth: 100 }}
                                  key={index}
                                >
                                  <div>
                                    <Box display="flex" flexDirection="column">
                                      <label
                                        htmlFor="myInput"
                                        sx={{ mr: "20px" }}
                                      >
                                        {labels[rowIndex * 2 + index]}
                                      </label>
                                      <Box display="flex" alignItems="center">
                                        <TextField
                                          variant="outlined"
                                          type="text"
                                          inputMode="numeric"
                                          placeholder="Mileage Out"
                                          sx={{
                                            border: "solid",
                                            borderRadius: "5px",
                                            borderColor:
                                              //setting the validation for the first input
                                              value !== ""
                                                ? index + rowIndex === 0
                                                  ? "success"
                                                  : mileages[
                                                      index + rowIndex * 2
                                                    ] >
                                                    mileages[
                                                      index + rowIndex * 2 - 1
                                                    ]
                                                  ? "green"
                                                  : "red"
                                                : "lightgray",
                                          }}
                                          value={value}
                                          onChange={(event) =>
                                            handleUpdateMileage(
                                              index + rowIndex * 2,
                                              event.target.value
                                            )
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

                                        {!(
                                          rowIndex ===
                                            Math.ceil(destinations.length / 2) -
                                              1 && index === array.length - 1
                                        ) && (
                                          <ChevronRightOutlined
                                            sx={{ ml: "20px", mt: "10px" }}
                                          />
                                        )}
                                      </Box>
                                    </Box>
                                  </div>
                                </FormControl>
                              ))}
                          </Box>
                        ))}
                      </Box>
                    )}
                    {activeStep === 2 && (
                      <Box display={"flex"} flexDirection={"column"}>
                        <Box display={"flex"}>
                          <FormControl sx={{ m: 1, minWidth: 50 }}>
                            <TextField
                              disabled
                              label="Job Number"
                              id="outlined-start-adornment"
                              value={jobNu}
                            />
                          </FormControl>
                          <FormControl sx={{ m: 1, minWidth: 200 }}>
                            <TextField
                              variant="outlined"
                              type="text"
                              label="Vehicle "
                              color="info"
                              value={
                                getVehicle &&
                                getVehicle.make + " " + getVehicle.regNumber
                              }
                              disabled
                            />
                          </FormControl>
                          <FormControl sx={{ m: 1, minWidth: 100 }}>
                            <DateProvider
                              title={"Order Date"}
                              date={orderDate}
                              disabled={true}
                            />
                          </FormControl>
                        </Box>
                        {Array.from({
                          length: Math.ceil(destinations.length / 4),
                        }).map((_, rowIndex) => (
                          <Box key={rowIndex} display="flex">
                            {destinations
                              .slice(rowIndex * 4, rowIndex * 4 + 4)
                              .map((value, index, array) => (
                                <FormControl
                                  sx={{ m: 1, minWidth: 100 }}
                                  key={index}
                                >
                                  <div>
                                    <Box display="flex" flexDirection="column">
                                      <Box display="flex" alignItems="center">
                                        <label
                                          htmlFor="myInput"
                                          sx={{ mr: "20px" }}
                                        >
                                          {labels[rowIndex * 4 + index]}
                                        </label>
                                        {!(
                                          rowIndex ===
                                            Math.ceil(destinations.length / 4) -
                                              1 && index === array.length - 1
                                        ) && (
                                          <>
                                            <ChevronRightOutlined
                                              sx={{ ml: "5px" }}
                                            />
                                            <span
                                              style={{
                                                fontWeight: "bold",
                                                fontSize: "12px",
                                              }}
                                            >
                                              {mileages[
                                                rowIndex * 4 + index + 1
                                              ] -
                                                mileages[rowIndex * 4 + index]}
                                              km
                                            </span>
                                          </>
                                        )}
                                      </Box>
                                    </Box>
                                  </div>
                                </FormControl>
                              ))}
                          </Box>
                        ))}

                        <Box display={"flex"}>
                          <FormControl sx={{ m: 1, minWidth: 100 }}>
                            <TextField
                              disabled
                              variant="outlined"
                              type="text"
                              label="Total Distance"
                              color="info"
                              value={`${totalDistance} km`}
                            />
                          </FormControl>
                          <FormControl sx={{ m: 1, minWidth: 100 }}>
                            <TextField
                              disabled
                              variant="outlined"
                              type="text"
                              label="Rate"
                              color="info"
                              value={`$ ${rate} /km`}
                            />
                          </FormControl>
                          <FormControl sx={{ m: 1, minWidth: 100 }}>
                            <TextField
                              disabled
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

                      {activeStep === lastStep &&
                        (isAddButtonn || isEditButtonn) && (
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
                            {isAddButtonn && !isEditButtonn && <>Add Job</>}
                            {!isAddButtonn && isEditButtonn && <>Edit Job</>}
                          </Button>
                        )}
                    </Box>
                  </Box>
                </React.Fragment>
              )}
            </div>
          </Box>
        </form>
      </Box>
    </>
  );
};

export default AddJobPage;
