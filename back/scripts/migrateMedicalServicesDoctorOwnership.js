require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const mongoose = require("mongoose");
const MedicalService = require("../modules/medicalService/medicalService.model");
const User = require("../modules/User/user.model");

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/clinic_management";

async function runMigration() {
  console.log("Connecting to MongoDB:", MONGO_URI);
  await mongoose.connect(MONGO_URI);
  const collection = mongoose.connection.collection("medicalservices");

  // 1. Drop old single-field unique index on code if present
  try {
    const indexes = await collection.indexes();
    const oldCodeIndex = indexes.find(
      (idx) => idx.name === "code_1" || (idx.key && idx.key.code === 1 && Object.keys(idx.key).length === 1)
    );
    if (oldCodeIndex) {
      console.log(`Dropping old unique index "${oldCodeIndex.name}" on code...`);
      await collection.dropIndex(oldCodeIndex.name);
      console.log("Dropped old unique index successfully.");
    }
  } catch (err) {
    console.warn("Notice checking indexes:", err.message);
  }

  // 2. Find services without doctor
  const unassignedServices = await collection
    .find({
      $or: [{ doctor: { $exists: false } }, { doctor: null }],
    })
    .toArray();

  console.log(`Found ${unassignedServices.length} medical services without doctor assigned.`);

  let migratedCount = 0;
  const manualReviewList = [];

  for (const svc of unassignedServices) {
    let assignedDoctorId = null;

    if (svc.createdBy) {
      const creator = await User.findById(svc.createdBy).lean();
      if (creator && creator.role === "doctor") {
        assignedDoctorId = creator._id;
      }
    }

    if (assignedDoctorId) {
      await collection.updateOne(
        { _id: svc._id },
        {
          $set: {
            doctor: assignedDoctorId,
            priceHistory: svc.priceHistory && svc.priceHistory.length > 0
              ? svc.priceHistory
              : [
                  {
                    price: svc.price || 0,
                    changedAt: svc.createdAt || new Date(),
                    changedBy: svc.createdBy || assignedDoctorId,
                  },
                ],
            updatedAt: new Date(),
          },
        }
      );
      migratedCount++;
    } else {
      manualReviewList.push({
        _id: svc._id,
        name: svc.name,
        code: svc.code,
        createdBy: svc.createdBy,
      });
    }
  }

  // 3. Ensure new compound unique index
  try {
    await collection.createIndex(
      { doctor: 1, code: 1 },
      { unique: true, background: true }
    );
    await collection.createIndex(
      { doctor: 1, category: 1, isActive: 1 },
      { background: true }
    );
    console.log("Compound indexes verified on medicalservices.");
  } catch (err) {
    console.warn("Notice creating compound indexes:", err.message);
  }

  console.log(`\nMigration completed:`);
  console.log(`- Successfully assigned doctor to ${migratedCount} service(s).`);
  if (manualReviewList.length > 0) {
    console.warn(
      `- ${manualReviewList.length} service(s) could NOT be auto-assigned (createdBy is not a doctor). Manual assignment required:`
    );
    console.table(manualReviewList);
  } else {
    console.log("- No services require manual assignment.");
  }

  await mongoose.disconnect();
  return { migratedCount, manualReviewCount: manualReviewList.length };
}

if (require.main === module) {
  runMigration()
    .then(() => {
      console.log("Migration script finished successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}

module.exports = runMigration;
