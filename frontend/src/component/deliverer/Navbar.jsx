import {
  AppBar,
  Box,
  Button,
  IconButton,
  InputBase,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  useTheme,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import FlexBetween from "./FlexBetween";
import {
  AddTask,
  AddTaskOutlined,
  ArrowDropDownOutlined,
  DarkModeOutlined,
  LightModeOutlined,
  Menu as MenuIcon,
  PendingActions,
  Search,
  SettingsOutlined,
  TaskAlt,
  TaskOutlined,
} from "@mui/icons-material";
import { setMode } from "state";
import { getAllDeliverersPage } from "redux/actions/deliverer";

const Navbar = ({ user, isSidebarOpen, setIsSidebarOpen }) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const [anchorEl, setAchorEl] = useState(null);
  const isOpen = Boolean(anchorEl);

  const { delivererName } = useSelector((state) => state.user);

  const handleClick = (event) => setAchorEl(event.currentTarget);
  const handleClose = () => setAchorEl(null);
  return (
    <AppBar
      sx={{
        position: "static",
        background: "none",
        boxShadow: "3px 3px 5px #ccc",
      }}
    >
      <Toolbar sx={{ justifyContent: "space-between" }}>
        {/**Left Side */}

        <FlexBetween color={theme.palette.secondary[200]} gap="1.5rem">
          <FlexBetween
            backgroundColor={theme.palette.secondary[700]}
            borderRadius="9px"
            p="0.1rem .5rem"
          >
            <IconButton onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <MenuIcon />
            </IconButton>
          </FlexBetween>

          <FlexBetween backgroundColor={theme.palette.secondary[900]}>
            <Button
              gap="1rem"
              p="0.1rem 1rem"
              variant="outlined"
              color="inherit"
              size="large"
            >
              <Typography>{delivererName}</Typography>
            </Button>
          </FlexBetween>
        </FlexBetween>

        {/**Right Side */}
        <FlexBetween gap={"1.5rem"}>
          <IconButton onClick={() => dispatch(setMode())}>
            {theme.palette.mode === "dark" ? (
              <DarkModeOutlined sx={{ fontSize: "25px" }} />
            ) : (
              <LightModeOutlined sx={{ fontSize: "25px" }} />
            )}
          </IconButton>
          <IconButton>
            <SettingsOutlined sx={{ fontSize: "25px" }} />
          </IconButton>
          <Button
            onClick={handleClick}
            sx={{
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.5rem",
              textTransform: "none",
              display: "flex",
            }}
          >
            <Box
              // component="img"
              // alt="profile-img"
              // height={"32px"}
              // width={"32px"}
              // borderRadius={"50%"}
              // sx={{ objectFit: "cover" }}
            />
            <Box>
              <Typography
                fontWeight={"bold"}
                fontSize={"0.9rem"}
                sx={{ color: theme.palette.secondary[100] }}
              >
                {user?.name}
              </Typography>
              <Typography
                fontSize={"0.8rem"}
                sx={{ color: theme.palette.secondary[200] }}
              >
                {user?.role}
              </Typography>
            </Box>
            <ArrowDropDownOutlined
              sx={{ color: theme.palette.secondary[200], fontSize: "25px" }}
            />
          </Button>
          <Menu
            open={isOpen}
            onClose={handleClose}
            anchorEl={anchorEl}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          >
            <MenuItem onClick={handleClick}>Logout</MenuItem>
          </Menu>
        </FlexBetween>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
