const ErrorHandler = require("../utils/ErrorHandler");

// Money and fuel data: only company admins may read or write it.
const FINANCE_ROLES = ["Deliverer Admin", "Super Admin"];

const requireFinance = (req, res, next) => {
  if (!req.user || !FINANCE_ROLES.includes(req.user.role)) {
    return next(new ErrorHandler("Only company admins can manage this data", 403));
  }
  if (!req.user.companyId) {
    return next(new ErrorHandler("Your account has no company", 403));
  }
  next();
};

module.exports = { requireFinance, FINANCE_ROLES };
