const Doctor = require("./doctor.model");
const Clinic = require("../Clinic/clinic.model");
const Appointment = require("../Appointment/appointment.model");
const User = require("../User/user.model");
const mongoose = require("mongoose");
const { AppError } = require("../../middlewares/errorHandler");
const auditLogService = require("../AuditLog/auditLog.service");
const { paginateQuery } = require("../../utils/pagination");
const { getNextAvailableSlots } = require("../../utils/doctorAvailability");
const { getSearchRegex, getSort } = require("../../utils/listQuery");
const {
  getAuthorizedDoctorIds,
  assertDoctorAccess,
} = require("../../utils/accessControl");

const createDoctor = async (data, currentUser) => {
  const user = await User.findById(data.user);

  if (!user) {
    throw new AppError(
      "User not found",
      404,
      "USER_NOT_FOUND"
    );
  }

  if (user.role !== "doctor") {
    throw new AppError(
      "Selected user must have a doctor role",
      400,
      "INVALID_DOCTOR_ROLE"
    );
  }

  if (!user.isActive) {
    throw new AppError(
      "Doctor user account is inactive",
      400,
      "INACTIVE_DOCTOR_ACCOUNT"
    );
  }

  const existingDoctor = await Doctor.findOne({
    user: data.user,
  });

  if (existingDoctor) {
    throw new AppError(
      "Doctor profile already exists",
      409,
      "DOCTOR_PROFILE_EXISTS"
    );
  }

  const session = await mongoose.startSession();

  try {
    let doctor;

    await session.withTransaction(async () => {
      const doctorId = new mongoose.Types.ObjectId();
      const clinicId = new mongoose.Types.ObjectId();
      const doctorName = `${user.firstName || ""} ${user.lastName || ""}`.trim();

      [doctor] = await Doctor.create(
        [
          {
            _id: doctorId,
            ...data,
            clinic: clinicId,
            createdBy: currentUser._id,
          },
        ],
        { session }
      );

      const [clinic] = await Clinic.create(
        [
          {
            _id: clinicId,
            name: `عيادة د. ${doctorName}`,
            license_number: null,
            slot_duration_minutes: 15,
            currency: "USD",
            tax_note: null,
            working_hours: {
              sunday: { open: null, close: null, closed: false, emergency: true },
              monday: { open: "08:00", close: "18:00", closed: false, emergency: false },
              tuesday: { open: "08:00", close: "18:00", closed: false, emergency: false },
              wednesday: { open: "08:00", close: "18:00", closed: false, emergency: false },
              thursday: { open: "08:00", close: "18:00", closed: false, emergency: false },
              friday: { open: "08:00", close: "18:00", closed: false, emergency: false },
              saturday: { open: "09:00", close: "14:00", closed: false, emergency: false },
            },
            owner_doctor_id: doctorId,
            isActive: true,
          },
        ],
        { session }
      );

      user.clinic = clinic._id;
      await user.save({ session });

      if (currentUser?._id) {
        await auditLogService.logActivity({
          actor: currentUser,
          action: "DOCTOR_CREATED",
          resource: "Doctor",
          resourceId: doctor._id,
          details: {
            user: doctor.user,
            specialization: doctor.specialization,
            licenseNumber: doctor.licenseNumber,
            consultationFee: doctor.consultationFee,
            yearsOfExperience: doctor.yearsOfExperience,
            isActive: doctor.isActive,
            clinic: clinic._id,
          },
          session,
        });
      }
    });

    return await Doctor.findById(doctor._id).populate(
      "clinic",
      "name"
    );
  } finally {
    await session.endSession();
  }
};

const getDoctors = async (query = {}, currentUser = null) => {
  const filter = {
    isActive:
      query.isActive === true || query.isActive === "true"
        ? true
        : query.isActive === false || query.isActive === "false"
          ? false
          : true,
  };

  if (currentUser) {
    if (currentUser.role === "receptionist") {
      const authorizedDoctorIds = await getAuthorizedDoctorIds(currentUser);
      filter._id = { $in: authorizedDoctorIds || [] };
    } else if (currentUser.role === "doctor") {
      const myDoctor = await Doctor.findOne({ user: currentUser._id })
        .select("_id")
        .lean();
      filter._id = myDoctor ? myDoctor._id : { $in: [] };
    }
  }

  if (query.specialization) {
    filter.specialization = query.specialization;
  }

  const searchRegex = getSearchRegex(query.search);
  if (searchRegex) {
    filter.$or = [
      { specialization: searchRegex },
      { licenseNumber: searchRegex },
    ];
  }

  return paginateQuery(
    Doctor.find(filter)
      .populate(
        "user",
        "firstName lastName email phone role"
      )
      .populate("clinic", "name")
      .sort(
        getSort(
          query,
          [
            "specialization",
            "licenseNumber",
            "consultationFee",
            "yearsOfExperience",
            "createdAt",
            "updatedAt",
          ],
          "createdAt"
        )
      ),
    Doctor.countDocuments(filter),
    query.page,
    query.limit
  );
};

const getDoctorById = async (id, currentUser = null) => {
  const doctor = await Doctor.findById(id)
    .populate(
      "user",
      "firstName lastName email phone role"
    )
    .populate("clinic", "name");

  if (!doctor) {
    return null;
  }

  if (currentUser) {
    await assertDoctorAccess(currentUser, doctor._id);
  }

  return doctor;
};

const updateDoctor = async (id, data, currentUser) => {
  const doctor = await Doctor.findById(id);

  if (!doctor) {
    return null;
  }

  const previousValues = {
    user: doctor.user,
    specialization: doctor.specialization,
    licenseNumber: doctor.licenseNumber,
    consultationFee: doctor.consultationFee,
    yearsOfExperience: doctor.yearsOfExperience,
    isActive: doctor.isActive,
  };

  const allowedFields = [
    "specialization",
    "licenseNumber",
    "consultationFee",
    "bio",
    "yearsOfExperience",
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      doctor[field] = data[field];
    }
  }

  doctor.updatedBy = currentUser._id;

  await doctor.save();

  const newValues = {
    user: doctor.user,
    specialization: doctor.specialization,
    licenseNumber: doctor.licenseNumber,
    consultationFee: doctor.consultationFee,
    yearsOfExperience: doctor.yearsOfExperience,
    isActive: doctor.isActive,
  };

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "DOCTOR_UPDATED",
      resource: "Doctor",
      resourceId: doctor._id,
      details: {
        previousValues,
        newValues,
      },
    });
  }

  return doctor;
};

const deactivateDoctor = async (id, currentUser) => {
  const doctor = await Doctor.findById(id);

  if (!doctor) {
    return null;
  }

  const activeAppointmentCount = await Appointment.countDocuments({
    doctor: doctor._id,
    appointmentDate: { $gte: new Date() },
    status: { $nin: ["cancelled", "no-show", "completed"] },
  });

  if (activeAppointmentCount > 0) {
    throw new AppError(
      "Cannot deactivate a doctor with active appointments",
      409,
      "DOCTOR_HAS_ACTIVE_APPOINTMENTS"
    );
  }

  const previousIsActive = doctor.isActive;
  doctor.isActive = false;
  doctor.updatedBy = currentUser._id;

  await doctor.save();

  await Clinic.updateOne(
    { owner_doctor_id: doctor._id },
    { $set: { isActive: false } }
  );

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "DOCTOR_DEACTIVATED",
      resource: "Doctor",
      resourceId: doctor._id,
      details: {
        previousIsActive,
        newIsActive: false,
      },
    });
  }

  return doctor;
};

const getDoctorAvailability = async (id, query = {}, currentUser = null) => {
  const doctor = await Doctor.findOne({ _id: id, isActive: true });
  if (!doctor) {
    throw new AppError("Doctor not found", 404, "DOCTOR_NOT_FOUND");
  }
  if (currentUser) {
    await assertDoctorAccess(currentUser, doctor._id);
  }

  const date = typeof query.date === "string" ? query.date : null;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError("A valid date is required", 400, "VALIDATION_ERROR");
  }
  const duration = Math.min(240, Math.max(5, Number(query.duration || 30)));
  const slots = await getNextAvailableSlots({
    doctorId: doctor._id,
    date: new Date(`${date}T00:00:00Z`),
    duration,
  });
  return { doctorId: doctor._id, date, duration, availableSlots: slots };
};

module.exports = {
  createDoctor,
  getDoctors,
  getDoctorById,
  updateDoctor,
  deactivateDoctor,
  getDoctorAvailability,
};
