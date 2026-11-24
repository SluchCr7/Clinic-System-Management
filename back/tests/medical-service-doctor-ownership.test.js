const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");
const MedicalService = require("../modules/medicalService/medicalService.model");
const Invoice = require("../modules/Invoice/invoice.model");
const Visit = require("../modules/Visit/visit.model");
const Appointment = require("../modules/Appointment/appointment.model");
const Doctor = require("../modules/Doctor/doctor.model");
const {
  createTestUser,
  createTestDoctor,
  createTestPatient,
  assignTestDoctor,
  getFutureAppointmentDate,
} = require("./testHelper");

describe("Medical Services Doctor Ownership & Billing Integration", () => {
  let admin;
  let doctorA, doctorUserA;
  let doctorB, doctorUserB;
  let receptionistA;
  let patientA;

  beforeEach(async () => {
    admin = await createTestUser({ role: "admin" });

    // Doctor A and receptionist A
    ({ doctor: doctorA, doctorUser: doctorUserA } = await createTestDoctor(admin.user));
    receptionistA = await createTestUser({ role: "receptionist" });
    await assignTestDoctor(receptionistA.user, doctorA, admin.user);

    // Doctor B
    ({ doctor: doctorB, doctorUser: doctorUserB } = await createTestDoctor(admin.user));

    // Patient for Doctor A
    patientA = await createTestPatient(receptionistA.user, { doctor: doctorA._id });
  });

  test("Doctor A cannot read, update, or deactivate Doctor B's service", async () => {
    // Doctor B creates a service
    const serviceB = await MedicalService.create({
      doctor: doctorUserB.user._id,
      name: "Ultrasound Doctor B",
      code: "ECHO-01",
      category: "Diagnostics",
      price: 300,
      duration: 30,
      createdBy: doctorUserB.user._id,
    });

    // Doctor A tries to read Doctor B's service -> 404
    const readRes = await request(app)
      .get(`/api/medical-services/${serviceB._id}`)
      .set("Authorization", doctorUserA.authHeader);
    expect(readRes.status).toBe(404);

    // Doctor A tries to update Doctor B's service -> 404
    const updateRes = await request(app)
      .patch(`/api/medical-services/${serviceB._id}`)
      .set("Authorization", doctorUserA.authHeader)
      .send({ price: 500 });
    expect(updateRes.status).toBe(404);

    // Doctor A tries to deactivate Doctor B's service -> 404
    const deactivateRes = await request(app)
      .delete(`/api/medical-services/${serviceB._id}`)
      .set("Authorization", doctorUserA.authHeader);
    expect(deactivateRes.status).toBe(404);

    // Verify service in DB remains unchanged
    const unchanged = await MedicalService.findById(serviceB._id);
    expect(unchanged.price).toBe(300);
    expect(unchanged.isActive).toBe(true);
  });

  test("Two doctors can use the same code; the same doctor cannot", async () => {
    // Doctor A creates service with code "CARDIO-01"
    const createA = await request(app)
      .post("/api/medical-services")
      .set("Authorization", doctorUserA.authHeader)
      .send({
        name: "ECG Doctor A",
        code: "CARDIO-01",
        category: "Cardiology",
        price: 150,
        duration: 15,
      });
    expect(createA.status).toBe(201);

    // Doctor B creates service with the same code "CARDIO-01" -> 201 Success!
    const createB = await request(app)
      .post("/api/medical-services")
      .set("Authorization", doctorUserB.authHeader)
      .send({
        name: "ECG Doctor B",
        code: "CARDIO-01",
        category: "Cardiology",
        price: 200,
        duration: 20,
      });
    expect(createB.status).toBe(201);

    // Doctor A tries to create ANOTHER service with the same code "CARDIO-01" -> 409
    const duplicateA = await request(app)
      .post("/api/medical-services")
      .set("Authorization", doctorUserA.authHeader)
      .send({
        name: "Another ECG Doctor A",
        code: "CARDIO-01",
        category: "Cardiology",
        price: 180,
      });
    expect(duplicateA.status).toBe(409);
    expect(duplicateA.body.message).toContain("كود الخدمة مستخدم بالفعل");
  });

  test("Receptionist cannot create/update/delete; sees only their doctor's active services", async () => {
    // Doctor A has 1 active service and 1 inactive service
    const activeService = await MedicalService.create({
      doctor: doctorUserA.user._id,
      name: "Active Service A",
      code: "ACT-01",
      category: "General",
      price: 100,
      isActive: true,
      createdBy: doctorUserA.user._id,
    });
    await MedicalService.create({
      doctor: doctorUserA.user._id,
      name: "Inactive Service A",
      code: "INACT-01",
      category: "General",
      price: 80,
      isActive: false,
      createdBy: doctorUserA.user._id,
    });

    // Doctor B has an active service
    await MedicalService.create({
      doctor: doctorUserB.user._id,
      name: "Doctor B Service",
      code: "DOCB-01",
      category: "General",
      price: 200,
      isActive: true,
      createdBy: doctorUserB.user._id,
    });

    // Receptionist A cannot create a service -> 403
    const createRes = await request(app)
      .post("/api/medical-services")
      .set("Authorization", receptionistA.authHeader)
      .send({
        name: "Receptionist Service",
        code: "REC-01",
        category: "General",
        price: 50,
      });
    expect(createRes.status).toBe(403);

    // Receptionist A cannot update a service -> 403
    const updateRes = await request(app)
      .patch(`/api/medical-services/${activeService._id}`)
      .set("Authorization", receptionistA.authHeader)
      .send({ price: 120 });
    expect(updateRes.status).toBe(403);

    // Receptionist A cannot deactivate a service -> 403
    const deleteRes = await request(app)
      .delete(`/api/medical-services/${activeService._id}`)
      .set("Authorization", receptionistA.authHeader);
    expect(deleteRes.status).toBe(403);

    // Receptionist A gets service list -> sees ONLY Doctor A's ACTIVE services
    const listRes = await request(app)
      .get("/api/medical-services")
      .set("Authorization", receptionistA.authHeader);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].code).toBe("ACT-01");
  });

  test("Invoice total = consultation fee + services; changing service price later does not alter old invoice", async () => {
    // Doctor A's consultation fee is 200
    await Doctor.findByIdAndUpdate(doctorA._id, { consultationFee: 200 });

    const serviceA = await MedicalService.create({
      doctor: doctorUserA.user._id,
      name: "X-Ray Chest",
      code: "XRAY-01",
      category: "Radiology",
      price: 150,
      createdBy: doctorUserA.user._id,
    });

    // Create completed appointment and visit
    const appointment = await Appointment.create({
      patient: patientA._id,
      doctor: doctorA._id,
      appointmentDate: getFutureAppointmentDate(1),
      status: "completed",
      duration: 30,
      createdBy: admin.user._id,
    });

    const visit = await Visit.create({
      appointment: appointment._id,
      patient: patientA._id,
      doctor: doctorA._id,
      status: "completed",
      chiefComplaint: "Chest pain",
      createdBy: doctorUserA.user._id,
    });

    // Receptionist creates invoice with serviceA (qty = 2)
    const createInvoiceRes = await request(app)
      .post("/api/invoices")
      .set("Authorization", receptionistA.authHeader)
      .send({
        visit: visit._id.toString(),
        services: [{ serviceId: serviceA._id.toString(), quantity: 2 }],
        discount: 20,
      });

    expect(createInvoiceRes.status).toBe(201);
    const invoice = createInvoiceRes.body.data;

    // Consultation (200) + Service (150 * 2 = 300) = Subtotal 500 - Discount 20 = Total 480
    expect(invoice.subtotal).toBe(500);
    expect(invoice.total).toBe(480);
    expect(invoice.remainingAmount).toBe(480);
    expect(invoice.items.length).toBe(2);

    // Verify snapshot fields on line item
    const serviceItem = invoice.items.find((it) => it.type === "performed_service");
    expect(serviceItem.unitPrice).toBe(150);
    expect(serviceItem.quantity).toBe(2);
    expect(serviceItem.total).toBe(300);
    expect(serviceItem.serviceCode).toBe("XRAY-01");
    expect(serviceItem.category).toBe("Radiology");

    // NOW: Doctor A changes service price from 150 to 999
    const updateServiceRes = await request(app)
      .patch(`/api/medical-services/${serviceA._id}`)
      .set("Authorization", doctorUserA.authHeader)
      .send({ price: 999 });
    expect(updateServiceRes.status).toBe(200);

    // Verify existing invoice total and item prices REMAIN UNCHANGED
    const fetchedInvoice = await Invoice.findById(invoice._id);
    expect(fetchedInvoice.subtotal).toBe(500);
    expect(fetchedInvoice.total).toBe(480);
    const fetchedServiceItem = fetchedInvoice.items.find((it) => it.type === "performed_service");
    expect(fetchedServiceItem.unitPrice).toBe(150);
    expect(fetchedServiceItem.total).toBe(300);
  });

  test("Deactivated service cannot be added to a new invoice but still appears on old ones", async () => {
    await Doctor.findByIdAndUpdate(doctorA._id, { consultationFee: 150 });

    const service = await MedicalService.create({
      doctor: doctorUserA.user._id,
      name: "Nebulizer Treatment",
      code: "NEB-01",
      category: "Procedures",
      price: 80,
      createdBy: doctorUserA.user._id,
    });

    // Create 1st visit and invoice with the active service
    const appt1 = await Appointment.create({
      patient: patientA._id,
      doctor: doctorA._id,
      appointmentDate: getFutureAppointmentDate(2),
      status: "completed",
      duration: 30,
      createdBy: admin.user._id,
    });
    const visit1 = await Visit.create({
      appointment: appt1._id,
      patient: patientA._id,
      doctor: doctorA._id,
      status: "completed",
      chiefComplaint: "Asthma attack",
      createdBy: doctorUserA.user._id,
    });

    const inv1Res = await request(app)
      .post("/api/invoices")
      .set("Authorization", receptionistA.authHeader)
      .send({
        visit: visit1._id.toString(),
        services: [{ serviceId: service._id.toString(), quantity: 1 }],
      });
    expect(inv1Res.status).toBe(201);

    // Doctor deactivates the service
    const deactRes = await request(app)
      .delete(`/api/medical-services/${service._id}`)
      .set("Authorization", doctorUserA.authHeader);
    expect(deactRes.status).toBe(200);

    // Old invoice still shows the service
    const oldInv = await Invoice.findById(inv1Res.body.data._id);
    expect(oldInv.items.some((it) => it.serviceCode === "NEB-01")).toBe(true);

    // Create 2nd visit and attempt to invoice with the deactivated service -> 400 rejected
    const appt2 = await Appointment.create({
      patient: patientA._id,
      doctor: doctorA._id,
      appointmentDate: getFutureAppointmentDate(3),
      status: "completed",
      duration: 30,
      createdBy: admin.user._id,
    });
    const visit2 = await Visit.create({
      appointment: appt2._id,
      patient: patientA._id,
      doctor: doctorA._id,
      status: "completed",
      chiefComplaint: "Follow-up asthma",
      createdBy: doctorUserA.user._id,
    });

    const inv2Res = await request(app)
      .post("/api/invoices")
      .set("Authorization", receptionistA.authHeader)
      .send({
        visit: visit2._id.toString(),
        services: [{ serviceId: service._id.toString(), quantity: 1 }],
      });
    expect(inv2Res.status).toBe(400);
    expect(inv2Res.body.code).toBe("MEDICAL_SERVICE_INACTIVE");
  });

  test("Client-supplied totals and doctor IDs are ignored/overridden", async () => {
    // Doctor A creates service with price 100
    const serviceA = await MedicalService.create({
      doctor: doctorUserA.user._id,
      name: "Wound Stitching",
      code: "STITCH-01",
      category: "Procedures",
      price: 100,
      createdBy: doctorUserA.user._id,
    });

    // Doctor A tries to pass doctor: doctorUserB.user._id in create body -> ignored, assigned to Doctor A
    const spoofCreate = await request(app)
      .post("/api/medical-services")
      .set("Authorization", doctorUserA.authHeader)
      .send({
        name: "Doctor A Spoof Test",
        code: "SPOOF-01",
        category: "Procedures",
        price: 50,
        doctor: doctorUserB.user._id.toString(),
      });
    expect(spoofCreate.status).toBe(201);
    expect(spoofCreate.body.data.doctor).toBe(doctorUserA.user._id.toString());

    // Invoice calculation ignores any client-supplied total/subtotal
    await Doctor.findByIdAndUpdate(doctorA._id, { consultationFee: 100 });
    const appt = await Appointment.create({
      patient: patientA._id,
      doctor: doctorA._id,
      appointmentDate: getFutureAppointmentDate(4),
      status: "completed",
      duration: 30,
      createdBy: admin.user._id,
    });
    const visit = await Visit.create({
      appointment: appt._id,
      patient: patientA._id,
      doctor: doctorA._id,
      status: "completed",
      chiefComplaint: "Stitch review",
      createdBy: doctorUserA.user._id,
    });

    const invoiceRes = await request(app)
      .post("/api/invoices")
      .set("Authorization", receptionistA.authHeader)
      .send({
        visit: visit._id.toString(),
        services: [{ serviceId: serviceA._id.toString(), quantity: 1, price: 1, total: 1 }],
        subtotal: 1,
        total: 1,
      });

    expect(invoiceRes.status).toBe(201);
    // Real calculation: 100 consultation + 100 service = 200 total!
    expect(invoiceRes.body.data.subtotal).toBe(200);
    expect(invoiceRes.body.data.total).toBe(200);
  });

  test("Doctor can re-activate a deactivated service with PATCH /:id/activate", async () => {
    const service = await MedicalService.create({
      doctor: doctorUserA.user._id,
      name: "Ear Wash",
      code: "EAR-01",
      category: "Procedures",
      price: 70,
      isActive: false,
      createdBy: doctorUserA.user._id,
    });

    const activateRes = await request(app)
      .patch(`/api/medical-services/${service._id}/activate`)
      .set("Authorization", doctorUserA.authHeader);
    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.isActive).toBe(true);

    const reloaded = await MedicalService.findById(service._id);
    expect(reloaded.isActive).toBe(true);
  });

  test("GET /categories returns distinct categories scoped to the doctor", async () => {
    await MedicalService.create([
      {
        doctor: doctorUserA.user._id,
        name: "Svc 1",
        code: "S1",
        category: "Cardiology",
        price: 100,
        createdBy: doctorUserA.user._id,
      },
      {
        doctor: doctorUserA.user._id,
        name: "Svc 2",
        code: "S2",
        category: "Cardiology",
        price: 150,
        createdBy: doctorUserA.user._id,
      },
      {
        doctor: doctorUserA.user._id,
        name: "Svc 3",
        code: "S3",
        category: "Radiology",
        price: 200,
        createdBy: doctorUserA.user._id,
      },
      {
        doctor: doctorUserB.user._id,
        name: "Svc 4",
        code: "S4",
        category: "Dermatology",
        price: 120,
        createdBy: doctorUserB.user._id,
      },
    ]);

    const resA = await request(app)
      .get("/api/medical-services/categories")
      .set("Authorization", doctorUserA.authHeader);
    expect(resA.status).toBe(200);
    expect(resA.body.data).toEqual(["Cardiology", "Radiology"]);

    const resB = await request(app)
      .get("/api/medical-services/categories")
      .set("Authorization", doctorUserB.authHeader);
    expect(resB.status).toBe(200);
    expect(resB.body.data).toEqual(["Dermatology"]);
  });
});
