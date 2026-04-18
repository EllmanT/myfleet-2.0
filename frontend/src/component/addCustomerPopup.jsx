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
  onCustomerCreated,
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

  const resetFormState = () => {
    setId("");
    setName("");
    setPhoneNumber("");
    setCity("");
    setAddress("");
    setDisable(false);
    setDisableSelect(false);
    setView(false);
    setLastStep(0);
  };

  const getUiErrorMessage = (err) => {
    if (typeof err === "string") {
      return err;
    }

    return (
      err?.response?.data?.message ||
      err?.message ||
      "Customer request failed. Please try again."
    );
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    dispatch({ type: "clearErrors" });
    dispatch({ type: "clearMessages" });

    if (isAddButton && !isEditButton) {
      resetFormState();
    }
  }, [dispatch, isAddButton, isEditButton, open]);

  useEffect(() => {
    if (isView) {
      setName(selectedCustomer.name);
      setPhoneNumber(selectedCustomer.phoneNumber);
      setCity(selectedCustomer.city);
      setAddress(selectedCustomer.address);

      setLastStep(totalSteps - 1);
      setDisableSelect(true);
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
      setDisableSelect(false);
    }
  }, [isEdit, selectedCustomer]);

  useEffect(() => {
    if (error) {
      toast.error(getUiErrorMessage(error));
      dispatch({ type: "clearErrors" });
    }
    if (success) {
      toast.success("Customer added successfully");
      dispatch({ type: "clearMessages" });
    }
  }, [dispatch, error, success]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (disable) {
      return;
    }

    const newForm = new FormData();

    newForm.append("id", id);
    newForm.append("name", name);
    newForm.append("city", city);
    newForm.append("phoneNumber", phoneNumber);
    newForm.append("address", address);
    newForm.append("companyId", user.companyId);
    if (name !== "" && address !== "") {
      setDisable(true);
      if (isAddButton === true && isEditButton === false) {
        try {
          const result = await dispatch(createCustomer(newForm));
          if (typeof onCustomerCreated === "function") {
            onCustomerCreated(result?.customer || null);
          }
          resetFormState();
          handleClose();
          dispatch(getAllCustomersPage());
          dispatch({ type: "clearMessages" });
        } catch (error) {
          // Error toast is handled by the global customer error effect.
        } finally {
          setDisable(false);
        }
      }
      if (isAddButton === false && isEditButton === true) {
        try {
          await dispatch(updateCustomer(id, name, phoneNumber, city, address));
          toast.success("Customer updated successfully");
          handleClose();
          dispatch(getAllCustomersPage());
          dispatch({ type: "clearMessages" });
        } catch (error) {
          toast.error(getUiErrorMessage(error));
        } finally {
          setDisable(false);
        }

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
