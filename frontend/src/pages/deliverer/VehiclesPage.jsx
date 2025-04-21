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
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Add,
  Close,
  Group,
  GroupAdd,
  LocalShipping,
  Refresh,
  Search,
} from "@mui/icons-material";
import FlexBetween from "component/deliverer/FlexBetween";
import Header from "component/deliverer/Header";
import { useDispatch, useSelector } from "react-redux";
import {
  createVehicle,
  deleteVehicle,
  getAllVehiclesPage,
  updateVehicle,
} from "redux/actions/vehicle";
import { toast } from "react-hot-toast";
import Vehicle from "component/deliverer/Vehicle";
import Store from "redux/store";
import { useNavigate } from "react-router-dom";

const sizes = [
  {
    name: "Small (<=5T)",
    value: "smallVehicle",
  },
  {
    name: "Medium (<=10T)",
    value: "mediumVehicle",
  },
  {
    name: "Large (10T+)",
    value: "largeVehicle",
  },
  {
    name: "Horse ",
    value: "horse",
  },
];

const VehiclesPage = () => {
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
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [view, setView] = useState("");

  const handleReset = () => {
    setSearch("");
    setView("");
  };

  const { vehiclesPage, isPageVehLoading } = useSelector(
    (state) => state.vehicles
  );
  useEffect(() => {
    if (page < 0) {
      setPage(0); // Reset to the first page if the value is negative
    } else {
      dispatch(
        getAllVehiclesPage(page, pageSize, JSON.stringify(sort), search)
      );
    }
  }, [page, pageSize, sort, search, dispatch]);

  useEffect(() => {
    if (vehiclesPage) {
      if (totalVehicles === 0) {
        setTotalVehicles(vehiclesPage.length);
      }
      if (search === "") {
        setResults(vehiclesPage.length);
      }
      setResults(vehiclesPage.length);
    } else {
      setResults(0);
    }
  }, [vehiclesPage, totalVehicles, search]);

  let dVehicles = [];
  if (!isPageVehLoading) {
    dVehicles = vehiclesPage ? vehiclesPage.flatMap((i) => i) : [];
  }

  const [open, setOpen] = useState(false);
  const [disable, setDisable] = useState(false);

  const { success, error } = useSelector((state) => state.vehicles);
  const { user } = useSelector((state) => state.user);

  const [id, setId] = useState("");
  const [make, setMake] = useState("");
  const [size, setSize] = useState("");
  const [regNumber, setRegNumber] = useState("");

  useEffect(() => {
    if (error) {
      toast.error(error.message);
    }
    if (success) {
      toast.success("Vehicle added successfully");

      setOpen(false);
      dispatch({ type: "clearMessages" });
    }
  }, [dispatch, error, success]);

  const handleClickOpen = () => {
    setMake("");
    setRegNumber("");
    setSize("");
    setDisable(false);
    setOpen(true);
    setIsAddButtonn(true);
    setIsEditButtonn(false);
  };

  const handleView = (vehicleId) => {
    const selectedVehicle =
      vehiclesPage && vehiclesPage.find((vehicle) => vehicle._id === vehicleId);
    setMake(selectedVehicle.make);
    setRegNumber(selectedVehicle.regNumber);
    setSize(selectedVehicle.size);
    setIsAddButtonn(false);
    setIsEditButtonn(false);
    setDisable(false);
    setOpen(true);
  };

  const handleEdit = (vehicleId) => {
    const selectedVehicle =
      vehiclesPage && vehiclesPage.find((vehicle) => vehicle._id === vehicleId);
    setId(vehicleId);
    setMake(selectedVehicle.make);
    setRegNumber(selectedVehicle.regNumber);
    setSize(selectedVehicle.size);
    setIsEditButtonn(true);
    setIsAddButtonn(false);
    setDisable(false);
    setOpen(true);
  };

  const handleDelete = (vehicleId) => {
    dispatch(deleteVehicle(vehicleId))
      .then(() => {
        toast.success("Vehicle deleted successfully");
        dispatch(getAllVehiclesPage());
      })
      .catch((error) => {
        toast.error(error.response.data.message);
      });
  };
  const handleVehicleDash= (vehicleId)=>{
    navigate(`/del-dash-vehicle/${vehicleId}`)
  }
  const handleClose = (event, reason) => {
    if (reason !== "backdropClick") {
      setOpen(false);
    }
  };

  const handleSubmit = (e) => {
    setDisable(true);
    e.preventDefault();

    const newForm = new FormData();
    if (make !== "" && regNumber !== "" && size !== "") {
      newForm.append("make", make);
      newForm.append("regNumber", regNumber);
      newForm.append("size", size);
      newForm.append("companyId", user.companyId);

      if (isAddButtonn && !isEditButtonn) {
        dispatch(createVehicle(newForm)).then(() => {
          dispatch(getAllVehiclesPage());
          handleClose();
        });
      }
      if (!isAddButtonn && isEditButtonn) {
        dispatch(updateVehicle(id, make, size, regNumber))
          .then(() => {
            toast.success("Vehicle updated successfully");
            dispatch(getAllVehiclesPage());
            dispatch({ type: "clearMessages" });
            setOpen(false);
          })
          .catch((error) => {
            toast.error(error.response.data.message);
          });
      }
    } else {
      toast.error("Enter all fields");
      setDisable(false);
    }
  };

  const columns = [
    {
      field: "_id",
      headerName: "ID",
      flex: 1,
    },
    {
      field: "name",
      headerName: "Name",
      flex: 0.5,
    },
    {
      field: "email",
      headerName: "Email",
      flex: 1,
    },
    {
      field: "phoneNumber",
      headerName: "Phone Number",
      flex: 0.5,
      renderCell: (params) => {
        return params.value.replace(/^(\d{3})(\d{3})(\d{4})/, "($1)$2-$3");
      },
    },
    {
      field: "country",
      headerName: "Country",
      flex: 0.4,
    },
    {
      field: "occupation",
      headerName: "Occupation",
      flex: 1,
    },
    {
      field: "role",
      headerName: "Role",
      flex: 0.5,
    },
  ];

  return (
    <Box m="1.5rem 2.5rem">
      <FlexBetween>
        <Header title="Vehicles" subtitle="See all your vehicles." />
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
            <LocalShipping sx={{ mr: "10px" }} />
            {totalVehicles}
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

      <div>
        <Dialog disableEscapeKeyDown  open={open} onClose={handleClose}>
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
              Vehicle
            </Button>
            <Button
              variant="outlined"
              color="info"
              sx={{ ml: "30px" }}
              onClick={handleClose}
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
                      label="Make"
                      color="info"
                      value={make}
                      onChange={(e) => setMake(e.target.value)}
                    />
                  </FormControl>
                  <Box display={"flex"}>
                    <FormControl sx={{ m: 1, minWidth: 150 }}>
                      <InputLabel id="demo-simple-select-autowidth-label">
                        Size
                      </InputLabel>
                      <Select
                        labelId="simple-select-autowidth-label"
                        id="demo-simple-select-autowidth"
                        autoWidth
                        label="Size"
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                      >
                        {sizes.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl sx={{ m: 1, minWidth: 100 }}>
                      <TextField
                        required
                        variant="outlined"
                        type="text"
                        label="Reg Number (no space)"
                        inputProps={{ maxLength: 7 }}
                        color="info"
                        value={regNumber}
                        onChange={(e) =>
                          setRegNumber(
                            e.target.value.replace(/ /g, "").toUpperCase()
                          )
                        }
                      />
                    </FormControl>
                  </Box>

                  <FormControl sx={{ m: 1, minWidth: 250 }}>
                    <TextField
                      disabled
                      variant="outlined"
                      type="text"
                      label="Company Id"
                      color="info"
                      value={user?.companyId}
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
                    {(isAddButtonn ||
                      isEditButtonn) && (
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
                          {isAddButtonn && !isEditButtonn && <>Add Vehicle</>}
                          {!isAddButtonn && isEditButtonn && <>Edit Vehicle</>}
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
      {/**Content starts here */}
      {dVehicles && !isPageVehLoading ? (
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
          {dVehicles.map(({ _id, regNumber, make, size }) => (
            <Vehicle
              key={_id}
              vehicleId={_id}
              regNumber={regNumber}
              make={make}
              size={size}
              handleEdit={handleEdit}
              handleView={handleView}
              handleDelete={handleDelete}
              handleVehicleDash={handleVehicleDash}
            />
          ))}
        </Box>
      ) : (
        <>Loading...</>
      )}

      {/**Content ends here */}
    </Box>
  );
};

export default VehiclesPage;
