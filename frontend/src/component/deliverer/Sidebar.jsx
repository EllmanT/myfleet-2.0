import {
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  useTheme,
} from "@mui/material";
import React from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import FlexBetween from "./FlexBetween";
import { Logo } from "./Wordmark";
import {
  AccountBalanceWalletOutlined,
  AdminPanelSettingsOutlined,
  LocalGasStationOutlined,
  CalendarMonth,
  CalendarMonthOutlined,
  ChevronLeftOutlined,
  DriveEta,
  GroupOutlined,
  GroupWorkOutlined,
  Groups2Outlined,
  HomeOutlined,
  LocalShipping,
  Money,
  Payments,
  People,
  PieChartOutlined,
  PointOfSaleOutlined,
  ReceiptLongOutlined,
  TodayOutlined,
  TrendingUpOutlined,
  TuneOutlined,
  BuildOutlined,
  RequestQuoteOutlined,
  ReceiptOutlined,
  RouteOutlined,
  RvHookupOutlined,
  DescriptionOutlined,
} from "@mui/icons-material";
import { useSelector } from "react-redux";

const Sidebar = ({
  user,
  drawerWidth,
  isSidebarOpen,
  setIsSidebarOpen,
  isNonMobile,
}) => {
  const companyId = user && user.companyId;
  const daily = "/revenue-analytics/daily-data/";
  const monthly = "/revenue-analytics/monthly-data/";
  const breakdown = "/revenue-analytics/breakdown/";

  const navItems = [
    {
      text: "Dashboard",
      icon: <HomeOutlined />,
      name: "dashboard",
    },
    {
      text: "Order Central",
      icon: null,
    },
    {
      text: "Overview",
      icon: <TodayOutlined />,
      name: "dash-orders",
    },
    {
      text: "View All",
      icon: <CalendarMonthOutlined />,
      name: "all-orders",
    },
    {
      text: "Customers",
      icon: <Groups2Outlined />,
      name: "customers",
    },
    {
      text: "Contractors",
      icon: <ReceiptLongOutlined />,
      name: "contractors",
    },

    {
      text: "Revenue",
      icon: null,
    },
    {
      text: "$ Overview",
      icon: <PointOfSaleOutlined />,
      name: "dash-revenue",
    },
    {
      text: "Daily",
      icon: <TodayOutlined />,
      name: `${daily}`,
      module: "analytics",
    },
    {
      text: "Monthly",
      icon: <CalendarMonthOutlined />,
      name: `${monthly}`,
      module: "analytics",
    },
    {
      text: "Breakdown",
      icon: <PieChartOutlined />,
      name: `${breakdown}`,
      module: "analytics",
    },
    {
      text: "Profitability",
      icon: <TrendingUpOutlined />,
      name: "profitability",
      module: "expenses",
    },
    {
      text: "Expenses",
      icon: <AccountBalanceWalletOutlined />,
      name: "expenses",
      module: "expenses",
    },
    {
      text: "Fuel Log",
      icon: <LocalGasStationOutlined />,
      name: "fuel-log",
      module: "fuel",
    },
    //Not YET
    //{
    //  text: "Payments",
    //   icon: <Payments />,
    //   name: "payments",
    //  },
    // {
    //   text: "Reports",
    //    icon: <TrendingUpOutlined />,
    //    name: "performance",
    // },
    {
      text: "Billing",
      icon: null,
      module: ["quotations", "invoices"],
    },
    {
      text: "Quotations",
      icon: <RequestQuoteOutlined />,
      name: "quotations",
      module: "quotations",
    },
    {
      text: "Invoices",
      icon: <ReceiptOutlined />,
      name: "invoices",
      module: "invoices",
    },
    {
      text: "Trucking",
      icon: null,
      module: ["crossBorder", "tractorUnits"],
    },
    {
      text: "Trips",
      icon: <RouteOutlined />,
      name: "trips",
      module: "crossBorder",
    },
    {
      text: "Trailers",
      icon: <RvHookupOutlined />,
      name: "trailers",
      module: "tractorUnits",
    },
    {
      text: "Documents",
      icon: <DescriptionOutlined />,
      name: "documents",
      module: "tractorUnits",
    },
    {
      text: "Maintenance",
      icon: <BuildOutlined />,
      name: "maintenance",
      module: "maintenance",
    },
    {
      text: "Management",
      icon: null,
    },
    {
      text: "Admins",
      icon: <AdminPanelSettingsOutlined />,
      name: "admins",
    },
    {
      text: "Vehicles",
      icon: <LocalShipping />,
      name: "vehicles",
    },
    {
      text: "Drivers",
      icon: <GroupOutlined />,
      name: "drivers",
    },
    {
      text: "Settings",
      icon: null,
    },
    {
      text: "Modules",
      icon: <TuneOutlined />,
      name: "modules",
    },
    {
      text: "Admin console",
      icon: <AdminPanelSettingsOutlined />,
      name: "admin-console",
      platformOnly: true,
    },
    // {
    //   text: "Deliverers",
    //   icon: <GroupWorkOutlined />,
    //   name: "deliverers",
    // },
  ];

  // Items tied to an optional module only show when the company has it on.
  // Until the settings load, optional items stay hidden to avoid a flash.
  const { modules, modulesLoaded } = useSelector((state) => state.user);
  const visibleNavItems = navItems.filter(
    (item) =>
      (!item.platformOnly || ["Super Admin", "Site Admin"].includes(user && user.role)) &&
      (!item.module ||
        (modulesLoaded &&
          modules &&
          [].concat(item.module).some((key) => modules[key])))
  );

  const { pathname } = useLocation();
  const theme = useTheme();
  const navigate = useNavigate();

  // Where each item goes. Analytics items go to a path that includes the company id.
  const targetFor = (name) =>
    name === daily
      ? `/revenue-analytics/daily-data/${companyId}`
      : name === monthly
      ? `/revenue-analytics/monthly/${companyId}`
      : name === breakdown
      ? `/revenue-analytics/breakdown/${companyId}`
      : `/del-${name}`;
  // An item is active when the current page is its page (or one under it).
  const isActive = (name) => {
    const target = targetFor(name);
    return pathname === target || pathname.startsWith(`${target}/`);
  };
  return (
    <div component="nav">
      {isSidebarOpen && (
        <Drawer
          open={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          anchor="left"
          variant="persistent"
          sx={{
            width: drawerWidth,
            "& .MuiDrawer-paper": {
              color: theme.palette.secondary[300],
              backgroundColor: theme.palette.background.alt,
              boxSizing: "border-box",
              borderWidth: isNonMobile ? 0 : "1.5px",
              width: drawerWidth,
            },
          }}
        >
          {/**Part 1 */}
          <Box width={"100%"}>
            <Box m="1rem 2rem 2rem 3rem">
              <FlexBetween color={theme.palette.secondary.main}>
                <Box alignItems={"center"} gap="1.5rem" display={"flex"}>
                  <Logo width={140} variant="text" />
                </Box>

                {!isNonMobile && (
                  <IconButton onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                    <ChevronLeftOutlined />
                  </IconButton>
                )}
              </FlexBetween>
            </Box>

            <List>
              {visibleNavItems.map(({ text, icon, name }) => {
                if (!icon) {
                  return (
                    <Typography key={text} m="1.5rem 2rem 0rem 3rem">
                      {text}
                    </Typography>
                  );
                }
                return (
                  <ListItem key={text} disablePadding>
                    <ListItemButton
                      aria-current={isActive(name) ? "page" : undefined}
                      onClick={() => {
                        navigate(targetFor(name));
                        // on a phone the menu covers the page, so close it after choosing
                        if (!isNonMobile) setIsSidebarOpen(false);
                      }}
                      sx={{
                        backgroundColor:
                          isActive(name)
                            ? theme.palette.secondary[300]
                            : "transparent",
                        color:
                          isActive(name)
                            ? theme.palette.primary[600]
                            : theme.palette.secondary[100],
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          ml: "2rem",
                          color:
                            isActive(name)
                              ? theme.palette.primary[600]
                              : theme.palette.secondary[100],
                        }}
                      >
                        {icon}
                      </ListItemIcon>
                      <ListItemText primary={text} />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Box>

          {/**Part 2 */}
          <Box width={"100%"} bottom={"0rem"}>
            <Divider />
            <FlexBetween
              display={"flex"}
              gap={"1.5rem"}
              m="1.5rem 2rem 0rem 2rem"
            >
              <Box
                // component={"img"}
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
                  {user?.name || "Signed in"}
                </Typography>
                <Typography
                  fontSize={"0.8rem"}
                  sx={{ color: theme.palette.secondary[200] }}
                >
                  {user?.role}
                </Typography>
              </Box>
            </FlexBetween>
          </Box>
        </Drawer>
      )}
    </div>
  );
};

export default Sidebar;
