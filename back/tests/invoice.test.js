const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");
const Invoice = require("../modules/Invoice/invoice.model");
const Payment = require("../modules/Payment/payment.model");
const AuditLog = require("../modules/AuditLog/auditLog.model");
const PerformedService = require("../modules/performedService/performedService.model");
const Visit = require("../modules/Visit/visit.model");
const Appointment = require("../modules/Appointment/appointment.model");
const {
  createTestUser,
  createTestDoctor,
  createTestPatient,
  getFutureAppointmentDate,
} = require("./testHelper");

describe("Invoices API", () => {
  let admin;
  let receptionist;
  let doctorUser;
  let patient;
  let doctor;
  let visit;

  beforeEach(async () => {
    admin = await createTestUser({ role: "admin" });
    receptionist = await createTestUser({ role: "receptionist" });
    patient = await createTestPatient(receptionist.user);
    ({ doctor, doctorUser } = await createTestDoctor(receptionist.user));

    const appointment = await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      appointmentDate: getFutureAppointmentDate(),
      duration: 30,
      status: "confirmed",
      createdBy: receptionist.user._id,
    });
    visit = await Visit.create({
      appointment: appointment._id,
      patient: patient._id,
      doctor: doctor._id,
      chiefComplaint: "Routine examination",
      createdBy: receptionist.user._id,
    });
    await PerformedService.create([
      {
        visit: visit._id,
        patient: patient._id,
        doctor: doctor._id,
        service: new mongoose.Types.ObjectId(),
        serviceName: "Consultation",
        serviceCode: "CONSULT",
        price: 80,
        quantity: 2,
        discount: 10,
        createdBy: receptionist.user._id,
      },
      {
        visit: visit._id,
        patient: patient._id,
        doctor: doctor._id,
        service: new mongoose.Types.ObjectId(),
        serviceName: "Lab test",
        serviceCode: "LAB-1",
        price: 25,
        quantity: 1,
        discount: 0,
        createdBy: receptionist.user._id,
      },
    ]);
  });

  const createInvoice = (payload = {}) =>
    request(app)
      .post("/api/invoices")
      .set("Authorization", receptionist.authHeader)
      .send({ visit: visit._id.toString(), ...payload });

  const makeInvoiceRecord = async (overrides = {}) =>
    Invoice.create({
      invoiceNumber: `INV-TEST-${Date.now()}-${Math.random()
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
      paidAmount: 0,
      remainingAmount: 100,
      status: "unpaid",
      createdBy: receptionist.user._id,
      ...overrides,
    });

  test("generates an invoice from performed services and records an audit log", async () => {
    const response = await createInvoice({ discount: 5, tax: 7 });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.subtotal).toBe(175);
    expect(response.body.data.discount).toBe(5);
    expect(response.body.data.tax).toBe(7);
    expect(response.body.data.total).toBe(177);
    expect(response.body.data.remainingAmount).toBe(177);
    expect(response.body.data.status).toBe("unpaid");

    const [savedInvoice, auditLog] = await Promise.all([
      Invoice.findById(response.body.data._id),
      AuditLog.findOne({
        action: "INVOICE_CREATED",
        resourceId: response.body.data._id,
      }),
    ]);
    expect(savedInvoice).not.toBeNull();
    expect(savedInvoice.createdBy.toString()).toBe(
      receptionist.user._id.toString()
    );
    expect(auditLog).not.toBeNull();
  });

  test("updates the paid balance and status as payments are recorded", async () => {
    const invoice = await makeInvoiceRecord();

    const partialPaymentResponse = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send({
        invoice: invoice._id.toString(),
        amount: 40,
        method: "cash",
      });

    expect(partialPaymentResponse.status).toBe(201);
    expect(partialPaymentResponse.body.data.amount).toBe(40);

    let updatedInvoice = await Invoice.findById(invoice._id);
    expect(updatedInvoice.paidAmount).toBe(40);
    expect(updatedInvoice.remainingAmount).toBe(60);
    expect(updatedInvoice.status).toBe("partially_paid");

    const finalPaymentResponse = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send({
        invoice: invoice._id.toString(),
        amount: 60,
        method: "cash",
      });

    expect(finalPaymentResponse.status).toBe(201);
    updatedInvoice = await Invoice.findById(invoice._id);
    expect(updatedInvoice.paidAmount).toBe(100);
    expect(updatedInvoice.remainingAmount).toBe(0);
    expect(updatedInvoice.status).toBe("paid");
    expect(await Payment.countDocuments({ invoice: invoice._id })).toBe(2);
  });

  test("rejects invoice creation when the visit has no performed services", async () => {
    await PerformedService.deleteMany({ visit: visit._id });

    const response = await createInvoice();

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("NO_PERFORMED_SERVICES");
    expect(await Invoice.countDocuments()).toBe(0);
  });

  test("rejects invalid invoice payloads", async () => {
    const response = await createInvoice({ visit: "invalid-id" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(await Invoice.countDocuments()).toBe(0);
  });

  test("cancels unpaid invoices but refuses to cancel invoices with payments", async () => {
    const unpaidInvoice = await makeInvoiceRecord();

    const cancelled = await request(app)
      .post(`/api/invoices/${unpaidInvoice._id}/cancel`)
      .set("Authorization", receptionist.authHeader);

    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("cancelled");
    expect((await Invoice.findById(unpaidInvoice._id)).status).toBe("cancelled");
    expect(
      await AuditLog.findOne({
        action: "INVOICE_CANCELLED",
        resourceId: unpaidInvoice._id,
      })
    ).not.toBeNull();

    const paidInvoice = await makeInvoiceRecord();
    const payment = await request(app)
      .post("/api/payments")
      .set("Authorization", receptionist.authHeader)
      .send({
        invoice: paidInvoice._id.toString(),
        amount: 25,
        method: "cash",
      });
    expect(payment.status).toBe(201);

    const rejectedCancellation = await request(app)
      .post(`/api/invoices/${paidInvoice._id}/cancel`)
      .set("Authorization", receptionist.authHeader);

    expect(rejectedCancellation.status).toBe(400);
    expect(rejectedCancellation.body.code).toBe("INVOICE_HAS_PAYMENTS");
    expect((await Invoice.findById(paidInvoice._id)).status).toBe(
      "partially_paid"
    );
  });

  test("restricts invoice creation and cancellation to authorized roles", async () => {
    const forbiddenCreation = await request(app)
      .post("/api/invoices")
      .set("Authorization", doctorUser.authHeader)
      .send({ visit: visit._id.toString() });

    expect(forbiddenCreation.status).toBe(403);

    const invoice = await makeInvoiceRecord();
    const forbiddenCancellation = await request(app)
      .post(`/api/invoices/${invoice._id}/cancel`)
      .set("Authorization", doctorUser.authHeader);

    expect(forbiddenCancellation.status).toBe(403);
  });

  test("limits doctors to invoices for their own patients", async () => {
    const ownInvoice = await makeInvoiceRecord();
    const otherDoctor = await createTestDoctor(receptionist.user);
    const otherInvoice = await makeInvoiceRecord({
      doctor: otherDoctor.doctor._id,
    });

    const ownResponse = await request(app)
      .get(`/api/invoices/${ownInvoice._id}`)
      .set("Authorization", doctorUser.authHeader);
    const otherResponse = await request(app)
      .get(`/api/invoices/${otherInvoice._id}`)
      .set("Authorization", doctorUser.authHeader);

    expect(ownResponse.status).toBe(200);
    expect(otherResponse.status).toBe(404);
  });

  test("requires authentication and returns 404 for an unknown invoice", async () => {
    await request(app).get("/api/invoices").expect(401);

    const response = await request(app)
      .get("/api/invoices/507f1f77bcf86cd799439011")
      .set("Authorization", admin.authHeader);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("INVOICE_NOT_FOUND");
  });
});
