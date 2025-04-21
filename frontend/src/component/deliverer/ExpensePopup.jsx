import React, { useEffect, useState } from "react";
import {
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
  TextField,
  useTheme,
} from "@mui/material";
import { Close, GroupAdd } from "@mui/icons-material";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import {
  createCustomer,
  getAllCustomersPage,
  updateCustomer,
} from "redux/actions/customer";
import axios from "axios";
import { server } from "server";
import DateProvider from "./DateProvider";
import {
  creatEmployeeExpense,
  createVehicleExpense,
  getAllExpensesEmployee,
  getAllExpensesVehicle,
  updateEmployeeExpense,
  updateExpense,
  updateVehicleExpense,
} from "redux/actions/expense";

const ExpensesPopup = ({
  open,

  handleClose,
  selectedExpense,
  driverId,
  vehicleId,
  isView,
  isEdit,
  isAddButton,
  isEditButton,
  isEmployeeExpense,
  isVehicleExpense,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const { user } = useSelector((state) => state.user);
  const { success, error } = useSelector((state) => state.customers);
  const { coVehicles, isCoVehLoading } = useSelector((state) => state.vehicles);
  const { coDrivers, isCoDrLoading } = useSelector((state) => state.drivers);

  let dDrivers = [];
  if (!isCoDrLoading) {
    dDrivers = coDrivers ? coDrivers.flatMap((i) => i.drivers) : [];
  }
  let dVehicles = [];
  if (!isCoVehLoading) {
    dVehicles = coVehicles ? coVehicles.flatMap((i) => i.vehicles) : [];
  }

  const [disable, setDisable] = useState(false);
  const [disableSelect, setDisableSelect] = useState(false);
  const [disableSelectDriver, setDisableSelectDriver] = useState(false);
  const [disableSelectVehicle, setDisableSelectVehicle] = useState(false);
  const [view, setView] = useState(false);
  const [lastStep, setLastStep] = useState(0);

  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [expenseDate, setExpenseDate] = useState(null);
  const [expenseDatee, setExpenseDatee] = useState(null);
  const [cost, setCost] = useState("");
  const [driverIdd, setDriverIdd] = useState("");
  const [vehicleIdd, setVehicleIdd] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (isAddButton) {
      if (isVehicleExpense) {
        setVehicleIdd(vehicleId);
        setDisableSelectVehicle(true);
        setDisableSelectDriver(false);
      }
      if (isEmployeeExpense) {
        setDriverIdd(driverId);
        //setDisableSelectVehicle(false);
        setDisableSelectDriver(true);
      }
    }
  }, [isEdit, selectedExpense]);
  useEffect(() => {
    if (isView && isVehicleExpense) {
      setVehicleIdd(selectedExpense.vehicleId);
      setDriverIdd(selectedExpense.driverId);
      setExpenseDate(selectedExpense.date);
      setDescription(selectedExpense.description);
    }
    if (isView && isEmployeeExpense) {
      // setVehicleIdd(selectedExpense.vehicleId);
      setDriverIdd(selectedExpense.driverId);
      setExpenseDate(selectedExpense.date);
      setDescription(selectedExpense.description);
    }
  }, [isView, selectedExpense]);
  useEffect(() => {
    if (isEdit) {
      setVehicleIdd(selectedExpense.vehicleId);
      setDriverIdd(selectedExpense.driverId);
      setExpenseDate(selectedExpense.date);
      setDescription(selectedExpense.description);

      setDisableSelect(false);
    }
  }, [isEdit, selectedExpense]);

  useEffect(() => {
    if (error) {
      toast.error(error.message);
      dispatch({ type: "clearErrors" });
    }
    if (success) {
      toast.success("Expense added successfully");
      // onAddNewCustomer(newCustomer);
      handleClose();
      dispatch({ type: "clearMessages" });
      dispatch({ type: "loadCreateCustomerSuccess" });
    }
  }, [dispatch, error, success]);

  const handleSubmit = async (e) => {
    setDisable(false);
    e.preventDefault();

    var orderDatte = new Date(expenseDate);
    var localDate = new Date(
      orderDatte.getTime() - orderDatte.getTimezoneOffset() * 60000
    );

    var employeeId = driverIdd;

    const newForm = new FormData();

    newForm.append("id", id);
    newForm.append("vehicleId", vehicleIdd);
    newForm.append("employeeId", employeeId);
    newForm.append("driverId", driverIdd);
    newForm.append("cost", cost);
    newForm.append("date", localDate);
    newForm.append("description", description);
    newForm.append("companyId", user.companyId);
    // console.log(newForm)
    if (vehicleId !== "" && expenseDate !== "") {
      if (isAddButton === true && isEditButton === false) {
        if (isVehicleExpense) {
          dispatch(createVehicleExpense(newForm))
            .then(() => {
              toast.success("Vehicle Expense added successfully!");
              //dispatch(getAllExpensesVehicle(vehicleId));
              //handleClose();
              console.log(newForm);
              dispatch({ type: "clearMessages" });
            })
            .catch((error) => {
              toast.error(error.response.message);
            });
        }
        if (isEmployeeExpense) {
          dispatch(creatEmployeeExpense(newForm))
            .then(() => {
              toast.success("Employee Expense added successfully!");
              dispatch(getAllExpensesEmployee(employeeId));
              //handleClose();
              console.log(newForm);
              dispatch({ type: "clearMessages" });
            })
            .catch((error) => {
              toast.error(error.response.message);
            });
        }
      }
      if (isAddButton === false && isEditButton === true) {
        if (isVehicleExpense) {
          dispatch(updateVehicleExpense(vehicleId, driverId, cost, description))
            .then(() => {
              toast.success("Expense updated successfully");
              handleClose();
              dispatch(getAllExpensesVehicle());
              dispatch({ type: "clearMessages" });
            })
            .catch((error) => {
              toast.error(error.response.data.message);
            });
        }
        if (isEmployeeExpense) {
          dispatch(updateEmployeeExpense(employeeId, cost, description))
            .then(() => {
              toast.success("Expense updated successfully");
              handleClose();
              dispatch(getAllExpensesEmployee());
              dispatch({ type: "clearMessages" });
            })
            .catch((error) => {
              toast.error(error.response.data.message);
            });
        }

        //edit the customer
      }
    } else {
      toast.error("Fill in everything missing");
      setDisable(false);
    }
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
            <GroupAdd sx={{ mr: "10px", fontSize: "25px" }} />
            Expense
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
            <Box
              sx={{ mt: "0.5rem" }}
              display="flex"
              maxWidth={"400px"}
              margin={"auto"}
              flexDirection="column"
              alignItems={"center"}
              justifyContent={"center"}
            >
              <Box display={"flex"} flexDirection={"column"}>
                <Box display={"flex"}>
                  <FormControl sx={{ m: 1, minWidth: 200 }}>
                    <DateProvider
                      title={"Expense Date"}
                      date={expenseDate}
                      onChange={(e) => setExpenseDate(e)}
                      disabled={false}
                      isEditOrUpdate={false}
                    />
                  </FormControl>
                  <FormControl sx={{ m: 1, minWidth: 200 }}>
                    <TextField
                      disabled={disableSelect}
                      required
                      variant="outlined"
                      type="text"
                      label="Cost"
                      color="info"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                    />
                  </FormControl>
                </Box>

                <Box display={"flex"}>
                  <FormControl sx={{ m: 1, minWidth: 200 }}>
                    <InputLabel id="demo-simple-select-autowidth-label">
                      Driver
                    </InputLabel>
                    <Select
                      disabled={disableSelectDriver}
                      labelId="simple-select-autowidth-label"
                      id="demo-simple-select-autowidth"
                      value={driverIdd}
                      onChange={(e) => setDriverIdd(e.target.value)}
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
                  {isEmployeeExpense && <></>}
                  {isVehicleExpense && (
                    <FormControl sx={{ m: 1, minWidth: 200 }}>
                      <InputLabel id="demo-simple-select-autowidth-label">
                        Vehicle
                      </InputLabel>
                      <Select
                        disabled={disableSelectVehicle}
                        labelId="simple-select-autowidth-label"
                        id="demo-simple-select-autowidth"
                        value={vehicleIdd}
                        onChange={(e) => setVehicleIdd(e.target.value)}
                        autoWidth
                        label="Driver"
                      >
                        {dVehicles.map((vehicle) => (
                          <MenuItem key={vehicle._id} value={vehicle._id}>
                            {vehicle.make} {vehicle.regNumber}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                </Box>

                <FormControl sx={{ m: 1, minWidth: 250 }}>
                  <TextField
                    id="outlined-multiline-static"
                    label="Reason"
                    multiline
                    rows={4}
                    defaultValue=""
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </FormControl>

                <Box display={"flex"} sx={{ m: "1rem 3rem " }}>
                  <Button
                    disabled={disable}
                    onClick={handleClose}
                    variant="contained"
                    size="large"
                    sx={{
                      color: theme.palette.secondary[300],

                      margin: "1rem",
                      border: "solid 1px",
                      ":hover": {
                        backgroundColor: theme.palette.secondary[900],
                      },
                      ":disabled": {
                        backgroundColor: theme.palette.secondary[900],
                      },
                    }}
                  >
                    Close
                  </Button>
                  {(isAddButton || isEditButton) && (
                    <Button
                      disabled={disable}
                      type="submit"
                      variant="outlined"
                      fontWeight="bold"
                      sx={{
                        color: theme.palette.secondary[100],
                        //backgroundColor: theme.palette.secondary[300],
                        margin: "1rem  ",
                        border: "solid 0.5px",
                        ":hover": {
                          //700 looks nicest for the dark theme and 300 best for light mode fix//
                          backgroundColor: theme.palette.secondary[300],
                        },
                        ":disabled": {
                          backgroundColor: theme.palette.secondary[300],
                        },
                      }}
                    >
                      {isAddButton && !isEditButton && <>Add Expense</>}
                      {!isAddButton && isEditButton && <>Edit Expense</>}
                    </Button>
                  )}
                </Box>
              </Box>
            </Box>
          </form>
        </DialogContent>
        <DialogActions></DialogActions>
      </Dialog>
    </div>
  );
};

export default ExpensesPopup;
