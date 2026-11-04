import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  Input,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { DataGrid, GridSearchIcon } from "component/deliverer/AgDataGrid";
import {
  Add,
  CircleOutlined,
  Close,
  FileUpload,
  Group,
  GroupAdd,
  Groups2Outlined,
  Refresh,
  Search,
} from "@mui/icons-material";
import FlexBetween from "component/deliverer/FlexBetween";
import Header from "component/deliverer/Header";
import EmptyState from "component/deliverer/EmptyState";
import Cities from "component/Cities";
import DocumentField from "component/deliverer/DocumentField";
import { MuiFileInput } from "mui-file-input";
import { useDispatch, useSelector } from "react-redux";
import {
  createDriver,
  deleteDriver,
  getAllDriversPage,
  updateDriver,
} from "redux/actions/driver";
import { toast } from "react-hot-toast";
import Driver from "component/deliverer/Driver";
import Store from "redux/store";
import { useNavigate } from "react-router-dom";

const DriversPage = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isNonMobile = useMediaQuery("(min-width: 1000px)");
  const [isAddButtonn, setIsAddButtonn] = useState(false);
  const [isEditButtonn, setIsEditButtonn] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState({});
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const [results, setResults] = useState("");
  const [totalDrivers, setTotalDrivers] = useState(0);
  const [view, setView] = useState("");

  const handleReset = () => {
    setSearch("");
    setView("");
  };

  const { user } = useSelector((state) => state.user);
  const { isPageDrLoading, driversPage, error, success } = useSelector(
    (state) => state.drivers
  );

  let dDrivers = [];

  if (!isPageDrLoading) {
    dDrivers = driversPage ? driversPage.flatMap((i) => i) : [];
  }

  useEffect(() => {
    if (page < 0) {
      setPage(0); // Reset to the first page if the value is negative
    } else {
      dispatch(getAllDriversPage(page, pageSize, JSON.stringify(sort), search));
    }
  }, [page, pageSize, sort, search, dispatch]);

  useEffect(() => {
    if (driversPage) {
      if (totalDrivers === 0) {
        setTotalDrivers(driversPage.length);
      }
      if (search === "") {
        setResults(driversPage.length);
      }
      setResults(driversPage.length);
    } else {
      setResults(0);
    }
  }, [driversPage, totalDrivers, search]);

  const [open, setOpen] = useState(false);
  const [disable, setDisable] = useState(false);

  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [city, setCity] = useState("");
  const [id, setId] = useState(null);
  const [license, setLicense] = useState(null);
  const [address, setAddress] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [driverId, setDriverId] = useState("");
  const [idLink, setIdLink] = useState("");
  const [licenseLink, setLicenseLink] = useState("");
  const [isDelete, setIsDelete] = useState(false);

  useEffect(() => {
    if (error) {
      toast.error(typeof error === "string" ? error : error.message);
    }
    if (success) {
      toast.success("Driver added successfully");

      setOpen(false);
      dispatch({ type: "clearMessages" });
    }
  }, [dispatch, error, success]);

  const handleClickOpen = () => {
    setName("");
    setAddress("");
    setPhoneNumber("");
    setCity("");
    setId(null);
    setLicense(null);
    setAddress("");
    setIdNumber("");
    setIdLink("");
    setLicenseLink("");
    setIsEditButtonn(false);
    setIsAddButtonn(true);
    setOpen(true);
    setDisable(false);
  };

  const handleView = (driverId) => {
    const selectedDriver =
      driversPage && driversPage.find((driver) => driver._id === driverId);
    setName(selectedDriver.name);
    setPhoneNumber(selectedDriver.phoneNumber);
    setCity(selectedDriver.city);
    setAddress(selectedDriver.address);
    setIdNumber(selectedDriver.idNumber);
    setIdLink(selectedDriver.id);
    setLicenseLink(selectedDriver.license);
    setId(null);
    setLicense(null);
    setIsAddButtonn(false);
    setIsEditButtonn(false);
    setDisable(false);
    setOpen(true);
    console.log(id);
  };

  const handleDriverDash= (driverId)=>{
    navigate(`/del-dash-driver/${driverId}`)
  }

  const handleEdit = (driverId) => {
    const selectedDriver =
      driversPage && driversPage.find((driver) => driver._id === driverId);

    setDriverId(driverId);
    setName(selectedDriver.name);
    setPhoneNumber(selectedDriver.phoneNumber);
    setCity(selectedDriver.city);
    setAddress(selectedDriver.address);
    setIdNumber(selectedDriver.idNumber);
    setIdLink(selectedDriver.id);
    setLicenseLink(selectedDriver.license);
    setId(null);
    setLicense(null);
    setIsEditButtonn(true);
    setIsAddButtonn(false);
    setDisable(false);
    setOpen(true);
  };

  const handleDelete = (driverId) => {
    dispatch(deleteDriver(driverId))
      .then(() => {
        toast.success("Driver deleted successfully");
        dispatch(getAllDriversPage());
      })
      .catch((error) => {
        toast.error(error.response.data.message);
      });
  };

  const handleClose = (event, reason) => {
    if (reason !== "backdropClick") {
      setOpen(false);
    }
  };

  const handleSubmit = (e) => {
    setDisable(true);
    e.preventDefault();

    const newForm = new FormData();

    newForm.append("name", name);
    newForm.append("phoneNumber", phoneNumber);
    newForm.append("city", city);
    newForm.append("address", address);
    newForm.append("idNumber", idNumber);
    if (id) newForm.append("id", id);
    if (license) newForm.append("license", license);
    newForm.append("companyId", user.companyId);

    const textComplete =
      name !== "" && phoneNumber !== "" && city !== "" && address !== "" && idNumber !== "";
    // a new driver needs both documents; when editing, a document is only sent if replaced
    const filesComplete = isEditButtonn ? true : Boolean(id && license);

    if (textComplete && filesComplete) {
      if (isAddButtonn && !isEditButtonn) {
        dispatch(createDriver(newForm)).then(() => {
          dispatch(getAllDriversPage());
          handleClose();
          dispatch({ type: "clearMessages" });
        });
      }
      if (!isAddButtonn && isEditButtonn) {
        newForm.append("driverId", driverId);
        dispatch(updateDriver(newForm))
          .then(() => {
            toast.success("Driver updated successfully");
            dispatch(getAllDriversPage());
            dispatch({ type: "clearMessages" });
            setOpen(false);
          })
          .catch((error) => {
            toast.error(error.message);
          });
      }
    } else {
      toast.error(
        textComplete ? "Add both the driver's licence and ID" : "Fill in all the fields"
      );
      setDisable(false);
    }
  };

  console.log(id);
  return (
    <Box m={{ xs: "1rem 0.75rem", sm: "1.25rem 1.5rem", md: "1.5rem 2.5rem" }}>
      <FlexBetween>
        <Header title="Drivers" subtitle="See all your drivers." />
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
            <Groups2Outlined sx={{ mr: "10px" }} />
            {totalDrivers}
          </Button>
        </Box>
        <Box>
          <Button
            onClick={handleClickOpen}
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
            <Add sx={{ mr: "10px" }} />
            Add
          </Button>
        </Box>
      </FlexBetween>
      {/**Dialog to add the drivers start */}
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
              Driver
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
                    <FormControl sx={{ m: 1, minWidth: 150 }}>
                      <Cities
                        name={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </FormControl>
                    <FormControl sx={{ m: 1, minWidth: 100 }}>
                      <TextField
                        labelId="demo-simple-select-autowidth-label"
                        required
                        variant="outlined"
                        type="tel"
                        color="info"
                        label="Phone Number"
                        inputProps={{ minLength: 10, maxLength: 13 }}
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                      />
                    </FormControl>
                  </Box>

                  <FormControl sx={{ m: 1, minWidth: 250 }}>
                    <TextField
                      required
                      variant="outlined"
                      type="text"
                      label="Address"
                      color="info"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </FormControl>
                  <FormControl sx={{ m: 1, minWidth: 250 }}>
                    <TextField
                      required
                      variant="outlined"
                      type="text"
                      label="ID Number"
                      color="info"
                      inputProps={{ maxLength: 13 }}
                      value={idNumber}
                      onChange={(e) =>
                        setIdNumber(
                          e.target.value.replace(/ /g, "").toUpperCase()
                        )
                      }
                    />
                  </FormControl>

                  <DocumentField
                    label="Driver's licence"
                    storedKey={licenseLink}
                    file={license}
                    onChange={setLicense}
                    editable={isAddButtonn || isEditButtonn}
                    required
                  />
                  <DocumentField
                    label="Driver's ID"
                    storedKey={idLink}
                    file={id}
                    onChange={setId}
                    editable={isAddButtonn || isEditButtonn}
                    required
                  />

                  <Box display={"flex"} sx={{ m: "1rem 3rem " }}>
                    <Button
                      disabled={disable}
                      onClick={handleClose}
                      variant="contained"
                      size="large"
                      sx={{
                        color: theme.palette.background.alt,

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

                    {(isAddButtonn || isEditButtonn) && (
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
                        {isAddButtonn && !isEditButtonn && <>Add Driver</>}
                        {!isAddButtonn && isEditButtonn && <>Edit Driver</>}
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
      {/**Dialog to add the drivers ends */}
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
            onClick={handleReset}
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
      {/**This is where the content starts */}
      <Box>
        {dDrivers && !isPageDrLoading && dDrivers.length === 0 ? (
        <EmptyState title="No drivers to show" text="Add a driver with the Add button. If you are searching, clear the search." />
      ) : dDrivers && !isPageDrLoading ? (
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
            {dDrivers.map(
              ({ _id, name, address, phoneNumber, idNumber, city }) => (
                <Driver
                  key={_id}
                  driverId={_id}
                  name={name}
                  address={address}
                  idNumber={idNumber}
                  phoneNumber={phoneNumber}
                  city={city}
                  handleView={handleView}
                  handleEdit={handleEdit}
                  handleDelete={handleDelete}
                  handleDriverDash={handleDriverDash}

                />
              )
            )}
          </Box>
        ) : (
          <p>Loading ....</p>
        )}
      </Box>
      {/**This is where the content ends */}
    </Box>
  );
};

export default DriversPage;
