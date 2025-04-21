import {
  Agriculture,
  AgricultureOutlined,
  Delete,
  LocalShipping,
  LocalShippingOutlined,
  ModeEdit,
  RemoveRedEye,
} from "@mui/icons-material";
import {
  Button,
  Card,
  CardActions,
  CardContent,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Typography,
  useTheme,
} from "@mui/material";
import VehiclesPage from "pages/deliverer/VehiclesPage";
import React, { useState } from "react";

const Vehicle = ({
  vehicleId,
  regNumber,
  make,
  size,
  handleView,
  handleEdit,
  handleDelete,
  handleVehicleDash,

}) => {
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDelete, setIsDelete] =useState(false);

  const handleViewVehicle = (vehicleId) => {
    handleView(vehicleId);
  };

  const handleEditVehicle = (vehicleId) => {
    handleEdit(vehicleId);
  };
  const handleViewVehicleDash = (vehicleId)=>{
    handleVehicleDash(vehicleId);
  }

  const handleDeleteDialogue = () => {
    setIsDelete(true);
  };

  const handleDeleteDialogueClose = () => {
    setIsDelete(false);
  };

  return (
    <Card
      sx={{
        backgroundImage: "none",
        backgroundColor: theme.palette.background.alt,
        borderRadius: "0.55rem",
      }}
    >
       <Dialog
          open={isDelete}
          onClose={handleDeleteDialogueClose}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title" fontWeight={"bold"}>
            {`Delete Vehicle : ${make} ${regNumber}?`}
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
            Are you sure you want to remove <b> {make} {regNumber}</b> from the system ? 
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" color="info" onClick={() => handleDeleteDialogueClose()}>Cancel</Button>
            <Button variant="outlined"  color="warning" onClick={() => handleDelete(vehicleId)} autoFocus>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      <CardContent>
        <Typography
          variant="h5"
          color={theme.palette.secondary[300]}
          gutterBottom
          fontWeight="bold"
        >
          {regNumber}
          <IconButton
            variant="contained"
            sx={{ color: "lightblue", ml: 3 }}
            size="small"
            onClick={() => handleViewVehicle(vehicleId)}
          >
            <RemoveRedEye />
          </IconButton>
          <IconButton
            variant="contained"
            sx={{ color: theme.palette.secondary[100], ml: 1 }}
            size="small"
            onClick={() => handleEditVehicle(vehicleId)}
          >
            <ModeEdit />
          </IconButton>
          <IconButton
            variant="contained"
            sx={{ color: "lightblue" }}
            size="small"
            onClick={() => handleDeleteDialogue()}
          >
            <Delete />
          </IconButton>
        </Typography>
        <Typography variant="h5" component="div">
          {make}
        </Typography>
        <Typography
          sx={{ mb: "1rem" }}
          color={theme.palette.secondary[400]}
        ></Typography>

        <Typography variant="body2">
          {size === "smallVehicle" ? (
            <LocalShipping sx={{ fontSize: "24px", ml: 1, mb: 0.4 }} />
          ) : (
            <LocalShippingOutlined
              sx={{ fontSize: "24px", ml: 1, mb: 0.4, color: "gray" }}
            />
          )}

          {size === "mediumVehicle" ? (
            <LocalShipping sx={{ fontSize: "32px", ml: 1, mb: 0.2 }} />
          ) : (
            <LocalShippingOutlined
              sx={{ fontSize: "32px", ml: 1, mb: 0.2, color: "gray" }}
            />
          )}
          {size === "largeVehicle" ? (
            <LocalShipping sx={{ fontSize: "40px", ml: 1, mb: 0.1 }} />
          ) : (
            <LocalShippingOutlined
              color="inherit"
              sx={{ fontSize: "40px", ml: 1, mb: 0.1, color: "gray" }}
            />
          )}
          {size === "horse" ? (
            <Agriculture sx={{ fontSize: "40px", ml: 1, mb: 0 }} />
          ) : (
            <AgricultureOutlined
              sx={{ fontSize: "40px", ml: 1, mb: 0, color: "gray" }}
            />
          )}
        </Typography>

        {/* <Typography>mileage: </Typography> */}
      </CardContent>
      <CardActions>
        <Button
          variant="outlined"
          color="inherit"
          size="small"
          sx={{ mr: 4 }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {!isExpanded ? "See More" : "See Less"}
        </Button>
        <Button
          variant="contained"
          size="small"
          sx={{ color: theme.palette.secondary[200] }}
          onClick={()=>handleViewVehicleDash(vehicleId)}
        >
          View Trips
        </Button>
      
      </CardActions>
      <Collapse
        in={isExpanded}
        timeout="auto"
        unmountOnExit
        sx={{
          color: theme.palette.neutral[300],
        }}
      >
        <CardContent>
          <Typography>Number of jobs: </Typography>
          <Typography>Total Income:</Typography>
          <Typography>Total Distance (km):</Typography>
        </CardContent>
      </Collapse>
    </Card>
  );
};

export default Vehicle;
