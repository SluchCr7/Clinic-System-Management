const request = require("supertest");
const app = require("../index");
const LabOrder = require("../modules/LabOrder/labOrder.model");
const Appointment = require("../modules/Appointment/appointment.model");
const Visit = require("../modules/Visit/visit.model");
const AuditLog = require("../modules/AuditLog/auditLog.model");
const DoctorAssignment = require("../modules/DoctorAssignment/doctorAssignment.model");
const {
  createTestUser,
  createTestDoctor,
  createTestPatient,
  getFutureAppointmentDate,
} = require("./testHelper");

describe("Lab and Radiology Orders API", () => {
  let admin;
  let doctorUser;
  let doctor;
  let clinic;
  let receptionist;
  let patient;
  let visit;

  let otherDoctorUser;
  let otherDoctor;
  let otherPatient;
  let otherVisit;

  beforeEach(async () => {
    admin = await createTestUser({ role: "admin" });

    // Clinic 1 Doctor
    const docData = await createTestDoctor(admin.user);
    doctor = docData.doctor;
    clinic = { _id: doctor.clinic };
    doctorUser = docData.doctorUser;

    // Clinic 1 Receptionist (Staff)
    receptionist = await createTestUser({ role: "receptionist", clinic: clinic._id });
    await DoctorAssignment.create({
      doctor: doctor._id,
      receptionist: receptionist.user._id,
      clinic: clinic._id,
      assignedBy: admin.user._id,
      isActive: true,
      createdBy: admin.user._id,
    });

    patient = await createTestPatient(admin.user, doctor._id);

    const appointment = await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      appointmentDate: getFutureAppointmentDate(),
      duration: 30,
      status: "confirmed",
      createdBy: doctorUser.user._id,
    });

    visit = await Visit.create({
      appointment: appointment._id,
      patient: patient._id,
      doctor: doctor._id,
      chiefComplaint: "Routine blood work & X-Ray",
      status: "in_progress",
      createdBy: doctorUser.user._id,
    });

    // Clinic 2 Doctor (Isolated)
    const otherDocData = await createTestDoctor(admin.user);
    otherDoctor = otherDocData.doctor;
    otherDoctorUser = otherDocData.doctorUser;
    otherPatient = await createTestPatient(admin.user, otherDoctor._id);

    const otherAppt = await Appointment.create({
      patient: otherPatient._id,
      doctor: otherDoctor._id,
      appointmentDate: getFutureAppointmentDate(),
      duration: 30,
      status: "confirmed",
      createdBy: otherDoctorUser.user._id,
    });

    otherVisit = await Visit.create({
      appointment: otherAppt._id,
      patient: otherPatient._id,
      doctor: otherDoctor._id,
      chiefComplaint: "Checkup in Clinic 2",
      status: "in_progress",
      createdBy: otherDoctorUser.user._id,
    });
  });

  test("Doctor can create lab and radiology order with multiple items", async () => {
    const res = await request(app)
      .post("/api/lab-orders")
      .set("Authorization", doctorUser.authHeader)
      .send({
        visitId: visit._id.toString(),
        patientId: patient._id.toString(),
        priority: "urgent",
        items: [
          { name: "CBC", type: "lab" },
          { name: "Chest X-Ray", type: "radiology" },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.priority).toBe("urgent");
  });

  test("Doctor can update item status via PATCH /api/lab-order-items/:id and audit log is created", async () => {
    const labOrder = await LabOrder.create({
      clinicId: clinic._id,
      visitId: visit._id,
      patientId: patient._id,
      doctor: doctor._id,
      orderedBy: doctorUser.user._id,
      priority: "routine",
      items: [
        { name: "Lipid Profile", type: "lab", status: "ordered" },
      ],
    });

    const itemId = labOrder.items[0]._id;

    // Doctor marks as received
    const updateRes = await request(app)
      .patch(`/api/lab-order-items/${itemId}`)
      .set("Authorization", doctorUser.authHeader)
      .send({
        status: "received",
        labName: "Al-Borg Lab",
        resultNotes: "Normal cholesterol levels",
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.item.status).toBe("received");
    expect(updateRes.body.data.item.labName).toBe("Al-Borg Lab");

    // Check AuditLog
    const audit = await AuditLog.findOne({
      action: "LAB_ORDER_ITEM_STATUS_CHANGED",
      resourceId: itemId,
    });
    expect(audit).not.toBeNull();
    expect(audit.details.fromStatus).toBe("ordered");
    expect(audit.details.toStatus).toBe("received");

    // Doctor can revert from received back to ordered
    const revertRes = await request(app)
      .patch(`/api/lab-order-items/${itemId}`)
      .set("Authorization", doctorUser.authHeader)
      .send({
        status: "ordered",
        cancelReason: "Correction - results need verification",
      });

    expect(revertRes.status).toBe(200);
    expect(revertRes.body.data.item.status).toBe("ordered");
  });

  test("Staff gets 403 on update attempt, Admin gets 403 (no medical order access)", async () => {
    const labOrder = await LabOrder.create({
      clinicId: clinic._id,
      visitId: visit._id,
      patientId: patient._id,
      doctor: doctor._id,
      orderedBy: doctorUser.user._id,
      items: [{ name: "Thyroid Panel", type: "lab", status: "ordered" }],
    });

    const itemId = labOrder.items[0]._id;

    // Staff attempt -> 403
    const staffRes = await request(app)
      .patch(`/api/lab-order-items/${itemId}`)
      .set("Authorization", receptionist.authHeader)
      .send({ status: "received" });

    expect(staffRes.status).toBe(403);

    // Admin attempt -> 403
    const adminRes = await request(app)
      .patch(`/api/lab-order-items/${itemId}`)
      .set("Authorization", admin.authHeader)
      .send({ status: "received" });

    expect(adminRes.status).toBe(403);

    // Admin get list -> 403
    const adminListRes = await request(app)
      .get("/api/lab-orders")
      .set("Authorization", admin.authHeader);

    expect(adminListRes.status).toBe(403);
  });

  test("Clinic isolation: updating or accessing an item belonging to another clinic returns 404", async () => {
    const orderClinic1 = await LabOrder.create({
      clinicId: clinic._id,
      visitId: visit._id,
      patientId: patient._id,
      doctor: doctor._id,
      orderedBy: doctorUser.user._id,
      items: [{ name: "Urine Analysis", type: "lab", status: "ordered" }],
    });

    const clinic1ItemId = orderClinic1.items[0]._id;

    // Doctor from Clinic 2 tries to update Clinic 1's item
    const res = await request(app)
      .patch(`/api/lab-order-items/${clinic1ItemId}`)
      .set("Authorization", otherDoctorUser.authHeader)
      .send({ status: "received" });

    expect(res.status).toBe(404);
  });

  test("Grouped list returns all items in a single card with correct ordering (pending first, labs then radiology)", async () => {
    // Patient with 5 items in a single visit:
    // 3 labs, 2 radiology, mixed statuses
    await LabOrder.create({
      clinicId: clinic._id,
      visitId: visit._id,
      patientId: patient._id,
      doctor: doctor._id,
      orderedBy: doctorUser.user._id,
      priority: "urgent",
      items: [
        { name: "Zinc", type: "lab", status: "received" },
        { name: "Brain MRI", type: "radiology", status: "ordered" },
        { name: "CBC", type: "lab", status: "ordered" },
        { name: "Chest X-Ray", type: "radiology", status: "cancelled" },
        { name: "Blood Sugar", type: "lab", status: "ordered" },
      ],
    });

    const res = await request(app)
      .get("/api/lab-orders/grouped?filter=all")
      .set("Authorization", doctorUser.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);

    const card = res.body.data[0];
    expect(card.items).toHaveLength(5);
    expect(card.counts.total).toBe(5);
    expect(card.counts.pending).toBe(3);
    expect(card.counts.received).toBe(1);
    expect(card.counts.cancelled).toBe(1);

    // Check item ordering:
    // Status 1 (ordered): Blood Sugar (lab), CBC (lab), Brain MRI (radiology)
    // Status 2 (received): Zinc (lab)
    // Status 3 (cancelled): Chest X-Ray (radiology)
    const itemNames = card.items.map((i) => i.name);
    expect(itemNames[0]).toBe("Blood Sugar");
    expect(itemNames[1]).toBe("CBC");
    expect(itemNames[2]).toBe("Brain MRI");
    expect(itemNames[3]).toBe("Zinc");
    expect(itemNames[4]).toBe("Chest X-Ray");
  });

  test("Pending orders by patient returns pending items for follow-up visits", async () => {
    await LabOrder.create({
      clinicId: clinic._id,
      visitId: visit._id,
      patientId: patient._id,
      doctor: doctor._id,
      orderedBy: doctorUser.user._id,
      priority: "routine",
      items: [
        { name: "HbA1c", type: "lab", status: "ordered" },
        { name: "Pelvic Ultrasound", type: "radiology", status: "ordered" },
        { name: "Vitamin D", type: "lab", status: "received" },
      ],
    });

    const res = await request(app)
      .get(`/api/lab-orders/pending/${patient._id}`)
      .set("Authorization", doctorUser.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2); // only the 2 ordered ones
    const pendingNames = res.body.data.map((i) => i.name);
    expect(pendingNames).toContain("HbA1c");
    expect(pendingNames).toContain("Pelvic Ultrasound");
    expect(pendingNames).not.toContain("Vitamin D");
  });
});
