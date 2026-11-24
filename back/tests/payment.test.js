const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");
const Payment = require("../modules/Payment/payment.model");
const Invoice = require("../modules/Invoice/invoice.model");
const Patient = require("../modules/Patient/patient.model");
const AuditLog = require("../modules/AuditLog/auditLog.model");
const PaymentMethod = require("../modules/PaymentMethod/paymentMethod.model");
const { seedPaymentMethods } = require("../modules/PaymentMethod/paymentMethod.service");
const {
  createTestUser,
  createTestPatient,
  createTestDoctor,
  assignTestDoctor,
} = require("./testHelper");

describe("Payments & Payment Methods API", () => {
  let admin;
  let receptionist;
  let doctorUser;
  let patient;
  let doctor;
  let invoice;
  let cashMethod;
  let cardMethod;
  let vodafoneMethod;

  beforeAll(async () => {
    await Patient.init();
    await Invoice.init();
    await Payment.init();
    await PaymentMethod.init();
  });

  beforeEach(async () => {
    await seedPaymentMethods();
    cashMethod = await PaymentMethod.findOne({ code: "cash" });
    cardMethod = await PaymentMethod.findOne({ code: "card" });
    vodafoneMethod = await PaymentMethod.findOne({ code: "vodafone_cash" });

    admin = await createTestUser({ role: "admin" });
    receptionist = await createTestUser({ role: "receptionist" });
    ({ doctor, doctorUser } = await createTestDoctor(admin.user));
    await assignTestDoctor(receptionist.user, doctor, admin.user);
    patient = await createTestPatient(receptionist.user, { doctor: doctor._id });

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
    paymentMethod: cashMethod._id.toString(),
    notes: "First installment",
    ...overrides,
  });

  test("creates a payment transactionally, updates invoice, and records audit log", async () => {
    const response = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send(paymentPayload());

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.amount).toBe(200);
    expect(response.body.data.method).toBe("cash");
    expect(response.body.data.patient._id.toString()).toBe(patient._id.toString());
    expect(response.body.data.receivedBy._id.toString()).toBe(receptionist.user._id.toString());
    expect(response.body.data.paymentMethod.code).toBe("cash");

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

  test("defaults to cash method when paymentMethod is omitted", async () => {
    const payload = paymentPayload();
    delete payload.paymentMethod;
    delete payload.method;

    const response = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.data.method).toBe("cash");
    expect(response.body.data.paymentMethod.code).toBe("cash");
    expect(response.body.data.paymentMethod.isDefault).toBe(true);
  });

  test("requires a transaction reference for card and vodafone_cash payments", async () => {
    // Missing reference for card
    const cardResponse = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send(paymentPayload({ paymentMethod: cardMethod._id.toString(), referenceNumber: "" }));

    expect(cardResponse.status).toBe(400);
    expect(cardResponse.body.code).toBe("TRANSACTION_REFERENCE_REQUIRED");

    // Missing reference for vodafone cash
    const vodafoneResponse = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send(paymentPayload({ paymentMethod: vodafoneMethod._id.toString(), referenceNumber: "" }));

    expect(vodafoneResponse.status).toBe(400);
    expect(vodafoneResponse.body.code).toBe("TRANSACTION_REFERENCE_REQUIRED");

    // Succeeds when reference is provided
    const validCardResponse = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send(paymentPayload({
        paymentMethod: cardMethod._id.toString(),
        referenceNumber: "AUTH-CC-89412",
      }));

    expect(validCardResponse.status).toBe(201);
    expect(validCardResponse.body.data.referenceNumber).toBe("AUTH-CC-89412");
    expect(validCardResponse.body.data.method).toBe("card");
  });

  test("does not require reference for cash payments", async () => {
    const response = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send(paymentPayload({ paymentMethod: cashMethod._id.toString(), referenceNumber: null }));

    expect(response.status).toBe(201);
    expect(response.body.data.method).toBe("cash");
  });

  test("rejects inactive payment methods", async () => {
    await PaymentMethod.updateOne({ _id: vodafoneMethod._id }, { $set: { isActive: false } });

    const response = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send(paymentPayload({
        paymentMethod: vodafoneMethod._id.toString(),
        referenceNumber: "VF-998811",
      }));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("PAYMENT_METHOD_INACTIVE");
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

  test("supports split payment across multiple methods and completes status transition", async () => {
    // 1st payment: 200 Cash
    const p1 = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send(paymentPayload({ amount: 200, paymentMethod: "cash" }));
    expect(p1.status).toBe(201);

    let inv = await Invoice.findById(invoice._id);
    expect(inv.paidAmount).toBe(200);
    expect(inv.remainingAmount).toBe(300);
    expect(inv.status).toBe("partially_paid");

    // 2nd payment: 200 Card
    const p2 = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send(paymentPayload({
        amount: 200,
        paymentMethod: "card",
        referenceNumber: "POS-REF-12345",
      }));
    expect(p2.status).toBe(201);

    inv = await Invoice.findById(invoice._id);
    expect(inv.paidAmount).toBe(400);
    expect(inv.remainingAmount).toBe(100);
    expect(inv.status).toBe("partially_paid");

    // 3rd payment: 100 Vodafone Cash (pays full balance)
    const p3 = await request(app)
      .post(`/api/invoices/${invoice._id}/payments`)
      .set("Authorization", receptionist.authHeader)
      .send({
        amount: 100,
        paymentMethod: "vodafone_cash",
        referenceNumber: "VF-CASH-78901",
      });
    expect(p3.status).toBe(201);

    inv = await Invoice.findById(invoice._id);
    expect(inv.paidAmount).toBe(500);
    expect(inv.remainingAmount).toBe(0);
    expect(inv.status).toBe("paid");

    // 4th payment attempt on fully paid invoice is rejected
    const p4 = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send(paymentPayload({ amount: 50 }));
    expect(p4.status).toBe(400);
    expect(p4.body.code).toBe("INVOICE_ALREADY_PAID");
  });

  test("rejects payments against cancelled or draft invoices", async () => {
    // Cancelled invoice
    await Invoice.updateOne(
      { _id: invoice._id },
      { $set: { status: "cancelled" } }
    );

    const cancelledResponse = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send(paymentPayload());

    expect(cancelledResponse.status).toBe(400);
    expect(cancelledResponse.body.code).toBe("INVOICE_CANCELLED");

    // Draft invoice
    await Invoice.updateOne(
      { _id: invoice._id },
      { $set: { status: "draft" } }
    );

    const draftResponse = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send(paymentPayload());

    expect(draftResponse.status).toBe(400);
    expect(draftResponse.body.code).toBe("INVOICE_NOT_ISSUED");
  });

  test("idempotent retry with Idempotency-Key returns the exact same payment without double billing", async () => {
    const idempotencyKey = "unique-test-key-12345";

    const response1 = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .set("Idempotency-Key", idempotencyKey)
      .send(paymentPayload({ amount: 150 }));

    expect(response1.status).toBe(201);
    const paymentId1 = response1.body.data._id;

    // Retry with the same key
    const response2 = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .set("Idempotency-Key", idempotencyKey)
      .send(paymentPayload({ amount: 150 }));

    expect(response2.status).toBe(201);
    expect(response2.body.data._id).toBe(paymentId1);

    // Verify invoice only recorded 150 once
    const updatedInvoice = await Invoice.findById(invoice._id);
    expect(updatedInvoice.paidAmount).toBe(150);
    expect(updatedInvoice.remainingAmount).toBe(350);
    expect(await Payment.countDocuments()).toBe(1);
  });

  test("creates payment via POST /api/invoices/:id/payments", async () => {
    const response = await request(app)
      .post(`/api/invoices/${invoice._id}/payments`)
      .set("Authorization", receptionist.authHeader)
      .send({
        amount: 250,
        paymentMethod: "cash",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.amount).toBe(250);
    expect(response.body.data.invoice._id.toString()).toBe(invoice._id.toString());
  });

  test("GET /api/payment-methods returns active payment methods ordered by sortOrder", async () => {
    const response = await request(app)
      .get("/api/payment-methods")
      .set("Authorization", receptionist.authHeader);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.length).toBeGreaterThanOrEqual(3);

    const codes = response.body.data.map((m) => m.code);
    expect(codes).toContain("cash");
    expect(codes).toContain("card");
    expect(codes).toContain("vodafone_cash");

    const defaultMethod = response.body.data.find((m) => m.isDefault);
    expect(defaultMethod.code).toBe("cash");
  });

  test("reverses a payment safely and recalculates invoice balance and status", async () => {
    const payRes = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send(paymentPayload({ amount: 200 }));

    expect(payRes.status).toBe(201);
    const paymentId = payRes.body.data._id;

    const reverseRes = await request(app)
      .post(`/api/payments/${paymentId}/reverse`)
      .set("Authorization", receptionist.authHeader)
      .send({ reason: "Patient requested refund" });

    expect(reverseRes.status).toBe(200);
    expect(reverseRes.body.data.isReversal).toBe(true);
    expect(reverseRes.body.data.amount).toBe(-200);

    const inv = await Invoice.findById(invoice._id);
    expect(inv.paidAmount).toBe(0);
    expect(inv.remainingAmount).toBe(500);
  });

  test("GET /api/payments/daily-closing aggregates totals per payment method and staff", async () => {
    // Record payment 1 (Cash, 200)
    await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send(paymentPayload({ amount: 200, paymentMethod: "cash" }));

    // Record payment 2 (Vodafone Cash, 150)
    await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send(paymentPayload({
        amount: 150,
        paymentMethod: "vodafone_cash",
        referenceNumber: "VF-998811",
      }));

    const closingRes = await request(app)
      .get("/api/payments/daily-closing")
      .set("Authorization", receptionist.authHeader);

    expect(closingRes.status).toBe(200);
    expect(closingRes.body.data.totalCollected).toBe(350);
    expect(closingRes.body.data.totalTransactions).toBe(2);
    expect(closingRes.body.data.totalsByMethod.length).toBeGreaterThanOrEqual(2);
  });
});
