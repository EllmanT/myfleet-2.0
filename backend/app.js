const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const cors = require("cors");
const ErrorHandler = require("./middleware/error");
const path = require("path");
//app. uses
app.use(
  cors({
    // origin: "https://myfleet-ijfg.vercel.app",
    origin: "http://localhost:3000",
    // origin:"https://myfleet-2-0.onrender.com",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use("/", express.static(path.join(__dirname, "./uploads")));
app.use("/test", (req, res) => {
  res.send("Hello world!");
});

app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// config

if (process.env.NODE_ENV !== "PRODUCTION") {
  require("dotenv").config({
    path: "config/.env",
  });
}

//declaring controllers
const user = require("./controller/user");
const customer = require("./controller/customer");
const deliverer = require("./controller/deliverer");
const contractor = require("./controller/contractor");
const vehicle = require("./controller/vehicle");
const driver = require("./controller/driver");
const job = require("./controller/job");
const rate = require("./controller/rate");
const overallStats = require("./controller/overallStats");
const vehicleStats = require("./controller/vehicleStats");
const driverStats = require("./controller/driverStats");
const contractorStats = require("./controller/contractorStats");
const vehicleExpenses = require("./controller/vehicleExpenses");
const employeeExpenses = require("./controller/employeeExpenses");

//using controllers
app.use("/api/v2/user", user);
app.use("/api/v2/customer", customer);
app.use("/api/v2/deliverer", deliverer);
app.use("/api/v2/contractor", contractor);
app.use("/api/v2/vehicle", vehicle);
app.use("/api/v2/driver", driver);
app.use("/api/v2/job", job);
app.use("/api/v2/rate", rate);
app.use("/api/v2/overallStats", overallStats);
app.use("/api/v2/vehicleStats", vehicleStats);
app.use("/api/v2/driverStats", driverStats);
app.use("/api/v2/contractorStats", contractorStats);
app.use("/api/v2/expenses/vehicle", vehicleExpenses);
app.use("/api/v2/expenses/employee", employeeExpenses);

app.use(ErrorHandler);
app.use(express.static(path.resolve("./frontend/build")));
app.get("*", (req, res) => {
  res.sendFile(path.resolve("./", "frontend", "build", "index.html"));
});


module.exports = app;
