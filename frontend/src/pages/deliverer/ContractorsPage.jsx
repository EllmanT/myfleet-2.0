import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Typography,
  Rating,
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
  MenuItem,
  Select,
  InputLabel,
  IconButton,
  Input,
  DialogContentText,
} from "@mui/material";
import {
  AddBusiness,
  Business,
  Close,
  GroupAdd,
  Refresh,
  Search,
} from "@mui/icons-material";
import FlexBetween from "component/deliverer/FlexBetween";
import Header from "component/deliverer/Header";
import GoodsTypes from "component/deliverer/GoodsType";
import Cities from "component/Cities";
import { useDispatch, useSelector } from "react-redux";
import DeliveryTypes from "component/deliverer/DeliveryTypes";
import VehicleTypes from "component/deliverer/VehicleTypes";
import {
  createContractor,
  deleteContractor,
  getAllContractorsPage,
  updateContractor,
} from "redux/actions/contractor";
import toast from "react-hot-toast";
import Contractor from "component/Contractor";
import Store from "redux/store";
import DataGridCustomToolbar from "component/deliverer/DataGridCustomToolbar";
import { getRates } from "redux/actions/rate";
import { useNavigate } from "react-router-dom";

let steps = [];

const ContractorsPage = () => {
  const isNonMobile = useMediaQuery("(min-width: 1000px)");
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [isAddButtonn, setIsAddButtonn] = useState(false);
  const [isEditButtonn, setIsEditButtonn] = useState(false);
  const [isUpdateRates, setIsUpdateRate] = useState(false);
  const [disableSelect, setDisableSelect] = useState(false);
  const [lastStep, setLastStep] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState({});
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const [results, setResults] = useState("");
  const [totalContractors, setTotalContractors] = useState(0);
  const [view, setView] = useState("");

  const handleResetSearch = () => {
    setSearch("");
    setView("");
  };

  const { user } = useSelector((state) => state.user);
  const { rates, ratesLoading } = useSelector((state) => state.rates);
  const { pageContractors, error, success, isContrPageLoading } = useSelector(
    (state) => state.contractors
  );

  let dContractors = [];
  if (!isContrPageLoading) {
    dContractors = pageContractors ? pageContractors.flatMap((i) => i) : [];
  }
  useEffect(() => {
    if (page < 0) {
      setPage(0); // Reset to the first page if the value is negative
    } else {
      dispatch(
        getAllContractorsPage(page, pageSize, JSON.stringify(sort), search)
      );
    }
  }, [page, pageSize, sort, search, dispatch]);

  useEffect(() => {
    if (pageContractors) {
      if (totalContractors === 0) {
        setTotalContractors(pageContractors.length);
      }
      if (search === "") {
        setResults(pageContractors.length);
        setTotalContractors(pageContractors.length);
      }
      setResults(pageContractors.length);
    } else {
      setResults(0);
    }
  }, [pageContractors, totalContractors, search]);
  const [open, setOpen] = useState(false);
  const [disable, setDisable] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [contact, setContact] = useState("");
  const [prefix, setPrefix] = useState("");
  const [lastOrder, setLastOrder] = useState(0);
  const [goodsTypes, setGoodsTypes] = useState([]);
  const [vehiclesTypes, setVehiclesTypes] = useState([]);
  let [deliveryTypes, setDeliveryTypes] = useState([]);
  let [pageRates, setPageRates] = useState([]);
  const [compId, setCompId] = useState(0);
  const [rateId, setRateId] = useState("");

  //variables for the rates
  //s-small m-medium l-large h-horse v-vehicle r-rate l-local e-express
  const [svrl, setSvrl] = useState(0);
  const [mvrl, setMvrl] = useState(0);
  const [lvrl, setLvrl] = useState(0);
  const [hvrl, setHvrl] = useState(0);

  const [svre, setSvre] = useState(0);
  const [mvre, setMvre] = useState(0);
  const [lvre, setLvre] = useState(0);
  const [hvre, setHvre] = useState(0);

  //the steps
  const [activeStep, setActiveStep] = React.useState(0);
  let [completed, setCompleted] = React.useState({});

  useEffect(() => {
    if (error) {
      toast.error(error.message);
      dispatch({ type: "clearErrors" });
    }
    if (success) {
      toast.success("Contractor added successfully!");
      setOpen(false);
      dispatch({ type: "clearMessages" });
    }
  }, [dispatch, error, success]);

  const addRates = () => {
    if (deliveryTypes.includes("local")) {
      const rateType = deliveryTypes.find((type) => type === "local");
      console.log(deliveryTypes);
      if (rateType) {
        const newRate = {
          rateType: rateType,
          smallVehicle: svrl,
          mediumVehicle: mvrl,
          largeVehicle: lvrl,
          horse: hvrl,
        };

        console.log(newRate);
        pageRates.push(newRate);
      } else {
        toast.error("Failed rate type");
      }
    }
    if (deliveryTypes.includes("express")) {
      const rateType = deliveryTypes.find((type) => type === "express");

      if (rateType) {
        const newRate = {
          rateType: rateType,
          smallVehicle: svre,
          mediumVehicle: mvre,
          largeVehicle: lvre,
          horse: hvre,
        };
        console.log(newRate);

        pageRates.push(newRate);
      }
    }
  };

  const viewRates = (specificRates) => {
    const { rateTypes } = specificRates;

    //filter and process the different types of rates that are offered

    deliveryTypes = rateTypes.map((rate) => rate.rateType);
    // Filter and process 'local' rateTypes
    const localRateTypes = rateTypes.filter(
      (rateType) => rateType.rateType === "local"
    );
    if (localRateTypes.length > 0) {
      localRateTypes.forEach((rateType) => {
        const { smallVehicle, mediumVehicle, largeVehicle, horse } = rateType;
        // Display the values on the screen or store them in separate variables for 'local' rateTypes
        setSvrl(smallVehicle);
        setMvrl(mediumVehicle);
        setLvrl(largeVehicle);
        setHvrl(horse);
      });
    }

    // Filter and process 'express' rateTypes
    const expressRateTypes = rateTypes.filter(
      (rateType) => rateType.rateType === "express"
    );
    if (expressRateTypes.length > 0) {
      expressRateTypes.forEach((rateType) => {
        const { smallVehicle, mediumVehicle, largeVehicle, horse } = rateType;
        // Display the values on the screen or store them in separate variables for 'express' rateTypes
        setSvre(smallVehicle);
        setMvre(mediumVehicle);
        setLvre(largeVehicle);
        setHvre(horse);
      });
    }
  };
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

  const handleContractorDash = (contractorId) => {
    navigate(`/del-dash-contractor/${contractorId}`);
  };

  const handleNext = () => {
    const newActiveStep =
      isLastStep() && !allStepsCompleted()
        ? // It's the last step, but not all steps have been completed,
          // find the first step that has been completed
          steps.findIndex((step, i) => !(i in completed))
        : activeStep + 1;
    setActiveStep(newActiveStep);
    if (isAddButtonn || isEditButtonn || isUpdateRates) {
      stepChecker();
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);

    if (isAddButtonn || isEditButtonn || isUpdateRates) {
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
        contact !== "" &&
        goodsTypes.length !== 0 &&
        city !== "" &&
        address !== ""
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
      if (vehiclesTypes.length !== 0 && deliveryTypes.length !== 0) {
        const newCompleted = completed;
        newCompleted[activeStep] = true;
        setCompleted(newCompleted);
      } else {
        const newCompleted = completed;
        newCompleted[activeStep] = false;
        setCompleted(newCompleted);
      }
    }
    if (activeStep === 2) {
      if (
        svrl !== "" ||
        mvrl !== "" ||
        lvrl !== "" ||
        hvrl !== "" ||
        svre !== "" ||
        mvre !== "" ||
        lvre !== "" ||
        hvre !== ""
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

  const handleViewC = (contractorId) => {
    console.log(contractorId);
    const selectedContractor =
      pageContractors &&
      pageContractors.find((contractor) => contractor._id === contractorId);

    let specificRates = [];

    if (selectedContractor) {
      if (!ratesLoading) {
        specificRates = rates
          ? rates?.find(
              (r) =>
                r.deliverer === user.companyId && r.contractor === contractorId
            )
          : [];
      }
    }
    setSvrl(0);
    setMvrl(0);
    setLvrl(0);
    setHvrl(0);
    setSvre(0);
    setMvre(0);
    setLvre(0);
    setHvre(0);

    viewRates(specificRates);

    setCompanyName(selectedContractor.companyName);
    setContact(selectedContractor.contact);
    setAddress(selectedContractor.address);
    setPrefix(selectedContractor.prefix);
    setCity(selectedContractor.city);
    setGoodsTypes(selectedContractor.goodsTypes);
    setVehiclesTypes(selectedContractor.vehiclesTypes);
    setDeliveryTypes(selectedContractor.deliveryTypes);
    setPageRates(specificRates);
    steps = [];

    steps = ["General Details", "Requirements", "Rates"];
    setLastStep(steps.length - 1);

    setCompleted({});
    setIsUpdateRate(false);
    setIsAddButtonn(false);
    setIsEditButtonn(false);
    setActiveStep(0);
    setDisableSelect(true);
    //setDisable(true);
    setOpen(true);
    console.log(companyName);
  };

  const handleEditC = (contractorId) => {
    const selectedContractor =
      pageContractors &&
      pageContractors.find((contractor) => contractor._id === contractorId);

    let specificRates = [];

    if (selectedContractor) {
      if (!ratesLoading) {
        specificRates = rates
          ? rates?.find(
              (r) =>
                r.deliverer === user.companyId && r.contractor === contractorId
            )
          : [];
      }
    }
    setSvrl(0);
    setMvrl(0);
    setLvrl(0);
    setHvrl(0);
    setSvre(0);
    setMvre(0);
    setLvre(0);
    setHvre(0);

    viewRates(specificRates);
    setRateId(specificRates._id);
    setCompanyName(selectedContractor.companyName);
    setCompId(contractorId);
    setContact(selectedContractor.contact);
    setAddress(selectedContractor.address);
    setPrefix(selectedContractor.prefix);
    setCity(selectedContractor.city);
    setGoodsTypes(selectedContractor.goodsTypes);
    setVehiclesTypes(selectedContractor.vehiclesTypes);
    setDeliveryTypes(selectedContractor.deliveryTypes);
    setPageRates([]);
    steps = [];
    steps = ["General Details", "Requirements", "Rates", "Preview"];
    setLastStep(steps.length - 1);
    setActiveStep(0);
    setCompleted({});
    setIsUpdateRate(false);
    setIsEditButtonn(true);
    setIsAddButtonn(false);
    setDisable(false);
    setDisableSelect(false);
    setOpen(true);
  };

  const handleDelete = (contractorId) => {
    dispatch(deleteContractor(contractorId))
      .then(() => {
        toast.success("Contractor deleted successfully");
        dispatch(getAllContractorsPage());
      })
      .catch((error) => {
        toast.error(error.response.data.message);
      });
  };

  //the steps

  const handleClickOpen = () => {
    //initialising everything to ensure all fields are empty
    setCompanyName("");
    setCity("");
    setContact("");
    setAddress("");
    setPrefix("");
    setSvrl(0);
    setMvrl(0);
    setLvrl(0);
    setHvrl(0);
    setSvre(0);
    setMvre(0);
    setLvre(0);
    setHvre(0);

    setRateId("");
    setPageRates([]);
    setGoodsTypes([]);
    setVehiclesTypes([]);
    setDeliveryTypes([]);
    setCompleted({});
    setActiveStep(0);
    steps = [];
    steps = ["General Details", "Requirements", "Rates", "Preview"];

    setLastStep(steps.length - 1);

    setIsEditButtonn(false);
    setIsAddButtonn(true);
    setDisableSelect(false);
    setDisable(false);
    setOpen(true);
  };

  const handleClose = (event, reason) => {
    if (reason !== "backdropClick") {
      setOpen(false);
    }
  };

  //populating the rates object
  const handleSubmit = (e) => {
    addRates();
    setDisable(true);
    e.preventDefault();
    const stringRates = JSON.stringify(pageRates);
    console.log(stringRates);
    const newForm = new FormData();

    newForm.append("companyName", companyName);
    newForm.append("contact", contact);
    newForm.append("address", address);
    newForm.append("city", city);
    newForm.append("companyId", user.companyId);
    newForm.append("prefix", prefix);
    newForm.append("goodsTypes", goodsTypes);
    newForm.append("vehiclesTypes", vehiclesTypes);
    newForm.append("deliveryTypes", deliveryTypes);
    newForm.append("lastOrder", lastOrder);
    newForm.append("vrates", stringRates); // Convert rates to JSON string

    if (completed[0] && completed[1]) {
      if (isAddButtonn === true && isEditButtonn === false) {
        dispatch(createContractor(newForm))
          .then(() => {
            dispatch(getAllContractorsPage());
            dispatch(getRates());
            handleClose();
            dispatch({ type: "clearMessages" });
          })
          .catch((err) => {
            toast.error(err.response.message);
          });
      }

      if (isAddButtonn === false && isEditButtonn === true) {
        dispatch(
          updateContractor(
            compId,
            companyName,
            contact,
            city,
            address,
            prefix,
            goodsTypes,
            vehiclesTypes,
            deliveryTypes,
            rateId,
            stringRates
          )
        )
          .then(() => {
            toast.success("Contractor updated successfully");
            dispatch(getAllContractorsPage());
            dispatch(getRates());
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

  return (
    <Box m="1.5rem 2.5rem">
      <FlexBetween>
        <Header title="Contractors" subtitle="See all your contractors." />
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
            {dContractors.length}
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
      {/**Add contractor dialogue start */}
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
              <GroupAdd sx={{ mr: "10px", fontSize: "25px" }} />
              Contractor
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
                    <form onSubmit={handleSubmit}>
                      <Box
                        sx={{ mt: "0.5rem" }}
                        display="flex"
                        maxWidth={"400px"}
                        margin={"auto"}
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
                                value={companyName}
                                color="info"
                                onChange={(e) => setCompanyName(e.target.value)}
                              />
                            </FormControl>
                            <Box display={"flex"}>
                              <FormControl sx={{ m: 1, minWidth: 150 }}>
                                <TextField
                                  disabled={disableSelect}
                                  required
                                  variant="outlined"
                                  type="text"
                                  label="Company Tel / Cell Number"
                                  inputProps={{ maxLength: 13 }}
                                  color="info"
                                  value={contact}
                                  onChange={(e) => setContact(e.target.value)}
                                />
                              </FormControl>
                              <FormControl sx={{ m: 1, minWidth: 150 }}>
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
                            </Box>

                            <Box display={"flex"}>
                              <FormControl sx={{ m: 1, minWidth: 150 }}>
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
                            <FormControl sx={{ m: 1, maxWidth: 250 }}>
                              <Box>
                                <GoodsTypes
                                  selected={goodsTypes}
                                  onChange={setGoodsTypes}
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
                                disabled
                                variant="standard"
                                type="text"
                                label="Where are your customers?"
                                color="info"
                              />
                            </FormControl>

                            <FormControl sx={{ m: 1, minWidth: 250 }}>
                              <Box>
                                <DeliveryTypes
                                  selected={deliveryTypes}
                                  onChange={setDeliveryTypes}
                                  disabled={disableSelect}
                                />
                              </Box>
                            </FormControl>
                            <FormControl sx={{ m: 1, minWidth: 300 }}>
                              <TextField
                                disabled
                                variant="standard"
                                type="text"
                                label="What type of vehicles do you need?"
                                color="info"
                              />
                            </FormControl>

                            <FormControl sx={{ m: 1, minWidth: 250 }}>
                              <Box>
                                <VehicleTypes
                                  selected={vehiclesTypes}
                                  onChange={setVehiclesTypes}
                                  disabled={disableSelect}
                                />
                              </Box>
                            </FormControl>
                          </Box>
                        )}
                        {activeStep === 2 && (
                          <Box
                            display={"flex"}
                            flexDirection={"column"}
                            alignItems={"center"}
                          >
                            <h2>Agreed Local Rates</h2>
                            {deliveryTypes.includes("local") && (
                              <Box display="flex">
                                {vehiclesTypes.includes("smallVehicle") && (
                                  <FormControl sx={{ m: 1, minWidth: 50 }}>
                                    <TextField
                                      disabled={setDisableSelect}
                                      size="small"
                                      variant="outlined"
                                      type="text"
                                      label="Small Vehicle <5T"
                                      color="info"
                                      value={svrl === 0 ? "" : svrl}
                                      onChange={(e) => setSvrl(e.target.value)}
                                    />
                                  </FormControl>
                                )}
                                {vehiclesTypes.includes("mediumVehicle") && (
                                  <FormControl sx={{ m: 1, minWidth: 50 }}>
                                    <TextField
                                      disabled={setDisableSelect}
                                      size="small"
                                      variant="outlined"
                                      type="text"
                                      label="Medium Vehicle 5T-10T "
                                      color="info"
                                      value={mvrl === 0 ? "" : mvrl}
                                      onChange={(e) => setMvrl(e.target.value)}
                                    />
                                  </FormControl>
                                )}
                                {vehiclesTypes.includes("largeVehicle") && (
                                  <FormControl sx={{ m: 1, minWidth: 50 }}>
                                    <TextField
                                      disabled={setDisableSelect}
                                      size="small"
                                      variant="outlined"
                                      type="text"
                                      label="Large Vehicle 10T+"
                                      color="info"
                                      value={lvrl === 0 ? "" : lvrl}
                                      onChange={(e) => setLvrl(e.target.value)}
                                    />
                                  </FormControl>
                                )}
                                {vehiclesTypes.includes("horse") && (
                                  <FormControl sx={{ m: 1, minWidth: 50 }}>
                                    <TextField
                                      disabled={setDisableSelect}
                                      size="small"
                                      variant="outlined"
                                      type="text"
                                      label="Horse"
                                      color="info"
                                      value={hvrl === 0 ? "" : hvrl}
                                      onChange={(e) => setHvrl(e.target.value)}
                                    />
                                  </FormControl>
                                )}
                              </Box>
                            )}

                            <h2>Agreed Express Rates</h2>
                            {deliveryTypes.includes("express") && (
                              <Box display="flex">
                                {vehiclesTypes.includes("smallVehicle") && (
                                  <FormControl sx={{ m: 1, minWidth: 50 }}>
                                    <TextField
                                      disabled={setDisableSelect}
                                      size="small"
                                      variant="outlined"
                                      type="text"
                                      label="Small Vehicle <5T"
                                      color="info"
                                      value={svre === 0 ? "" : svre}
                                      onChange={(e) => setSvre(e.target.value)}
                                    />
                                  </FormControl>
                                )}
                                {vehiclesTypes.includes("mediumVehicle") && (
                                  <FormControl sx={{ m: 1, minWidth: 50 }}>
                                    <TextField
                                      disabled={setDisableSelect}
                                      size="small"
                                      variant="outlined"
                                      type="text"
                                      label="Medium Vehicle 5T-10T "
                                      color="info"
                                      value={mvre === 0 ? "" : mvre}
                                      onChange={(e) => setMvre(e.target.value)}
                                    />
                                  </FormControl>
                                )}
                                {vehiclesTypes.includes("largeVehicle") && (
                                  <FormControl sx={{ m: 1, minWidth: 50 }}>
                                    <TextField
                                      disabled={setDisableSelect}
                                      size="small"
                                      variant="outlined"
                                      type="text"
                                      label="Large Vehicle 10T+"
                                      color="info"
                                      value={lvre === 0 ? "" : lvre}
                                      onChange={(e) => setLvre(e.target.value)}
                                    />
                                  </FormControl>
                                )}
                                {vehiclesTypes.includes("horse") && (
                                  <FormControl sx={{ m: 1, minWidth: 50 }}>
                                    <TextField
                                      disabled={setDisableSelect}
                                      size="small"
                                      variant="outlined"
                                      type="text"
                                      label=" Horse"
                                      color="info"
                                      value={hvre === 0 ? "" : hvre}
                                      onChange={(e) => setHvre(e.target.value)}
                                    />
                                  </FormControl>
                                )}
                              </Box>
                            )}
                            <Box display={"flex"}></Box>
                          </Box>
                        )}
                        {activeStep === 3 && (
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
                                  selected={goodsTypes}
                                  onChange={setGoodsTypes}
                                />
                              </Box>
                            </FormControl>
                            <Box display={"flex"}>
                              <Box display={"flex"} flexDirection={"column"}>
                                <FormControl sx={{ m: 1, minWidth: 150 }}>
                                  <TextField
                                    size="small"
                                    disabled
                                    variant="standard"
                                    type="text"
                                    label="What vehicles do you need?"
                                    color="info"
                                  />
                                </FormControl>

                                <FormControl sx={{ m: 1, minWidth: 150 }}>
                                  <Box>
                                    <VehicleTypes
                                      disabled={true}
                                      selected={vehiclesTypes}
                                      onChange={setVehiclesTypes}
                                    />
                                  </Box>
                                </FormControl>
                              </Box>
                              <Box display={"flex"} flexDirection={"column"}>
                                <FormControl sx={{ m: 1, minWidth: 150 }}>
                                  <TextField
                                    size="small"
                                    disabled
                                    variant="standard"
                                    type="text"
                                    label="Where are you customers?"
                                    color="info"
                                  />
                                </FormControl>

                                <FormControl sx={{ m: 1, minWidth: 150 }}>
                                  <Box>
                                    <DeliveryTypes
                                      disabled={true}
                                      selected={deliveryTypes}
                                      onChange={deliveryTypes}
                                    />
                                  </Box>
                                </FormControl>
                              </Box>
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
                                    backgroundColor:
                                      theme.palette.secondary[300],
                                  },
                                  ":disabled": {
                                    backgroundColor:
                                      theme.palette.secondary[300],
                                  },
                                }}
                              >
                                {isAddButtonn && !isEditButtonn && (
                                  <>Add Contractor</>
                                )}
                                {!isAddButtonn && isEditButtonn && (
                                  <>Edit Contractor</>
                                )}
                              </Button>
                            )}
                        </Box>
                      </Box>
                    </form>
                  </React.Fragment>
                }
              </div>
            </Box>
          </DialogContent>
          <DialogActions></DialogActions>
        </Dialog>
      </div>
      {/**Add contractor dialogue ends
       *
       *
       */}
      <Box display="flex" alignItems="flex-end">
        <FormControl sx={{ m: 0.5, minWidth: 150 }}>
          {/** THis will come in the update
          <InputLabel id="contractor-select-label">Filter </InputLabel>
          <Select
            labelId="contractor-select-label"
            id="contractor-select"
            value={filter}
            size="small"
          >
            <MenuItem value="all" selected>
              All Field
            </MenuItem>
          </Select>
           */}
        </FormControl>
        <FormControl sx={{ m: 0.5, minWidth: 150 }}>
          {/** This feature will be in an update
          <InputLabel id="delivery-type-select-label">Sort</InputLabel>
          <Select
            labelId="delivery-type-select-label"
            id="delivery-type-select"
            value={sort}
            size="small"
          >
            <MenuItem value="asc" selected>
              Ascending
            </MenuItem>
            <MenuItem value="desc">Descending</MenuItem>

          </Select>
           */}
        </FormControl>

        <FlexBetween />
        <Box sx={{ display: "flex", alignItems: "flex-end", ml: 15, mb: 0.5 }}>
          <Button
            variant="outlined"
            color="info"
            sx={{ mr: "0.5rem" }}
            onClick={handleResetSearch}
          >
            <Refresh />
          </Button>
          <Button
            variant="outlined"
            color="info"
            sx={{ minWidth: 200, mr: "1rem" }}
          >
            {view !== "" ? (
              <>
                <b>{view} </b> <span>&nbsp;</span> : <span>&nbsp;</span>{" "}
                {results}
              </>
            ) : (
              <>
                Results <span>&nbsp;</span> : <span>&nbsp;</span> {results}
              </>
            )}
          </Button>
          <FormControl>
            <Input
              placeholder="Search"
              onChange={(e) => setJobSearch(e.target.value)}
              value={jobSearch}
              endAdornment={
                <IconButton
                  onClick={() => {
                    setSearch(jobSearch);
                    setView(jobSearch);

                    setJobSearch("");
                  }}
                >
                  <Search />
                </IconButton>
              }
            />{" "}
          </FormControl>
        </Box>
      </Box>

      {/**Where the info goes */}
      <Box>
        {dContractors && !isContrPageLoading ? (
          <Box
            mt="20px"
            display="grid"
            gridTemplateColumns="repeat(4, minmax(0, 1fr))"
            justifyContent="space-between"
            rowGap="20px"
            columnGap="1.33%"
            sx={{
              "& > div": { gridColumn: isNonMobile ? undefined : "span 4" },
            }}
          >
            {dContractors.map(
              ({
                _id,
                companyName,
                address,
                city,
                phoneNumber,
                lastOrder,
                vehiclesTypes,
                deliveryTypes,
                goodsTypes,
                prefix,
              }) => (
                <Contractor
                  key={_id}
                  _id={_id}
                  companyName={companyName}
                  address={address}
                  city={city}
                  phoneNumber={phoneNumber}
                  lastOrder={lastOrder}
                  vehiclesTypes={vehiclesTypes}
                  deliveryTypes={deliveryTypes}
                  goodsTypes={goodsTypes}
                  prefix={prefix}
                  contact={contact}
                  handleView={handleViewC}
                  handleEdit={handleEditC}
                  handleDelete={handleDelete}
                  handleContractorDash={handleContractorDash}
                />
              )
            )}
          </Box>
        ) : (
          <>Loading...</>
        )}
      </Box>
      {/**Where the info ends */}
    </Box>
  );
};

export default ContractorsPage;
