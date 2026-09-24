const Deliverer = require("../../model/deliverer");
const Contractor = require("../../model/contractor");
const Driver = require("../../model/driver");
const Vehicle = require("../../model/vehicle");
const Customer = require("../../model/customer");
const Rate = require("../../model/rate");
const Job = require("../../model/job");
const { roundMoney } = require("../../controller/helpers/jobStatsSync");
const { parseVehicleLog, normalizeRegNumber } = require("./parseVehicleLog");
const { normalizeName, similarity, rankCandidates } = require("./matching");

// Read-only: turns uploaded vehicle logs into a reviewable preview of the
// jobs that would be created. The same function backs the commit step
// (commitImport.js), which re-runs it with the user's choices applied, so
// what was previewed is exactly what gets written.
//
// Decisions: every driver / contractor / place name / vehicle found in the
// sheets becomes one decision keyed by its normalised text. The user can
// override any of them via `choices[key]`:
//   vehicle, driver    -> an existing id
//   contractor         -> an existing id, or "skip"
//   customer (places)  -> an existing customer id, or "new:<Name>"

// "put" is how a handwritten PVT usually gets transcribed.
const PRIVATE_CONTRACTORS = new Set(["", "pvt", "put", "private", "priv", "personal"]);
const AUTO_SCORE = 0.9;
// Place names only auto-match when identical apart from spacing or
// punctuation; partial matches ("Border Mukuvisi" ~ "Border") get reviewed.
const CUSTOMER_AUTO_SCORE = 0.98;
const SUGGEST_SCORE = 0.75;
const NEW_PREFIX = "new:";
const SKIP = "skip";

function toTitleCase(text) {
  return String(text)
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[A-Za-z]+/g, (word) =>
      // Keep short all-caps tokens as acronyms: NMB, CBZ, ISS, Z.A.S.
      word.length <= 3 && word === word.toUpperCase()
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );
}

// "LAMMEL / SHIPPY" is two places; "ECONET W/VALE" and "B/DALE" are
// abbreviations (a single letter before the slash), so they stay whole.
function splitCompound(raw) {
  const parts = [];
  let current = "";
  const pieces = raw.split("/");
  pieces.forEach((piece, index) => {
    current += piece;
    const lastToken = current.trim().split(/\s+/).pop() || "";
    if (index < pieces.length - 1 && /^[A-Za-z]$/.test(lastToken)) {
      current += "/";
    } else {
      parts.push(current.trim());
      current = "";
    }
  });
  return parts.filter(Boolean);
}

function isoDay(date) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function normalizeDeliveryType(raw) {
  const value = normalizeName(raw);
  if (!value || value === "loc" || value === "local") return "local";
  if (value === "exp" || value === "express") return "express";
  return value;
}

// Picks auto / suggested / unresolved from ranked candidates.
function pickFromRanked(ranked, autoScore = AUTO_SCORE) {
  const [best, second] = ranked;
  if (!best) return { status: "unresolved", value: null };
  const unique = best.score === 1 || !second || second.score < autoScore;
  if (best.score >= autoScore && unique) return { status: "auto", best };
  if (best.score >= SUGGEST_SCORE) return { status: "suggested", best };
  return { status: "unresolved", value: null };
}

async function loadReferenceData(companyId) {
  const deliverer = await Deliverer.findById(companyId).lean();
  if (!deliverer) {
    const error = new Error("Deliverer not found");
    error.statusCode = 404;
    throw error;
  }

  const companyKey = String(companyId);
  const [contractors, drivers, vehicles, customers, rates] = await Promise.all([
    Contractor.find({ _id: { $in: deliverer.contractor_ids || [] } })
      .select("companyName prefix lastOrder vehiclesTypes")
      .lean(),
    Driver.find({
      $or: [{ _id: { $in: deliverer.driver_ids || [] } }, { companyId: companyKey }],
    })
      .select("name")
      .lean(),
    Vehicle.find({
      $or: [{ _id: { $in: deliverer.vehicle_ids || [] } }, { companyId: companyKey }],
    })
      .select("make regNumber size")
      .lean(),
    Customer.find({}).select("name").lean(),
    Rate.find({ deliverer: companyId }).lean(),
  ]);

  const linkedCustomerIds = new Set((deliverer.customer_ids || []).map(String));
  // Prefer the deliverer's own customers when names collide.
  customers.sort(
    (a, b) =>
      Number(linkedCustomerIds.has(String(b._id))) -
      Number(linkedCustomerIds.has(String(a._id)))
  );

  return {
    deliverer,
    contractors,
    drivers,
    vehicles,
    customers,
    rates,
    linkedCustomerIds,
    contractorById: new Map(contractors.map((c) => [String(c._id), c])),
    driverById: new Map(drivers.map((d) => [String(d._id), d])),
    vehicleById: new Map(vehicles.map((v) => [String(v._id), v])),
    customerById: new Map(customers.map((c) => [String(c._id), c])),
  };
}

function createDecisionBook(ref, choices, options) {
  const decisions = new Map();

  function applyChoice(decision, isValid) {
    const chosen = choices[decision.key];
    if (chosen !== undefined && chosen !== null && chosen !== "" && isValid(chosen)) {
      decision.value = chosen;
      decision.status = "chosen";
    }
    decision.needsReview =
      decision.status !== "auto" || Boolean(decision.compound);
    return decision;
  }

  function vehicle(sheetKey, regNumber, label) {
    const key = `vehicle:${sheetKey}`;
    if (decisions.has(key)) return decisions.get(key);
    const exact = ref.vehicles.find(
      (v) => normalizeRegNumber(v.regNumber) === normalizeRegNumber(regNumber)
    );
    // Titles often use the make instead of the plate letters ("DAF 5848"
    // for AFE5848): fall back to the plate digits, confirmed by the make.
    let fallback = null;
    let fallbackStatus = "unresolved";
    if (!exact) {
      const digits = (/(\d{4})/.exec(`${regNumber || ""} ${label || ""}`) || [])[1];
      const byDigits = digits
        ? ref.vehicles.filter((v) => normalizeRegNumber(v.regNumber).endsWith(digits))
        : [];
      if (byDigits.length === 1) {
        fallback = byDigits[0];
        const make = normalizeName(fallback.make);
        const context = normalizeName(`${label || ""} ${regNumber || ""}`);
        fallbackStatus = make && context.includes(make.split(" ")[0]) ? "auto" : "suggested";
      }
    }
    const match = exact || fallback;
    const decision = {
      key,
      kind: "vehicle",
      raw: label || regNumber,
      status: exact ? "auto" : fallbackStatus,
      value: match ? String(match._id) : null,
      options: ref.vehicles.map((v) => ({
        value: String(v._id),
        label: `${v.make?.trim() || "Vehicle"} ${v.regNumber}`,
      })),
      uses: 0,
    };
    decisions.set(key, applyChoice(decision, (id) => ref.vehicleById.has(id)));
    return decision;
  }

  function driver(raw) {
    const key = `driver:${normalizeName(raw)}`;
    if (decisions.has(key)) return decisions.get(key);
    const ranked = rankCandidates(raw, ref.drivers, (d) => d.name, {
      minScore: SUGGEST_SCORE,
    });
    const pick = pickFromRanked(ranked);
    const decision = {
      key,
      kind: "driver",
      raw,
      status: pick.status,
      value: pick.best ? String(pick.best.item._id) : null,
      options: ref.drivers.map((d) => ({
        value: String(d._id),
        label: d.name,
        score: roundMoney(similarity(raw, d.name)),
      })),
      uses: 0,
    };
    decision.options.sort((a, b) => b.score - a.score);
    decisions.set(key, applyChoice(decision, (id) => ref.driverById.has(id)));
    return decision;
  }

  function contractor(raw) {
    const key = `contractor:${normalizeName(raw)}`;
    if (decisions.has(key)) return decisions.get(key);
    const scoreOf = (c) =>
      normalizeName(c.prefix) === normalizeName(raw)
        ? 1
        : similarity(raw, c.companyName);
    const ranked = ref.contractors
      .map((item) => ({ item, score: scoreOf(item) }))
      .filter((entry) => entry.score >= SUGGEST_SCORE)
      .sort((a, b) => b.score - a.score);
    const pick = pickFromRanked(ranked);
    const decision = {
      key,
      kind: "contractor",
      raw,
      status: pick.status,
      value: pick.best ? String(pick.best.item._id) : null,
      options: [
        ...ref.contractors.map((c) => ({
          value: String(c._id),
          label: `${c.companyName} (${c.prefix})`,
        })),
        { value: SKIP, label: "Skip — don't import these trips" },
      ],
      uses: 0,
    };
    decisions.set(
      key,
      applyChoice(decision, (id) => id === SKIP || ref.contractorById.has(id))
    );
    return decision;
  }

  function customer(raw) {
    const key = `customer:${normalizeName(raw)}`;
    if (decisions.has(key)) return decisions.get(key);

    // A place that exists verbatim (e.g. "NMB B/Dale") is never compound.
    const exactWhole = ref.customers.some(
      (c) => normalizeName(c.name) === normalizeName(raw)
    );
    const parts = exactWhole ? [raw] : splitCompound(raw);
    const compound = parts.length > 1;
    const target = compound && options.useFirstNameForCompound ? parts[0] : raw;

    const optionMap = new Map();
    const addOption = (value, label, score) => {
      if (!optionMap.has(value)) optionMap.set(value, { value, label, score });
    };

    const rankFor = (text) =>
      rankCandidates(text, ref.customers, (c) => c.name, {
        minScore: SUGGEST_SCORE,
        limit: 4,
      });

    const targetRanked = rankFor(target);
    const pick = pickFromRanked(targetRanked, CUSTOMER_AUTO_SCORE);
    targetRanked.forEach(({ item, score }) =>
      addOption(String(item._id), item.name, roundMoney(score))
    );
    if (compound) {
      [...parts, raw].forEach((text) =>
        rankFor(text).forEach(({ item, score }) =>
          addOption(String(item._id), item.name, roundMoney(score))
        )
      );
    }
    // Offer "create new" only for names that don't already exist exactly.
    const addNewOption = (text) => {
      const exists = ref.customers.some(
        (c) => normalizeName(c.name) === normalizeName(text)
      );
      if (exists) return;
      const name = toTitleCase(text);
      addOption(`${NEW_PREFIX}${name}`, `+ New customer "${name}"`);
    };
    const newTargetName = toTitleCase(target);
    addNewOption(target);
    if (compound) {
      parts.forEach(addNewOption);
      addNewOption(raw);
    }

    let status = pick.status;
    let value = pick.best ? String(pick.best.item._id) : null;
    if (status === "unresolved") {
      status = "new";
      value = `${NEW_PREFIX}${newTargetName}`;
    }

    const decision = {
      key,
      kind: "customer",
      raw,
      compound,
      status,
      value,
      options: [...optionMap.values()],
      uses: 0,
    };
    decisions.set(
      key,
      applyChoice(
        decision,
        (v) =>
          ref.customerById.has(v) ||
          (typeof v === "string" && v.startsWith(NEW_PREFIX) && v.length > NEW_PREFIX.length)
      )
    );
    return decision;
  }

  return { decisions, vehicle, driver, contractor, customer };
}

function customerLabel(value, ref) {
  if (!value) return "";
  if (value.startsWith(NEW_PREFIX)) return value.slice(NEW_PREFIX.length).trim();
  return ref.customerById.get(value)?.name || "";
}

function findRate(ref, contractorId, deliveryType, size) {
  const rateDoc = ref.rates.find((r) => String(r.contractor) === contractorId);
  const rateType = rateDoc?.rateTypes?.find((r) => r.rateType === deliveryType);
  const rate = rateType ? rateType[size] : undefined;
  return typeof rate === "number" && Number.isFinite(rate) ? rate : null;
}

async function findExistingLegKeys(legs) {
  const vehicleIds = [...new Set(legs.map((leg) => leg.vehicleId).filter(Boolean))];
  const mileages = [...new Set(legs.map((leg) => leg.mileageOut))];
  if (!vehicleIds.length || !mileages.length) return new Set();
  const existing = await Job.find({
    vehicleId: { $in: vehicleIds },
    mileageOut: { $in: [...mileages.map(String), ...mileages] },
  })
    .select("vehicleId mileageOut mileageIn")
    .lean();
  return new Set(
    existing.map(
      (job) => `${job.vehicleId}|${Number(job.mileageOut)}|${Number(job.mileageIn)}`
    )
  );
}

/**
 * @param {object} params
 * @param {{fileName: string, buffer: Buffer}[]} params.files
 * @param {string} params.companyId  deliverer id (req.user.companyId)
 * @param {object} [params.choices]  decision key -> chosen value
 * @param {object} [params.options]  { useFirstNameForCompound: boolean }
 */
async function buildImportPreview({ files, companyId, choices = {}, options = {} }) {
  const settings = { useFirstNameForCompound: true, ...options };
  const ref = await loadReferenceData(companyId);
  const book = createDecisionBook(ref, choices, settings);

  const sheets = [];
  const legs = [];

  files.forEach(({ fileName, buffer }) => {
    const parsed = parseVehicleLog(buffer, fileName);
    parsed.sheets.forEach((sheet) => {
      const sheetKey = `${fileName}#${sheet.sheetName}`;
      sheets.push({
        fileName,
        sheetName: sheet.sheetName,
        skipped: sheet.skipped,
        reason: sheet.reason,
        regNumber: sheet.regNumber,
        title: sheet.title,
        contractorColumn: sheet.contractorColumn,
        rowCount: sheet.rows.length,
      });
      if (sheet.skipped) return;

      const vehicleDecision = book.vehicle(sheetKey, sheet.regNumber, sheet.title);

      sheet.rows.forEach((row) => {
        const leg = {
          id: `${sheetKey}:${row.rowNumber}`,
          fileName,
          sheetName: sheet.sheetName,
          rowNumber: row.rowNumber,
          date: isoDay(row.date),
          driverRaw: row.driverName,
          fromRaw: row.from,
          toRaw: row.to,
          contractorRaw: row.contractorRaw,
          typeRaw: row.typeRaw,
          deliveryType: normalizeDeliveryType(row.typeRaw),
          mileageOut: row.mileageOut,
          mileageIn: row.mileageIn,
          totalKm: row.totalKm,
          distance: null,
          rate: null,
          cost: null,
          vehicleKey: vehicleDecision.key,
          warnings: [...row.warnings],
          errors: [],
          status: "ready",
          reason: "",
        };
        legs.push(leg);

        // 1. Private / no-contractor trips are never imported.
        if (PRIVATE_CONTRACTORS.has(normalizeName(row.contractorRaw))) {
          leg.status = "skipped";
          leg.reason = row.contractorRaw ? `Private trip (${row.contractorRaw})` : "No contractor";
          return;
        }
        const contractorDecision = book.contractor(row.contractorRaw);
        contractorDecision.uses += 1;
        leg.contractorKey = contractorDecision.key;
        if (contractorDecision.value === SKIP) {
          leg.status = "skipped";
          leg.reason = `Contractor "${row.contractorRaw}" set to skip`;
          return;
        }

        // 2. Row-level validation.
        if (!row.date) leg.errors.push("Missing or unreadable date");
        if (row.mileageOut === null) leg.errors.push("Missing mileage out");
        if (row.mileageIn === null) leg.errors.push("Missing mileage in");
        if (!row.from) leg.errors.push("Missing From");
        if (!row.to) leg.errors.push("Missing To");
        if (!row.driverName) leg.errors.push("Missing driver");
        if (row.mileageOut !== null && row.mileageIn !== null) {
          leg.distance = row.mileageIn - row.mileageOut;
          if (leg.distance < 0) leg.errors.push("Mileage in is lower than mileage out");
          if (row.totalKm !== null && row.totalKm !== leg.distance) {
            leg.warnings.push(
              `Total KM says ${row.totalKm}, mileage gives ${leg.distance} — using ${leg.distance}`
            );
          }
        }

        // 3. Entity decisions (recorded even for error rows so the user
        //    sees every name the sheet uses).
        vehicleDecision.uses += 1;
        if (row.driverName) {
          const d = book.driver(row.driverName);
          d.uses += 1;
          leg.driverKey = d.key;
        }
        if (row.from) {
          const d = book.customer(row.from);
          d.uses += 1;
          leg.fromKey = d.key;
        }
        if (row.to) {
          const d = book.customer(row.to);
          d.uses += 1;
          leg.toKey = d.key;
        }

        if (leg.errors.length) {
          leg.status = "error";
          leg.reason = leg.errors.join("; ");
        }
      });
    });
  });

  // 4. Resolve decisions into ids + price legs.
  const { decisions } = book;
  const valueOf = (key) => (key ? decisions.get(key)?.value : null);

  legs.forEach((leg) => {
    if (leg.status !== "ready") return;
    leg.vehicleId = valueOf(leg.vehicleKey);
    leg.driverId = valueOf(leg.driverKey);
    leg.contractorId = valueOf(leg.contractorKey);
    leg.fromValue = valueOf(leg.fromKey);
    leg.toValue = valueOf(leg.toKey);

    const unresolved = [];
    if (!leg.vehicleId) unresolved.push("vehicle");
    if (!leg.driverId) unresolved.push("driver");
    if (!leg.contractorId) unresolved.push("contractor");
    if (unresolved.length) {
      leg.status = "blocked";
      leg.reason = `Choose a ${unresolved.join(", ")} in the review`;
      return;
    }

    const vehicle = ref.vehicleById.get(leg.vehicleId);
    const contractor = ref.contractorById.get(leg.contractorId);
    leg.regNumber = vehicle.regNumber;
    leg.contractorName = contractor.companyName;
    leg.driverName = ref.driverById.get(leg.driverId)?.name || "";
    leg.fromName = customerLabel(leg.fromValue, ref);
    leg.toName = customerLabel(leg.toValue, ref);

    const rate = findRate(ref, leg.contractorId, leg.deliveryType, vehicle.size);
    if (rate === null) {
      leg.status = "error";
      leg.reason = `No "${leg.deliveryType}" rate for ${contractor.companyName} on ${vehicle.size}`;
      return;
    }
    if (
      Array.isArray(contractor.vehiclesTypes) &&
      contractor.vehiclesTypes.length &&
      !contractor.vehiclesTypes.includes(vehicle.size)
    ) {
      leg.warnings.push(`${contractor.companyName} is not set up for ${vehicle.size}`);
    }
    leg.rate = rate;
    leg.cost = roundMoney(rate * leg.distance);
  });

  // 5. Duplicates: against the DB, and within this upload.
  const readyLegs = legs.filter((leg) => leg.status === "ready");
  const existingKeys = await findExistingLegKeys(readyLegs);
  const seenKeys = new Set();
  readyLegs.forEach((leg) => {
    const key = `${leg.vehicleId}|${leg.mileageOut}|${leg.mileageIn}`;
    if (existingKeys.has(key)) {
      leg.status = "duplicate";
      leg.reason = "Already in the system";
    } else if (seenKeys.has(key)) {
      leg.status = "duplicate";
      leg.reason = "Appears twice in this upload";
    }
    seenKeys.add(key);
  });

  // 6. Group consecutive legs into jobs: same vehicle, day, driver,
  //    contractor and type, with an unbroken odometer chain.
  const jobs = [];
  let current = null;
  legs.forEach((leg) => {
    if (leg.status !== "ready") return;
    const continues =
      current &&
      current.vehicleId === leg.vehicleId &&
      current.date === leg.date &&
      current.driverId === leg.driverId &&
      current.contractorId === leg.contractorId &&
      current.deliveryType === leg.deliveryType &&
      current.lastMileageIn === leg.mileageOut;
    if (!continues) {
      current = {
        tempId: `job-${jobs.length + 1}`,
        vehicleId: leg.vehicleId,
        regNumber: leg.regNumber,
        date: leg.date,
        driverId: leg.driverId,
        driverName: leg.driverName,
        contractorId: leg.contractorId,
        contractorName: leg.contractorName,
        deliveryType: leg.deliveryType,
        rate: leg.rate,
        legIds: [],
        route: [leg.fromName],
        distance: 0,
        cost: 0,
      };
      jobs.push(current);
    }
    current.legIds.push(leg.id);
    current.route.push(leg.toName);
    current.distance += leg.distance;
    current.cost = roundMoney(current.cost + leg.cost);
    current.lastMileageIn = leg.mileageIn;
    leg.jobTempId = current.tempId;
  });

  // Provisional job numbers, in date order per contractor. Final numbers
  // are reserved atomically at commit time.
  const nextByContractor = new Map();
  [...jobs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((job) => {
      const contractor = ref.contractorById.get(job.contractorId);
      const next =
        nextByContractor.get(job.contractorId) ?? (Number(contractor.lastOrder) || 1);
      job.jobNumber = `${contractor.prefix || ""}${String(next).padStart(4, "0")}`;
      nextByContractor.set(job.contractorId, next + 1);
    });
  jobs.forEach((job) => delete job.lastMileageIn);

  // 7. Only surface decisions that ready/blocked legs actually depend on,
  //    plus contractors (so a skip can be undone).
  const liveKeys = new Set();
  legs.forEach((leg) => {
    if (leg.contractorKey) liveKeys.add(leg.contractorKey);
    if (["ready", "blocked", "duplicate"].includes(leg.status)) {
      [leg.vehicleKey, leg.driverKey, leg.fromKey, leg.toKey]
        .filter(Boolean)
        .forEach((key) => liveKeys.add(key));
    }
  });
  const decisionList = [...decisions.values()].filter((d) => liveKeys.has(d.key));

  const newCustomerNames = [
    ...new Set(
      legs
        .filter((leg) => leg.status === "ready")
        .flatMap((leg) => [leg.fromValue, leg.toValue])
        .filter((value) => value?.startsWith(NEW_PREFIX))
        .map((value) => value.slice(NEW_PREFIX.length).trim())
    ),
  ];

  const count = (status) => legs.filter((leg) => leg.status === status).length;
  const summary = {
    legs: legs.length,
    ready: count("ready"),
    skipped: count("skipped"),
    duplicate: count("duplicate"),
    error: count("error"),
    blocked: count("blocked"),
    jobs: jobs.length,
    distance: jobs.reduce((sum, job) => sum + job.distance, 0),
    cost: roundMoney(jobs.reduce((sum, job) => sum + job.cost, 0)),
    newCustomers: newCustomerNames.length,
    toReview: decisionList.filter((d) => d.needsReview).length,
  };

  return {
    options: settings,
    canCommit: summary.blocked === 0 && summary.ready > 0,
    summary,
    sheets,
    decisions: decisionList,
    newCustomerNames,
    jobs,
    legs,
  };
}

module.exports = { buildImportPreview, NEW_PREFIX, SKIP };
