const bcrypt = require("bcrypt");
const User = require("../modules/User/user.model");
const Patient = require("../modules/Patient/patient.model");
const Doctor = require("../modules/Doctor/doctor.model");
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
  const user = await User.create({
    firstName,
    lastName,
    email,
    password: hashedPassword,
    phone,
    role,
    isActive,
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return {
    user,
    plainPassword: password,
    accessToken,
    refreshToken,
    authHeader: `Bearer ${accessToken}`,
  };
};

const createTestPatient = async (createdBy, overrides = {}) =>
  Patient.create({
    firstName: "Taylor",
    lastName: "Patient",
    dateOfBirth: new Date("1990-01-01"),
    gender: "female",
    phone: `555-0101-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    createdBy: createdBy._id,
    ...overrides,
  });

const createTestDoctor = async (createdBy) => {
  const doctorUser = await createTestUser({
    role: "doctor",
    firstName: "Morgan",
    lastName: "Doctor",
  });
  const doctor = await Doctor.create({
    user: doctorUser.user._id,
    specialization: "Family Medicine",
    licenseNumber: `LIC-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    consultationFee: 100,
    createdBy: createdBy._id,
  });

  return { doctor, doctorUser };
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
  createTestSchedule,
  getFutureAppointmentDate,
};
