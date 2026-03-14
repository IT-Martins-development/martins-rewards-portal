const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI || process.env.mongodbUri;
const DB_NAME = "martins";

let cachedClient = null;

const TASK_ORDER = {
  "Pre Construction": [
    "Survey",
    "Energy/ Load Calculation",
    "Plans",
    "Septic Permit",
    "Truss Engineer",
    "Internal Plans Review",
    "Permit Application Send",
    "Application fee",
    "Review Plans - Gate Check",
    "Permit issued",
  ],
  "Phase 1": [
    "Lot clearing",
    "Elevation stakes",
    "Pad build",
    "Compaction test",
    "Hub and tack",
    "Railing",
    "Rough underground plumbing",
    "Order Dumpster & Toilet",
    "Inspection - Plumbing Underground",
    "Inspection - Water Service",
    "Order Rebar Pre Slab",
    "Delivery - Pre slab",
    "Pre Slab",
    "Inspection - Pre slab",
    "Slab pour",
    "Order Block & Rebars",
    "Delivery - Block rebars",
    "Block labor",
    "Truss layout labor",
    "Inspection - Lintel",
    "Electrical TUG Installation",
    "Lintel pour",
    "Inspection - Const ELE - TUG",
    "Stucco Grade",
  ],
  "Phase 2": [
    "Delivery - Trusses",
    "Delivery - Lumber",
    "Framing & Roof Assembly",
    "Inspection - Roof Assembly",
    "Inspection - Sub-siding",
    "2nd rough plumbing",
    "Roof Dry-in",
    "Delivery Windows & Doors",
    "Windows and doors installation",
    "HVAC Installation",
    "Inspection - Rough Plumbing",
    "Inspection - Roofing Dry-In",
    "Framing punch out",
    "Wire lath installation",
    "Eletrical Rough",
    "Inspection - Rough Mechanical",
    "Inspection - Wire Lath",
    "Stucco",
    "Order Paver Driveway",
    "Inspection - Rough Electric",
    "Delivery - Shingles & Vents",
    "Shingle installation",
    "Inspection - Frame Structural",
    "Delivery Insulation",
    "Insulation",
    "Inspection - Insulation",
  ],
  "Phase 3": [
    "Delivery - Drywall",
    "Drywall hanging and finish",
    "Interior Painting",
    "Exterior painting",
    "Garage Door installation",
    "Delivery - VinylTile",
    "Soffit installation",
    "Tile Installation",
    "Driveway Lot",
    "Delivery Blowing Insulation - Warehouse",
    "Delivery Metalita Tile, Finish Plumbing & Electric",
    "Vinyl Installation",
    "Driveway Railing / base",
    "Blowing insulation",
    "Cabinet installation",
    "Inspection - Flatwork Pre pavi",
    "Inspection - Driveway Apron Form Up",
    "Driveway Concrete or Paver",
    "Inspection Blowing Installation",
    "Countertop installation",
    "Final Grade",
    "Delivery - Interior Door and Trim",
    "HVAC Machine Installation",
    "Electric - For Power Installation",
    "Plumbing Trim",
    "Sod installation",
    "Doors And Trim Installation",
    "Inspection - Final Plumbing",
    "Blowing Door Test",
    "Termite bait system",
    "Inspection - Driveway Apron Final",
    "Hot Check",
    "Appliance Delivery",
    "Appliance install",
    "Turn on AC",
    "Inspection - Final Electric",
    "Trim and door & Final painting",
    "Remove Dumpster",
    "Inspection - Final Structural",
    "Inspection - Final Mechanical",
    "Quality check",
    "CO issued",
    "Final Cleaning",
    "Walktrough",
  ],
  Utilities: [
    "Electrical Request",
    "Water Install",
    "Electrical Payment",
    "Electrical - Inspection TUG",
    "Electrical Meter Install",
    "Septic Request",
    "Septic Install",
    "Inspection - Site Departure - Septic",
  ],
  Supplies: [
    "Order Trusses",
    "Order Windows & Door",
    "Order Insulation",
    "Order Lumber",
    "Choose Cabinet Tile & Vinyl",
    "Order Tub Bath Guest - Warehouse",
    "Order Shingles & Vents",
    "Order Drywall",
    "Request/Order Delivery Tile & Vinyl",
    "Order Trim Doors",
    "Order Appliances",
    "Request Bath Service",
  ],
};

async function connectToDatabase() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client;
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

function getPhaseStatusFromView(row, phase) {
  switch (phase) {
    case "Phase 1":
      return row.StatusPhase1 || null;
    case "Phase 2":
      return row.StatusPhase2 || null;
    case "Phase 3":
      return row.StatusPhase3 || null;
    default:
      return null;
  }
}

function getPhaseDaysFromView(row, phase) {
  switch (phase) {
    case "Phase 1":
    case "Phase 2":
    case "Phase 3":
      return Number(row.daysInPhase || 0);
    default:
      return 0;
  }
}

function getPhaseColorFromView(row, phase) {
  if (["Phase 1", "Phase 2", "Phase 3"].includes(phase)) {
    return row.phaseColor || null;
  }
  return null;
}

function resolveTaskVisual(task, now = new Date()) {
  if (!task) {
    return {
      status: "Null",
      color: "gray",
      alert: null,
      displayDate: null,
    };
  }

  const rawStatus = String(task.status || "Todo").trim();
  const normalized = rawStatus.toLowerCase();
  const startDate = task.startDate ? new Date(task.startDate) : null;
  const endDate = task.endDate ? new Date(task.endDate) : null;

  if (normalized === "done") {
    return {
      status: "Done",
      color: "green",
      alert: null,
      displayDate: endDate,
    };
  }

  if (normalized === "in progress" || normalized === "inprogress") {
    return {
      status: "In Progress",
      color: "blue",
      alert: null,
      displayDate: startDate,
    };
  }

  let alert = null;

  if (startDate) {
    const diffDays = Math.ceil(
      (startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays < 0) {
      alert = "danger";
    } else if (diffDays <= 3) {
      alert = "warning";
    }
  }

  return {
    status: normalized === "pending" ? "Pending" : "Todo",
    color: "gray",
    alert,
    displayDate: startDate,
  };
}

function normalizeTask(task) {
  return {
    title: task.title || "",
    status: task.status || "Todo",
    startDate: task.startDate || null,
    endDate: task.endDate || null,
    workdays: Number(task.workDays ?? task.workdays ?? 0),
  };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return response(200, { ok: true });
    }

    const client = await connectToDatabase();
    const db = client.db(DB_NAME);

    const payload =
      event.httpMethod === "POST"
        ? JSON.parse(event.body || "{}")
        : event.queryStringParameters || {};

    const phase = payload.phase || "Phase 1";
    const taskOrder = TASK_ORDER[phase] || [];

    const projectFilter = {};

    if (payload.operator) {
      projectFilter.majorityOperatorName = payload.operator;
    }

    if (payload.county) {
      projectFilter.county = payload.county;
    }

    if (payload.projectColor) {
      projectFilter.projectColor = payload.projectColor;
    }

    if (payload.project) {
      projectFilter["project.title"] = {
        $regex: payload.project,
        $options: "i",
      };
    }

    if (payload.currentPhase) {
      projectFilter.currentPhase = payload.currentPhase;
    } else if (String(payload.showConcluded) === "false" || payload.showConcluded === false) {
      projectFilter.currentPhase = { $ne: "Concluded" };
    }

    const projectRows = await db
      .collection("view_project_status")
      .find(projectFilter)
      .toArray();

    const projectIds = projectRows
      .map((p) => String(p.projectId))
      .filter(Boolean);

    const taskFilter = {
      projectId: { $in: projectIds },
      ToRemove: { $ne: true },
    };

    const tasks = await db.collection("tasks").find(taskFilter).toArray();

    const tasksByProjectAndPhase = new Map();

    for (const task of tasks) {
      const pid = String(task.projectId || "");
      if (!pid) continue;

      const title = String(task.title || "").trim();
      if (!title) continue;

      const bucketKey = `${pid}__${phase}`;
      const allowedTitles = new Set(taskOrder);

      if (!allowedTitles.has(title)) continue;

      if (!tasksByProjectAndPhase.has(bucketKey)) {
        tasksByProjectAndPhase.set(bucketKey, []);
      }

      tasksByProjectAndPhase.get(bucketKey).push(task);
    }

    let rows = projectRows.map((projectRow) => {
      const pid = String(projectRow.projectId || "");
      const bucketKey = `${pid}__${phase}`;
      const rawTasks = tasksByProjectAndPhase.get(bucketKey) || [];

      const taskMap = {};
      for (const taskName of taskOrder) {
        const found = rawTasks.find((t) => String(t.title || "").trim() === taskName);
        const normalizedTask = found ? normalizeTask(found) : null;

        taskMap[taskName] = normalizedTask
          ? {
              ...normalizedTask,
              visual: resolveTaskVisual(normalizedTask),
            }
          : null;
      }

      return {
        projectId: pid,
        project: projectRow.project?.title || "",
        operator: projectRow.majorityOperatorName || "",
        county: projectRow.county || "",
        projectColor: projectRow.projectColor || "",
        currentPhase: projectRow.currentPhase || "",
        phaseStatus: getPhaseStatusFromView(projectRow, phase),
        phaseDays: getPhaseDaysFromView(projectRow, phase),
        phaseColor: getPhaseColorFromView(projectRow, phase),
        tasks: taskMap,
      };
    });

    if (payload.phaseStatus) {
      rows = rows.filter((r) => r.phaseStatus === payload.phaseStatus);
    }

    return response(200, {
      ok: true,
      phase,
      taskOrder,
      rows,
    });
  } catch (error) {
    console.error("getProjectsTimelineByPhase error:", error);
    return response(500, {
      ok: false,
      message: error.message || "Internal server error",
    });
  }
};