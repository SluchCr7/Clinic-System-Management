require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const mongoose = require("mongoose");
const Payment = require("../modules/Payment/payment.model");
const PaymentMethod = require("../modules/PaymentMethod/paymentMethod.model");
const { seedPaymentMethods } = require("../modules/PaymentMethod/paymentMethod.service");

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/clinic_management";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run") || args.includes("-d");
const isRollback = args.includes("--rollback") || args.includes("-r");

const migrate = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected successfully.");

    if (isRollback) {
      console.log(`\n=== Running Rollback: Reverting PaymentMethod Backfill === [DryRun: ${isDryRun}]`);

      const filter = { paymentMethod: { $ne: null } };
      const count = await Payment.countDocuments(filter);
      console.log(`Found ${count} payments with paymentMethod populated.`);

      if (isDryRun) {
        console.log(`[DRY-RUN] Would unset paymentMethod and referenceNumber on ${count} payments.`);
      } else {
        const result = await Payment.updateMany(
          filter,
          {
            $set: { paymentMethod: null, referenceNumber: null },
          }
        );
        console.log(`[ROLLBACK SUCCESS] Updated ${result.modifiedCount} payments.`);
      }

      process.exit(0);
    }

    console.log(`\n=== Running Migration: Backfilling Payments to PaymentMethod === [DryRun: ${isDryRun}]`);

    // Ensure payment methods exist
    await seedPaymentMethods();
    const cashMethod = await PaymentMethod.findOne({ code: "cash" });
    if (!cashMethod) {
      throw new Error("Default cash payment method could not be found or created.");
    }

    const cardMethod = await PaymentMethod.findOne({ code: "card" });
    const vodafoneMethod = await PaymentMethod.findOne({ code: "vodafone_cash" });

    const methodMap = {
      cash: cashMethod._id,
      card: cardMethod?._id || cashMethod._id,
      bank_transfer: cardMethod?._id || cashMethod._id,
      online: cardMethod?._id || cashMethod._id,
      vodafone_cash: vodafoneMethod?._id || cashMethod._id,
    };

    // Find payments that need backfill
    const paymentsToBackfill = await Payment.find({
      $or: [
        { paymentMethod: null },
        { paymentMethod: { $exists: false } },
        { receivedBy: null },
        { receivedBy: { $exists: false } },
        { referenceNumber: null },
      ],
    });

    console.log(`Found ${paymentsToBackfill.length} payments requiring backfill.`);

    if (paymentsToBackfill.length === 0) {
      console.log("All payments are already up to date. Nothing to do.");
      process.exit(0);
    }

    let updatedCount = 0;

    for (const payment of paymentsToBackfill) {
      const assignedMethodId = methodMap[payment.method] || cashMethod._id;
      const assignedReceivedBy = payment.receivedBy || payment.createdBy;
      const assignedReference = payment.referenceNumber || payment.transactionReference || null;

      if (isDryRun) {
        if (updatedCount < 5) {
          console.log(`[DRY-RUN Sample] Payment ${payment._id}: method=${payment.method} -> paymentMethod=${assignedMethodId}, receivedBy=${assignedReceivedBy}, ref=${assignedReference}`);
        }
        updatedCount++;
      } else {
        payment.paymentMethod = payment.paymentMethod || assignedMethodId;
        payment.receivedBy = payment.receivedBy || assignedReceivedBy;
        payment.referenceNumber = payment.referenceNumber || assignedReference;
        if (!payment.createdBy && assignedReceivedBy) {
          payment.createdBy = assignedReceivedBy;
        }
        await payment.save();
        updatedCount++;
      }
    }

    if (isDryRun) {
      console.log(`\n[DRY-RUN COMPLETE] Evaluated ${updatedCount} payments. No database writes were made.`);
    } else {
      console.log(`\n[MIGRATION SUCCESS] Successfully backfilled ${updatedCount} payments.`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
};

if (require.main === module) {
  migrate();
}

module.exports = migrate;
