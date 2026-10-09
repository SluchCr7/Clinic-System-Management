const router = require("express").Router()
const medicalAttachmentController = require("./medicalAttachment.controller")

const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");
const validate = require("../../middlewares/validation");

const {
    createMedicalAttachmentSchema,
    medicalAttachmentListQuerySchema,
} = require("./medicalAttachment.validation")
const medicalAttachmentUpload = require("../../middlewares/medicalAttachmentsUpload")
const { validateQuery, validateId } = validate;
router.post(
    "/",
    protect,
    authorize("admin", "doctor", "receptionist"),
    medicalAttachmentUpload.single("file"),
    validate(createMedicalAttachmentSchema),
    medicalAttachmentController.createMedicalAttachment
),

router.get(
    "/",
    protect,
    authorize("admin", "doctor", "receptionist"),
    validateQuery(medicalAttachmentListQuerySchema),
    medicalAttachmentController.getPatientAttachments
    )

router.get(
    "/:id",
    protect,
    authorize("admin", "doctor", "receptionist"),
    validateId("id"),
    medicalAttachmentController.getMedicalAttachmentById
)
    
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  validateId("id"),
  medicalAttachmentController.deleteMedicalAttachment
);

module.exports = router