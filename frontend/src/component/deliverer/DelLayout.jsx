import { Box, useMediaQuery } from "@mui/material";
import React, { useState } from "react";
import { useSelector } from "react-redux";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { Outlet } from "react-router-dom";

const DelLayout = () => {
  const isNonMobile = useMediaQuery("(min-width:600px)");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { user } = useSelector((state) => state.user);
  return (
    <Box display={isNonMobile ? "flex" : "block"} width="100%" height="100%">
      <Sidebar
        user={user || {}}
        drawerWidth="250px"
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isNonMobile={isNonMobile}
      />
      <Box flexGrow={1}>
        <Navbar
          user={user || {}}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
        />
        <Outlet />
      </Box>

    </Box>
  );
};

export default DelLayout;
