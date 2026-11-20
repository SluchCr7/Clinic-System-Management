const Joi = require("joi");
const { createListQuerySchema, objectId } = require("../../utils/listQuery");

const createAssignmentSchema = Joi.object({
  doctor: objectId.required().messages({
    "any.required": "Doctor ID is required",
    "string.length": "Invalid doctor ID",
    "string.hex": "Invalid doctor ID",
  }),
  receptionist: objectId.required().messages({
    "any.required": "Receptionist ID is required",
    "string.length": "Invalid receptionist ID",
    "string.hex": "Invalid receptionist ID",
  }),
  notes: Joi.string().trim().max(500).allow("", null),
});

const updateAssignmentSchema = Joi.object({
  isActive: Joi.boolean(),
  notes: Joi.string().trim().max(500).allow("", null),
}).min(1);

const assignmentListQuerySchema = createListQuerySchema({
  sortFields: ["createdAt", "updatedAt"],
  filters: {
    doctor: objectId,
    receptionist: objectId,
    isActive: Joi.boolean().truthy("true").falsy("false"),
  },
  search: false,
});

module.exports = {
  createAssignmentSchema,
  updateAssignmentSchema,
  assignmentListQuerySchema,
};
