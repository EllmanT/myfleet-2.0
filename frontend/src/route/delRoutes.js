import { lazy } from "react";
const DelRegisterPage = lazy(() => import("../pages/deliverer/RegisterPage.jsx"));
const DelLoginPage = lazy(() => import("../pages/deliverer/LoginPage.jsx"));
const ForgotPasswordPage = lazy(() => import("../pages/deliverer/ForgotPasswordPage.jsx"));
const ResetPasswordPage = lazy(() => import("../pages/deliverer/ResetPasswordPage.jsx"));
const DelDashboardPage = lazy(() => import("../pages/deliverer/DashboardPage.jsx"));
const DelAdminsPage = lazy(() => import("../pages/deliverer/AdminsPage.jsx"));
const DelVehiclesPage = lazy(() => import("../pages/deliverer/VehiclesPage.jsx"));
const DelDriversPage = lazy(() => import("../pages/deliverer/DriversPage.jsx"));
const DelCustomersPage = lazy(() => import("../pages/deliverer/CustomersPage.jsx"));
const DelContractorsPage = lazy(() => import("../pages/deliverer/ContractorsPage.jsx"));
const DelPaymentsPage = lazy(() => import("../pages/deliverer/PaymentsPage.jsx"));
const DelDashOrdersPage = lazy(() => import("../pages/deliverer/DashOrdersPage.jsx"));
const DelDashContractorPage = lazy(() => import("../pages/deliverer/DashContractorPage.jsx"));
const DelDashRevenuePage = lazy(() => import("../pages/deliverer/DashRevenuePage.jsx"));
const DelDashDriverPage = lazy(() => import("../pages/deliverer/DashDriverPage.jsx"));
const DelDashVehiclePage = lazy(() => import("../pages/deliverer/DashVehiclePage.jsx"));
const DelAllOrdersPage = lazy(() => import("../pages/deliverer/AllJobsPage.jsx"));
const DelDeliverersPage = lazy(() => import("../pages/deliverer/DeliverersPage"));
const ActivationPage = lazy(() => import("../pages/ActivationPage"));
const DelAddJobPage = lazy(() => import("../pages/deliverer/AddJobPage"));
const DelExpensesPage = lazy(() => import("../pages/deliverer/ExpensesPage.jsx"));
const DelProfitabilityPage = lazy(() => import("../pages/deliverer/ProfitabilityPage.jsx"));
const DelFuelLogPage = lazy(() => import("../pages/deliverer/FuelLogPage.jsx"));


//analytics
const DelDashJobsAnalyticsPage = lazy(() => import("../pages/deliverer/analytics/DashJobAnalytics"));
const DelDashDriverAnalyticsPage = lazy(() => import("../pages/deliverer/analytics/DashDriverAnalytics.jsx"));
const DelDashVehicleAnalyticsPage = lazy(() => import("../pages/deliverer/analytics/DashVehicleAnalytics.jsx"));
const DelDashContrAnalyticsPage = lazy(() => import("../pages/deliverer/analytics/DashContrAnalytics.jsx"));
const DelDashDailyDataPage = lazy(() => import("../pages/deliverer/analytics/DashDailyDataPage.jsx"));
const DelDashVehicleDailyDataPage = lazy(() => import("../pages/deliverer/analytics/DashVehicleDataPage.jsx"));
const DelDashDriverDailyDataPage = lazy(() => import("../pages/deliverer/analytics/DashDriverDataPage.jsx"));
const DelDashContrDailyDataPage = lazy(() => import("../pages/deliverer/analytics/DashContrDataPage.jsx"));
const DelDashRevenueDailyDataPage = lazy(() => import("../pages/deliverer/analytics/DashRevenueDailyDataPage.jsx"));
const DelDashRevenueBreakdownPage = lazy(() => import("../pages/deliverer/analytics/DashRevenueBreakdownPage.jsx"));
const DelDashRevenueMonthlyPage = lazy(() => import("../pages/deliverer/analytics/DashRevenueMonthlyPage.jsx"));

//reports
const DelDashReportsPage = lazy(() => import("../pages/deliverer/reports/DashReports.jsx"));
const DelDashContrReportsPage = lazy(() => import("../pages/deliverer/reports/DashContrReports.jsx"));
const DelDashDriverReportsPage = lazy(() => import("../pages/deliverer/reports/DashDriverReports.jsx"));
const DelDashVehicleReportsPage = lazy(() => import("../pages/deliverer/reports/DashVehicleReports.jsx"));


export {
  DelExpensesPage,
  DelProfitabilityPage,
  DelFuelLogPage,
  DelRegisterPage,
  DelLoginPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  DelDashboardPage,
  DelAdminsPage,
  DelVehiclesPage,
  DelDriversPage,
  DelCustomersPage,
  DelContractorsPage,
  DelPaymentsPage,
  DelDashOrdersPage,
  DelDashContractorPage,
  DelDashRevenuePage,
  DelDashDriverPage,
  DelDashVehiclePage,
  DelAllOrdersPage,
  DelDeliverersPage,
  ActivationPage,
  DelAddJobPage,
  DelDashJobsAnalyticsPage,
  DelDashContrAnalyticsPage,
  DelDashDriverAnalyticsPage,
  DelDashVehicleAnalyticsPage,
  DelDashDailyDataPage,
  DelDashContrDailyDataPage,
  DelDashDriverDailyDataPage,
  DelDashVehicleDailyDataPage,
  DelDashRevenueBreakdownPage,
  DelDashRevenueDailyDataPage,
  DelDashRevenueMonthlyPage,
  DelDashReportsPage,
  DelDashContrReportsPage,
  DelDashDriverReportsPage,
  DelDashVehicleReportsPage
};
