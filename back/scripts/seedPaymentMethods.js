require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const mongoose = require("mongoose");
const { seedPaymentMethods } = require("../modules/PaymentMethod/paymentMethod.service");

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/clinic_management";

const run = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected successfully.");

    console.log("Seeding payment methods (idempotent)...");
    const results = await seedPaymentMethods();

    console.log("Payment methods seed results:");
    results.forEach(({ action, method }) => {
      console.log(` - [${action.toUpperCase()}] ${method.code} (${method.nameAr} / ${method.nameEn}) - default: ${method.isDefault}, refRequired: ${method.requiresReference}`);
    });

    console.log("Seeding completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding payment methods:", error);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
};

if (require.main === module) {
  run();
}

module.exports = run;
