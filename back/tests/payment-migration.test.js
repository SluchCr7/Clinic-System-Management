const mongoose = require("mongoose");
const Payment = require("../modules/Payment/payment.model");
const PaymentMethod = require("../modules/PaymentMethod/paymentMethod.model");
const Invoice = require("../modules/Invoice/invoice.model");
const Patient = require("../modules/Patient/patient.model");
const { seedPaymentMethods } = require("../modules/PaymentMethod/paymentMethod.service");
const {
  createTestUser,
  createTestPatient,
  createTestDoctor,
} = require("./testHelper");

describe("Payment Migration & Payment Method Seed Tests", () => {
  let admin;
  let patient;
  let doctor;
  let invoice;

  beforeAll(async () => {
    await Patient.init();
    await Invoice.init();
    await Payment.init();
    await PaymentMethod.init();
  });

  beforeEach(async () => {
    admin = await createTestUser({ role: "admin" });
    ({ doctor } = await createTestDoctor(admin.user));
    patient = await createTestPatient(admin.user, { doctor: doctor._id });

    invoice = await Invoice.create({
      invoiceNumber: `INV-MIG-${Date.now()}`,
      visit: new mongoose.Types.ObjectId(),
      patient: patient._id,
      doctor: doctor._id,
      items: [
        {
          performedService: new mongoose.Types.ObjectId(),
          serviceName: "Consultation",
          serviceCode: "CONSULT",
          unitPrice: 300,
          quantity: 1,
          discount: 0,
          total: 300,
        },
      ],
      subtotal: 300,
      discount: 0,
      tax: 0,
      total: 300,
      paidAmount: 300,
      remainingAmount: 0,
      status: "paid",
      createdBy: admin.user._id,
    });
  });

  test("seedPaymentMethods is idempotent and safe to run repeatedly", async () => {
    const firstRun = await seedPaymentMethods();
    expect(firstRun.length).toBe(3);

    const secondRun = await seedPaymentMethods();
    expect(secondRun.length).toBe(3);

    const methods = await PaymentMethod.find();
    expect(methods.length).toBe(3);

    const defaultMethods = await PaymentMethod.find({ isDefault: true });
    expect(defaultMethods.length).toBe(1);
    expect(defaultMethods[0].code).toBe("cash");
  });

  test("backfills existing legacy payments with paymentMethod, receivedBy, and referenceNumber", async () => {
    await seedPaymentMethods();
    const cashMethod = await PaymentMethod.findOne({ code: "cash" });

    // Create legacy payment without paymentMethod
    const legacyPayment = await Payment.create({
      invoice: invoice._id,
      patient: patient._id,
      amount: 300,
      method: "cash",
      transactionReference: "LEGACY-REF-001",
      createdBy: admin.user._id,
      receivedBy: admin.user._id,
      paymentMethod: null,
      referenceNumber: null,
    });

    expect(legacyPayment.paymentMethod).toBeNull();
    expect(legacyPayment.referenceNumber).toBeNull();

    // Perform backfill
    const paymentsToBackfill = await Payment.find({
      $or: [
        { paymentMethod: null },
        { referenceNumber: null },
      ],
    });

    for (const p of paymentsToBackfill) {
      p.paymentMethod = cashMethod._id;
      p.referenceNumber = p.referenceNumber || p.transactionReference || null;
      await p.save();
    }

    const updated = await Payment.findById(legacyPayment._id);
    expect(updated.paymentMethod.toString()).toBe(cashMethod._id.toString());
    expect(updated.referenceNumber).toBe("LEGACY-REF-001");
  });
});
