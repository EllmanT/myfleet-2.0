const jwt = require("jsonwebtoken");
const Deliverer = require("../../model/deliverer");
const User = require("../../model/user");
const Contractor = require("../../model/contractor");
const Driver = require("../../model/driver");
const Vehicle = require("../../model/vehicle");
const Customer = require("../../model/customer");

function buildJobPayload(overrides = {}) {
  return {
    jobNumber: "J-1001",
    from: overrides.from || overrides.fromId,
    customer: overrides.customer || overrides.customerId || overrides.pageCustomerId,
    distance: overrides.distance ?? 15,
    cost: overrides.cost ?? 100,
    mileageOut: overrides.mileageOut ?? "1000",
    mileageIn: overrides.mileageIn ?? "1015",
    orderDate: overrides.orderDate ?? "2026-01-10T00:00:00.000Z",
    description: overrides.description ?? "Test job",
    deliveryType: overrides.deliveryType ?? "standard",
    contractorId: overrides.contractorId,
    vehicleId: overrides.vehicleId,
    driverId: overrides.driverId,
  };
}

async function seedAuthFixture() {
  const [fromCustomer, toCustomer] = await Customer.create([
    { name: "From Customer", city: "Harare", phoneNumber: "111", address: "A" },
    { name: "To Customer", city: "Harare", phoneNumber: "222", address: "B" },
  ]);

  const [contractorA, contractorB] = await Contractor.create([
    {
      companyName: "Alpha Logistics",
      address: "Address 1",
      city: "Harare",
      goodsTypes: ["general"],
      vehiclesTypes: ["small"],
      deliveryTypes: ["standard"],
    },
    {
      companyName: "Beta Transport",
      address: "Address 2",
      city: "Harare",
      goodsTypes: ["general"],
      vehiclesTypes: ["small"],
      deliveryTypes: ["express"],
    },
  ]);

  const [driverA, driverB] = await Driver.create([
    {
      name: "Driver A",
      phoneNumber: "333",
      address: "Driver Address A",
      city: "Harare",
      idNumber: "ID-A",
      id: "DRV-A",
      companyId: "temp",
    },
    {
      name: "Driver B",
      phoneNumber: "444",
      address: "Driver Address B",
      city: "Harare",
      idNumber: "ID-B",
      id: "DRV-B",
      companyId: "temp",
    },
  ]);

  const [vehicleA, vehicleB] = await Vehicle.create([
    { make: "Toyota", companyId: "temp", size: "small", regNumber: "ABC123" },
    { make: "Mazda", companyId: "temp", size: "small", regNumber: "XYZ789" },
  ]);

  const deliverer = await Deliverer.create({
    companyName: "MyFleet Deliverer",
    address: "Deliverer Address",
    city: "Harare",
    goodsType: ["general"],
    vehiclesType: ["small"],
    deliveryType: ["standard", "express"],
    customer_ids: [fromCustomer._id, toCustomer._id],
    contractor_ids: [contractorA._id, contractorB._id],
    driver_ids: [driverA._id, driverB._id],
    vehicle_ids: [vehicleA._id, vehicleB._id],
  });

  driverA.companyId = String(deliverer._id);
  driverB.companyId = String(deliverer._id);
  vehicleA.companyId = String(deliverer._id);
  vehicleB.companyId = String(deliverer._id);
  await Promise.all([driverA.save(), driverB.save(), vehicleA.save(), vehicleB.save()]);

  const user = await User.create({
    name: "Deliverer Admin",
    email: "admin@test.com",
    password: "password123",
    phoneNumber: "555",
    role: "deliverer",
    address: "Admin Address",
    city: "Harare",
    companyId: deliverer._id,
  });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, {
    expiresIn: "1d",
  });

  return {
    token,
    deliverer,
    contractorA,
    contractorB,
    driverA,
    driverB,
    vehicleA,
    vehicleB,
    fromCustomer,
    toCustomer,
  };
}

module.exports = {
  seedAuthFixture,
  buildJobPayload,
};
