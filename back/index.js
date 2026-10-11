require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const { initSocket } = require("./utils/socket");
const connectDB = require("./config/db");
const { validateEnv } = require("./config/env");
const { AppError } = require("./utils/appError");
const { errorHandler } = require("./middlewares/errorHandler");
const http = require("http");
const { Server } = require("socket.io");
const socketAuth = require("./middlewares/socketAuth");
const { startReminderJob, stopReminderJob } = require("./utils/reminder");
const requestId = require("./middlewares/requestId");
const sanitize = require("./middlewares/sanitize");
// Validate essential environment variables
validateEnv();

const app = express();

// -------------------------
// Security Headers
// -------------------------
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

// -------------------------
// CORS
// -------------------------
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean);

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

io.use(socketAuth);
initSocket(io);

io.on("connection", (socket) => {
  console.log("🟢 A user connected", socket.id);
  console.log("👤 Socket user:", socket.user._id);
  console.log("👤 Socket role:", socket.user.role);
  const userRoom = `user:${socket.user._id}`;

  socket.join(userRoom);
  io.to(userRoom).emit("private:test", {
    message: "This message is only for you",
  });
  console.log("🏠 User joined room:", userRoom);
});

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// -------------------------
// Rate Limiting
// -------------------------
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 10000 : 500,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 15 minutes",
    code: "RATE_LIMIT_EXCEEDED",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 10000 : 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts, please try again after 15 minutes",
    code: "AUTH_RATE_LIMIT_EXCEEDED",
  },
});

app.use(requestId);

// -------------------------
// Body Parsers & Sanitizers
// -------------------------
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(sanitize);
app.use(hpp());

// Apply rate limiter to general API
app.use("/api", generalLimiter);

// -------------------------
// System & Health Endpoints
// -------------------------
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    name: "Clinic Management API",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  res.status(200).json({
    success: true,
    status: "ok",
    database: dbStatusMap[dbState] || "unknown",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// -------------------------
// API Routes
// -------------------------
app.use("/api/auth", authLimiter, require("./modules/Auth/auth.route"));
app.use("/api/users", require("./modules/User/user.routes"));
app.use("/api/patients", require("./modules/Patient/patient.route"));
app.use("/api/doctors", require("./modules/Doctor/doctor.route"));
app.use("/api/schedules", require("./modules/Schedule/schedule.route"));
app.use("/api/appointments", require("./modules/Appointment/appointment.route"));
app.use("/api/visites", require("./modules/Visit/visit.route"));
app.use("/api/visits", require("./modules/Visit/visit.route")); // Alias for backwards-compatibility
app.use("/api/prescriptions", require("./modules/Prescription/prescription.route"));
app.use("/api/medical-services", require("./modules/medicalService/medicalService.route"));
app.use("/api/performed-services", require("./modules/performedService/performedService.route"));
app.use("/api/invoices", require("./modules/Invoice/invoice.route"));
app.use("/api/payments", require("./modules/Payment/payment.route"));
app.use("/api/medical-attachments", require("./modules/medicalAttachment/medicalAttachment.route"));
app.use("/api/lab-orders", require("./modules/LabOrder/labOrder.route"));
app.use("/api/notifications", require("./modules/Notification/notification.route"));
app.use("/api/audit-logs", require("./modules/AuditLog/auditLog.route"));
app.use("/api/dashboard", require("./modules/Dashboard/dashboard.route"));
app.use("/api/search", require("./modules/Search/search.route"));

// -------------------------
// 404 & Error Handler
// -------------------------
app.use((req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404, "NOT_FOUND"));
});

app.use(errorHandler);

// -------------------------
// Server Startup & Graceful Shutdown
// -------------------------
let server;

if (process.env.NODE_ENV !== "test") {
  connectDB().then(() => startReminderJob());
  const PORT = process.env.PORT || 5000;
  server = httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });

  const gracefulShutdown = (signal) => {
    console.log(`${signal} received. Shutting down gracefully...`);
    if (server) {
      server.close(async () => {
        console.log("HTTP server closed.");
        await stopReminderJob();
        try {
          await mongoose.connection.close(false);
          console.log("MongoDB connection closed.");
        } catch (err) {
          console.error("Error closing MongoDB connection:", err);
        }
        process.exit(0);
      });
    }
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

module.exports = app;