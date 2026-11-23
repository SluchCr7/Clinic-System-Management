require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const mongoose = require("mongoose");
const LabOrder = require("../modules/LabOrder/labOrder.model");

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/clinic_management";

const statusMap = {
  ordered: "REQUESTED",
  sample_collected: "REQUESTED",
  processing: "REQUESTED",
  completed: "RESULT_RECEIVED",
  cancelled: "CANCELLED",
};

async function runMigration() {
  await mongoose.connect(MONGO_URI);
  const collection = mongoose.connection.collection("laborders");
  const legacyOrders = await collection.find({
    status: { $in: Object.keys(statusMap) },
  }).toArray();

  let migrated = 0;
  for (const order of legacyOrders) {
    await collection.updateOne(
      { _id: order._id },
      {
        $set: {
          legacyStatus: order.legacyStatus || order.status,
          status: statusMap[order.status],
          type: order.type || "LAB",
          requestedAt: order.requestedAt || order.orderedAt || order.createdAt || new Date(),
          requestedBy: order.requestedBy || order.createdBy || null,
          instructions: order.instructions || null,
          clinicalNotes: order.clinicalNotes || null,
          updatedAt: new Date(),
        },
      }
    );
    migrated += 1;
  }

  await collection.createIndexes([
    { key: { status: 1, patient: 1, visit: 1 }, name: "status_patient_visit" },
    { key: { patient: 1, createdAt: -1 }, name: "patient_createdAt" },
    { key: { doctor: 1, createdAt: -1 }, name: "doctor_createdAt" },
  ]);

  console.log(`Lab external-referral migration complete: ${migrated} orders migrated.`);
  await mongoose.disconnect();
  return migrated;
}

async function rollbackMigration() {
  await mongoose.connect(MONGO_URI);
  const collection = mongoose.connection.collection("laborders");
  const migratedOrders = await collection.find({
    legacyStatus: { $in: Object.keys(statusMap) },
  }).toArray();

  let restored = 0;
  for (const order of migratedOrders) {
    await collection.updateOne(
      { _id: order._id },
      {
        $set: {
          status: order.legacyStatus,
          updatedAt: new Date(),
        },
        $unset: {
          legacyStatus: "",
        },
      }
    );
    restored += 1;
  }

  console.log(`Lab external-referral rollback complete: ${restored} orders restored.`);
  await mongoose.disconnect();
  return restored;
}

if (require.main === module) {
  const command = process.argv.includes("--rollback")
    ? rollbackMigration()
    : runMigration();
  command.catch((error) => {
    console.error("Lab external-referral migration failed:", error);
    process.exit(1);
  });
}

module.exports = { runMigration, rollbackMigration, statusMap };
