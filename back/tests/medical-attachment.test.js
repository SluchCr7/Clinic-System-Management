jest.mock("../utils/cloudinary", () => ({
  uploadToCloudinary: jest.fn(),
  deleteFromCloudinary: jest.fn(),
}));

jest.mock("../modules/AuditLog/auditLog.service", () => ({
  logActivity: jest.fn(),
}));

const cloudinary = require("../utils/cloudinary");
const auditLogService = require("../modules/AuditLog/auditLog.service");
const MedicalAttachment = require("../modules/medicalAttachment/medicalAttachment.model");
const medicalAttachmentService = require("../modules/medicalAttachment/medicalAttachment.service");
const { createTestUser, createTestPatient } = require("./testHelper");

describe("Medical attachment persistence", () => {
  let user;
  let patient;

  beforeEach(async () => {
    jest.clearAllMocks();
    ({ user } = await createTestUser({ role: "admin" }));
    patient = await createTestPatient(user);
    cloudinary.uploadToCloudinary.mockResolvedValue({
      url: "https://example.com/report.pdf",
      publicId: "test-report",
    });
    cloudinary.deleteFromCloudinary.mockResolvedValue();
  });

  test("rolls back the attachment record and uploaded file when auditing fails", async () => {
    const auditError = new Error("Audit log write failed");
    auditLogService.logActivity.mockRejectedValue(auditError);

    await expect(
      medicalAttachmentService.createMedicalAttachment(
        {
          patient: patient._id.toString(),
          type: "medical_report",
          title: "Consultation report",
        },
        {
          buffer: Buffer.from("%PDF-1.4 test file"),
          originalname: "report.pdf",
          mimetype: "application/pdf",
          size: 18,
        },
        user
      )
    ).rejects.toBe(auditError);

    expect(await MedicalAttachment.countDocuments()).toBe(0);
    expect(cloudinary.deleteFromCloudinary).toHaveBeenCalledWith("test-report");
  });
});
