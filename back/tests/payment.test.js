const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");
const Payment = require("../modules/Payment/payment.model");
const Invoice = require("../modules/Invoice/invoice.model");
const Patient = require("../modules/Patient/patient.model");
const AuditLog = require("../modules/AuditLog/auditLog.model");
const {
  createTestUser,
  createTestPatient,
  createTestDoctor,
} = require("./testHelper");

describe("Payments API", () => {
  let admin;
  let receptionist;
  let doctorUser;
  let patient;
  let doctor;
  let invoice;

  beforeAll(async () => {
    await Patient.init();
    await Invoice.init();
  });

  beforeEach(async () => {
    admin = await createTestUser({ role: "admin" });
    receptionist = await createTestUser({ role: "receptionist" });
    patient = await createTestPatient(admin.user);
    ({ doctor, doctorUser } = await createTestDoctor(admin.user));

    invoice = await Invoice.create({
      invoiceNumber: `INV-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      visit: new mongoose.Types.ObjectId(),
      patient: patient._id,
      doctor: doctor._id,
      items: [
        {
          performedService: new mongoose.Types.ObjectId(),
          serviceName: "Consultation",
          serviceCode: "CONSULT",
          unitPrice: 500,
          quantity: 1,
          discount: 0,
          total: 500,
        },
      ],
      subtotal: 500,
      discount: 0,
      tax: 0,
      total: 500,
      paidAmount: 0,
      remainingAmount: 500,
      status: "unpaid",
      createdBy: admin.user._id,
    });
  });

  const paymentPayload = (overrides = {}) => ({
    invoice: invoice._id.toString(),
    amount: 200,
    method: "cash",
    notes: "First installment",
    ...overrides,
  });

  test("creates a payment transactionally, updates its invoice, and records an audit log", async () => {
    const response = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send(paymentPayload());

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.amount).toBe(200);
    expect(response.body.data.method).toBe("cash");
    expect(response.body.data.patient).toBe(patient._id.toString());
    expect(response.body.data.createdBy).toBe(receptionist.user._id.toString());

    const [savedPayment, updatedInvoice, auditLog] = await Promise.all([
      Payment.findById(response.body.data._id),
      Invoice.findById(invoice._id),
      AuditLog.findOne({
        action: "PAYMENT_CREATED",
        resourceId: response.body.data._id,
      }),
    ]);

    expect(savedPayment).not.toBeNull();
    expect(updatedInvoice.paidAmount).toBe(200);
    expect(updatedInvoice.remainingAmount).toBe(300);
    expect(updatedInvoice.status).toBe("partially_paid");
    expect(updatedInvoice.updatedBy.toString()).toBe(
      receptionist.user._id.toString()
    );
    expect(auditLog).not.toBeNull();
    expect(auditLog.actor.toString()).toBe(receptionist.user._id.toString());
  });

  test("rejects payment amounts above the invoice balance without changing records", async () => {
    const response = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send(paymentPayload({ amount: 600 }));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("PAYMENT_EXCEEDS_REMAINING");
    expect(await Payment.countDocuments()).toBe(0);

    const unchangedInvoice = await Invoice.findById(invoice._id);
    expect(unchangedInvoice.paidAmount).toBe(0);
    expect(unchangedInvoice.remainingAmount).toBe(500);
  });

  test("requires a transaction reference for electronic payment methods", async () => {
    const response = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send(paymentPayload({ amount: 100, method: "card" }));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("TRANSACTION_REFERENCE_REQUIRED");
    expect(await Payment.countDocuments()).toBe(0);
  });

  test("rejects invalid payment payloads", async () => {
    const response = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send(paymentPayload({ amount: -1, method: "cash" }));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  test("rejects payments against cancelled invoices", async () => {
    await Invoice.updateOne(
      { _id: invoice._id },
      { $set: { status: "cancelled" } }
    );

    const response = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send(paymentPayload());

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVOICE_CANCELLED");
    expect(await Payment.countDocuments()).toBe(0);
  });

  test("restricts payment creation to administrators and receptionists", async () => {
    const response = await request(app)
      .post("/api/payments")
      .set("Authorization", doctorUser.authHeader)
      .send(paymentPayload());

    expect(response.status).toBe(403);
    expect(await Payment.countDocuments()).toBe(0);
  });

  test("requires authentication and returns 404 for an unknown payment", async () => {
    const unauthorized = await request(app)
      .get("/api/payments")
      .expect(401);
    expect(unauthorized.body.success).toBe(false);

    const missing = await request(app)
      .get("/api/payments/507f1f77bcf86cd799439011")
      .set("Authorization", admin.authHeader);

    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("PAYMENT_NOT_FOUND");
  });

  test("limits doctors to payments for their own invoices", async () => {
    const ownPayment = await Payment.create({
      invoice: invoice._id,
      patient: patient._id,
      amount: 100,
      method: "cash",
      createdBy: receptionist.user._id,
    });
    const otherDoctor = await createTestDoctor(admin.user);
    const otherInvoice = await Invoice.create({
      invoiceNumber: `INV-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      visit: new mongoose.Types.ObjectId(),
      patient: patient._id,
      doctor: otherDoctor.doctor._id,
      items: [
        {
          performedService: new mongoose.Types.ObjectId(),
          serviceName: "Consultation",
          serviceCode: "CONSULT",
          unitPrice: 100,
          quantity: 1,
          discount: 0,
          total: 100,
        },
      ],
      subtotal: 100,
      discount: 0,
      tax: 0,
      total: 100,
      paidAmount: 100,
      remainingAmount: 0,
      status: "paid",
      createdBy: admin.user._id,
    });
    const otherPayment = await Payment.create({
      invoice: otherInvoice._id,
      patient: patient._id,
      amount: 100,
      method: "cash",
      createdBy: receptionist.user._id,
    });

    const ownResponse = await request(app)
      .get(`/api/payments/${ownPayment._id}`)
      .set("Authorization", doctorUser.authHeader);
    const otherResponse = await request(app)
      .get(`/api/payments/${otherPayment._id}`)
      .set("Authorization", doctorUser.authHeader);

    expect(ownResponse.status).toBe(200);
    expect(otherResponse.status).toBe(404);
  });
});
