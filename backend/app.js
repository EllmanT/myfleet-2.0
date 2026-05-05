const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const cors = require("cors");//
const ErrorHandler = require("./middleware/error");
const path = require("path");
const { getUploadsDir } = require("./uploadsDir");

function parseOriginList(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const corsOrigins = parseOriginList(
  process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL
);

function corsOriginCallback(origin, callback) {
  if (!origin) {
    callback(null, true);
    return;
  }
  if (corsOrigins.includes(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error(`Not allowed by CORS: ${origin}`));
}

// same-origin SPA + API (Vercel) needs no browsers preflight mismatches when FRONTEND_URL is set correctly
let corsCfg = { credentials: true };
if (corsOrigins.length) {
  corsCfg.origin = corsOriginCallback;
} else if (process.env.NODE_ENV !== "production") {
  corsCfg.origin = "http://localhost:3000";
}

app.use(cors(corsCfg));
app.use(express.json());
app.use(cookieParser());
app.use("/", express.static(path.join(getUploadsDir())));
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

if (!process.env.VERCEL) {
  app.use(express.static(path.resolve("./frontend/build")));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve("./", "frontend", "build", "index.html"));
  });
}

module.exports = app;
