import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
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
import Cities from "./Cities";
import axios from "axios";
import { server } from "server";

const AddCustomerPopup = ({
  open,
  activeStep,
  totalSteps,
  handleClose,
  selectedCustomer,
  isView,
  isEdit,
  isAddButton,
  isEditButton,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const { user } = useSelector((state) => state.user);
  const { success, error } = useSelector((state) => state.customers);

  const [disable, setDisable] = useState(false);
  const [disableSelect, setDisableSelect] = useState(false);
  const [view, setView] = useState(false);
  const [lastStep, setLastStep] = useState(0);

  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (isView) {
      setName(selectedCustomer.name);
      setPhoneNumber(selectedCustomer.phoneNumber);
      setCity(selectedCustomer.city);
      setAddress(selectedCustomer.address);

      setLastStep(totalSteps - 1);
setDisableSelect(true)
    }
  }, [isView, selectedCustomer]);
  useEffect(() => {
    if (isEdit) {
      setId(selectedCustomer._id);
      setName(selectedCustomer.name);
      setPhoneNumber(selectedCustomer.phoneNumber);
      setCity(selectedCustomer.city);
      setLastStep(totalSteps - 1);

      setAddress(selectedCustomer.address);
      setDisableSelect(false)
    }
  }, [isEdit, selectedCustomer]);

  useEffect(() => {
    if (error) {
      toast.error(error.message);
      dispatch({ type: "clearErrors" });
    }
    if (success) {
      toast.success("Customer added successfully");
      // onAddNewCustomer(newCustomer);
      handleClose();
      dispatch({ type: "clearMessages" });
      dispatch({ type: "loadCreateCustomerSuccess" });
    }
  }, [dispatch, error, success]);

  const handleSubmit = async (e) => {
    setDisable(false);
    e.preventDefault();

    const newForm = new FormData();

    newForm.append("id", id);
    newForm.append("name", name);
    newForm.append("city", city);
    newForm.append("phoneNumber", phoneNumber);
    newForm.append("address", address);
    newForm.append("companyId", user.companyId);
    if (name !== "" && address !== "") {
      if (isAddButton === true && isEditButton === false) {
        dispatch(createCustomer(newForm))
          .then(() => {
            handleClose();
            dispatch(getAllCustomersPage());
            dispatch({ type: "clearMessages" });
          })
          .catch((error) => {
            toast.error(error.response.message);
          });
      }
      if (isAddButton === false && isEditButton === true) {
        dispatch(updateCustomer(id, name, phoneNumber, city, address))
          .then(() => {
            toast.success("Customer updated successfully");
            handleClose();
            dispatch(getAllCustomersPage());
            dispatch({ type: "clearMessages" });
          })
          .catch((error) => {
            toast.error(error.response.data.message);
          });

        //edit the customer
      }
    } else {
      toast.error("Name or address missing");
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
            Customer
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
                <Box display={"flex"}>
                  <FormControl sx={{ m: 1, minWidth: 200 }}>
                    <Cities
                      name={city}
                      onChange={(e) => setCity(e.target.value)}
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
                      inputProps={{ maxLength: 13 }}
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                  </FormControl>
                </Box>

                <FormControl sx={{ m: 1, minWidth: 250 }}>
                  <TextField
                  disabled={disableSelect}
                    required
                    variant="outlined"
                    type="text"
                    label="Address"
                    color="info"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
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
                      {isAddButton && !isEditButton && <>Add Customer</>}
                      {!isAddButton && isEditButton && <>Edit Customer</>}
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

export default AddCustomerPopup;
