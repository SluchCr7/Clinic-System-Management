const bcrypt = require("bcrypt");
const crypto = require("crypto");
const User = require("../modules/User/user.model");
const Patient = require("../modules/Patient/patient.model");
const Doctor = require("../modules/Doctor/doctor.model");
const DoctorAssignment = require("../modules/DoctorAssignment/doctorAssignment.model");
const Clinic = require("../modules/Clinic/clinic.model");
const mongoose = require("mongoose");
const Schedule = require("../modules/Schedule/schedule.model");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../middlewares/generateToken");

const createTestUser = async ({
  role = "admin",
  email = `${role}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@example.com`,
  password = "StrongPassword123!",
  firstName = "Test",
  lastName = "User",
  phone = "555-0100",
  isActive = true,
} = {}) => {
  const hashedPassword = await bcrypt.hash(password, 4);
  const tokenId = crypto.randomUUID();
  const user = await User.create({
    firstName,
    lastName,
    email,
    password: hashedPassword,
    phone,
    role,
    isActive,
    activeRefreshTokens: [{ tokenId, createdAt: new Date() }],
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user, tokenId);

  return {
    user,
    plainPassword: password,
    accessToken,
    refreshToken,
    authHeader: "Bearer " + accessToken,
  };
};

const createTestDoctor = async (createdBy) => {
  const doctorUser = await createTestUser({
    role: "doctor",
    firstName: "Morgan",
    lastName: "Doctor",
  });
  const session = await mongoose.startSession();
  let doctor;

  try {
    await session.withTransaction(async () => {
      const doctorId = new mongoose.Types.ObjectId();
      const clinicId = new mongoose.Types.ObjectId();

      [doctor] = await Doctor.create(
        [
          {
            _id: doctorId,
            user: doctorUser.user._id,
            clinic: clinicId,
            specialization: "Family Medicine",
            licenseNumber: `LIC-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
            consultationFee: 100,
            createdBy: createdBy._id,
          },
        ],
        { session }
      );

      const [clinic] = await Clinic.create(
        [
          {
            _id: clinicId,
            name: "عيادة د. Morgan Doctor",
            slot_duration_minutes: 15,
            currency: "USD",
            working_hours: {
              sunday: { closed: false, emergency: true },
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

      doctorUser.user.clinic = clinic._id;
      await doctorUser.user.save({ session });
    });
  } finally {
    await session.endSession();
  }

  return { doctor, doctorUser };
};

const assignTestDoctor = async (receptionistUser, doctor, adminUser) => {
  return DoctorAssignment.findOneAndUpdate(
    {
      doctor: doctor._id || doctor,
      receptionist: receptionistUser._id || receptionistUser,
    },
    {
      doctor: doctor._id || doctor,
      receptionist: receptionistUser._id || receptionistUser,
      assignedBy: adminUser?._id || receptionistUser._id || receptionistUser,
      isActive: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const createTestPatient = async (createdBy, overrides = {}) => {
  let doctorId = overrides.doctor;
  if (!doctorId) {
    let defaultDoctor = await Doctor.findOne({ isActive: true });
    if (!defaultDoctor) {
      const { doctor } = await createTestDoctor(createdBy);
      defaultDoctor = doctor;
    }
    doctorId = defaultDoctor._id;
  }

  // If createdBy is receptionist, automatically assign the receptionist to the doctor for convenience in tests
  if (createdBy && createdBy.role === "receptionist") {
    await assignTestDoctor(createdBy, { _id: doctorId }, createdBy);
  }

  return Patient.create({
    firstName: "Taylor",
    lastName: "Patient",
    dateOfBirth: new Date("1990-01-01"),
    gender: "female",
    phone: `555-0101-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    doctor: doctorId,
    createdBy: createdBy._id,
    ...overrides,
  });
};

const getClinicDayOfWeek = (date) => {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo",
    weekday: "short",
  }).format(date);
  const days = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return days[weekday];
};

const createTestSchedule = async (doctor, createdBy, date) =>
  Schedule.create({
    doctor: doctor._id,
    dayOfWeek: getClinicDayOfWeek(date),
    startTime: "00:00",
    endTime: "23:59",
    isActive: true,
    createdBy: createdBy._id,
  });

const getFutureAppointmentDate = (daysAhead = 3) => {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  date.setUTCHours(12, 0, 0, 0);
  return date;
};

module.exports = {
  createTestUser,
  createTestPatient,
  createTestDoctor,
  assignTestDoctor,
  createTestSchedule,
  getFutureAppointmentDate,
};
