const Counter = require("./counter.model");

const generateInvoiceNumber = async (session) => {
  const year = new Date().getFullYear();

  const counterName = `invoice-${year}`;

  const counter = await Counter.findOneAndUpdate(
    {
      name: counterName,
    },
    {
      $inc: {
        sequence: 1,
      },
    },
    {
      new: true,
      upsert: true,
      session,
    }
  );

  return `INV-${year}-${String(counter.sequence).padStart(
    6,
    "0"
  )}`;
};

module.exports = generateInvoiceNumber;