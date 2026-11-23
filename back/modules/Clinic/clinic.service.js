const Clinic = require("./clinic.model");
const Doctor = require("../Doctor/doctor.model");
const DoctorAssignment = require("../DoctorAssignment/doctorAssignment.model");
const Schedule = require("../Schedule/schedule.model");
const { AppError } = require("../../middlewares/errorHandler");

const timeToMinutes = (time) => {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const ownerClinicView = (clinic) => ({
  id: clinic._id,
  name: clinic.name,
  license_number: clinic.license_number,
  slot_duration_minutes: clinic.slot_duration_minutes,
  currency: clinic.currency,
  tax_note: clinic.tax_note,
  working_hours: clinic.working_hours,
  owner_doctor_id: clinic.owner_doctor_id,
});

const getStaffClinicContext = async (currentUser) => {
  const assignment = await DoctorAssignment.findOne({
    receptionist: currentUser._id,
    isActive: true,
  })
    .populate({
      path: "doctor",
      select: "user clinic",
      populate: {
        path: "user",
        select: "firstName lastName",
      },
    })
    .lean();

  if (!assignment?.doctor) return null;

  let clinic = null;
  if (assignment.clinic) {
    clinic = await Clinic.findById(assignment.clinic)
      .select("name")
      .lean();
  }
  if (!clinic) {
    const doctor = await Doctor.findById(assignment.doctor._id)
      .select("clinic")
      .lean();
    if (doctor?.clinic) {
      clinic = await Clinic.findById(doctor.clinic)
        .select("name")
        .lean();
    }
  }

  if (!clinic) return null;

  const doctorUser = assignment.doctor.user;
  return {
    id: clinic._id,
    name: clinic.name,
    doctor: doctorUser
      ? {
          id: assignment.doctor._id,
          name: `${doctorUser.firstName || ""} ${doctorUser.lastName || ""}`.trim(),
        }
      : null,
  };
};

const getMyClinic = async (currentUser) => {
  if (currentUser.role === "receptionist") {
    const staffView = await getStaffClinicContext(currentUser);
    if (!staffView) {
      throw new AppError("Clinic not found", 404, "CLINIC_NOT_FOUND");
    }
    return staffView;
  }

  if (currentUser.role !== "doctor") {
    throw new AppError("Only doctors and assigned staff can access clinic data", 403, "FORBIDDEN");
  }

  const doctor = await Doctor.findOne({
    user: currentUser._id,
    isActive: true,
  }).lean();

  if (!doctor) {
    throw new AppError("Doctor profile not found", 404, "DOCTOR_NOT_FOUND");
  }

  const clinic = await Clinic.findOne({
    $or: [
      { owner_doctor_id: doctor._id },
      { _id: doctor.clinic },
    ],
  }).lean();

  if (!clinic) {
    throw new AppError("Clinic not found", 404, "CLINIC_NOT_FOUND");
  }

  if (clinic.owner_doctor_id.toString() !== doctor._id.toString()) {
    throw new AppError("Clinic configuration is owner-only", 403, "FORBIDDEN");
  }

  return ownerClinicView(clinic);
};

const updateMyClinic = async (currentUser, data) => {
  if (currentUser.role !== "doctor") {
    throw new AppError("Only the clinic owner doctor can update clinic data", 403, "FORBIDDEN");
  }

  const doctor = await Doctor.findOne({
    user: currentUser._id,
    isActive: true,
  }).lean();

  if (!doctor) {
    throw new AppError("Only the clinic owner doctor can update clinic data", 403, "FORBIDDEN");
  }

  const clinic = await Clinic.findOne({ owner_doctor_id: doctor._id });
  if (!clinic) {
    throw new AppError("Only the clinic owner doctor can update clinic data", 403, "FORBIDDEN");
  }

  for (const field of [
    "name",
    "license_number",
    "slot_duration_minutes",
    "currency",
    "tax_note",
    "working_hours",
  ]) {
    if (data[field] !== undefined) clinic[field] = data[field];
  }

  await clinic.save();

  if (data.working_hours) {
    const shouldSync = data.syncDoctorSchedule !== false;
    const existingSchedules = await Schedule.find({ doctor: doctor._id });
    const scheduleByDay = new Map(existingSchedules.map((s) => [s.dayOfWeek, s]));
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    for (let day = 0; day <= 6; day++) {
      const dayName = dayNames[day];
      const clinicDay = data.working_hours[dayName];
      if (!clinicDay) continue;

      let schedule = scheduleByDay.get(day);

      if (clinicDay.closed || (clinicDay.emergency && !clinicDay.open)) {
        if (schedule && schedule.isActive) {
          schedule.isActive = false;
          schedule.updatedBy = currentUser._id;
          await schedule.save();
        }
      } else if (clinicDay.open && clinicDay.close) {
        const cs = timeToMinutes(clinicDay.open);
        const ce = timeToMinutes(clinicDay.close);

        if (schedule) {
          if (shouldSync) {
            schedule.startTime = clinicDay.open;
            schedule.endTime = clinicDay.close;
            schedule.isActive = true;
            if (schedule.breakStart && schedule.breakEnd) {
              const bs = timeToMinutes(schedule.breakStart);
              const be = timeToMinutes(schedule.breakEnd);
              if (bs < cs || be > ce) {
                schedule.breakStart = null;
                schedule.breakEnd = null;
              }
            }
          } else if (schedule.isActive) {
            let docStart = timeToMinutes(schedule.startTime);
            let docEnd = timeToMinutes(schedule.endTime);
            if (docStart < cs) schedule.startTime = clinicDay.open;
            if (docEnd > ce) schedule.endTime = clinicDay.close;
            if (timeToMinutes(schedule.startTime) >= timeToMinutes(schedule.endTime)) {
              schedule.startTime = clinicDay.open;
              schedule.endTime = clinicDay.close;
            }
            if (schedule.breakStart && schedule.breakEnd) {
              const bs = timeToMinutes(schedule.breakStart);
              const be = timeToMinutes(schedule.breakEnd);
              const ns = timeToMinutes(schedule.startTime);
              const ne = timeToMinutes(schedule.endTime);
              if (bs < ns || be > ne) {
                schedule.breakStart = null;
                schedule.breakEnd = null;
              }
            }
          }
          schedule.updatedBy = currentUser._id;
          await schedule.save();
        } else if (shouldSync) {
          await Schedule.create({
            doctor: doctor._id,
            dayOfWeek: day,
            startTime: clinicDay.open,
            endTime: clinicDay.close,
            isActive: true,
            createdBy: currentUser._id,
          });
        }
      }
    }
  }

  return ownerClinicView(clinic);
};

module.exports = { getMyClinic, updateMyClinic, ownerClinicView };
