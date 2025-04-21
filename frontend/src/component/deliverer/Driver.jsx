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
import React, { useState } from "react";

const Driver = ({
  driverId,
  name,
  phoneNumber,
  address,
  city,
  trips,
  idNumber,
  handleView,
  handleEdit,
  handleDelete,
  handleDriverDash
}) => {
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDelete, setIsDelete] = useState(false);

  const handleViewDriver = (driverId) => {
    handleView(driverId);
  };

  const handleViewDriverDash = (driverId) => {
    handleDriverDash(driverId);
  };

  const handleEditDriver = (driverId) => {
    handleEdit(driverId);
  };

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
          {`Delete Driver : ${name}?`}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to remove <b>{name}</b> from the system ?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            color="info"
            onClick={() => handleDeleteDialogueClose()}
          >
            Cancel
          </Button>
          <Button
            variant="outlined"
            color="warning"
            onClick={() => handleDelete(driverId)}
            autoFocus
          >
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
                    {name}

          {/* Age : 34 */}
          <IconButton
            variant="contained"
            sx={{ color: "lightblue", ml: 6 }}
            size="small"
            onClick={() => handleViewDriver(driverId)}
          >
            <RemoveRedEye />
          </IconButton>
          <IconButton
            variant="contained"
            sx={{ color: theme.palette.secondary[100] }}
            size="small"
            onClick={() => handleEditDriver(driverId)}
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

        <Typography variant="h5" fontWeight="bold" component="div">
        </Typography>
        <Typography sx={{ mb: "1rem" }} variant="h6">
          {address} {city}
        </Typography>

        {/* <Typography>total Dist(km): </Typography> */}
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
          onClick={() => handleViewDriverDash(driverId)}
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
          <Typography>Id Number: {idNumber}</Typography>
        </CardContent>
      </Collapse>
    </Card>
  );
};

export default Driver;
