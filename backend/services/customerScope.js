// Customers belong to one company. This builds the filter for "this company's
// customers": records stamped with its tenantId, plus older records that have no
// tenantId yet but are in the company's own customer list (until the backfill has
// stamped them). A customer stamped for a different company never matches, so one
// company can never pick up, see or edit another company's customer by name.
function ownCustomerFilter(tenantId, linkedIds = []) {
  const or = [];
  if (tenantId) or.push({ tenantId });
  if (linkedIds && linkedIds.length) or.push({ tenantId: null, _id: { $in: linkedIds } });
  // No tenant and no linked customers: match nothing rather than everything.
  return or.length ? { $or: or } : { _id: { $in: [] } };
}

// The same rule applies to any record a company keeps in its own list (customers, drivers).
module.exports = { ownCustomerFilter, ownRecordFilter: ownCustomerFilter };
