const Joi = require("joi");

const objectId = Joi.string().hex().length(24);
const dateOnly = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .custom((value, helpers) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      return helpers.error("date.invalid");
    }

    return value;
  }, "calendar date validation");

const createListQuerySchema = ({
  sortFields,
  filters = {},
  dateFields = false,
  search = true,
}) =>
  Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1),
    ...(search
      ? { search: Joi.string().trim().max(100) }
      : {}),
    sortBy: Joi.string().max(50),
    sortOrder: Joi.string().lowercase().valid("asc", "desc"),
    ...(dateFields
      ? {
          date: dateOnly,
          dateFrom: dateOnly,
          dateTo: dateOnly,
        }
      : {}),
    ...filters,
  })
  .custom((query, helpers) => {
    if (query.sortBy && !sortFields.includes(query.sortBy)) {
      query = { ...query, sortBy: undefined };
    }

    if (query.date && (query.dateFrom || query.dateTo)) {
      return helpers.error("object.dateConflict");
    }

    if (
      query.dateFrom &&
      query.dateTo &&
      query.dateFrom > query.dateTo
    ) {
      return helpers.error("object.dateOrder");
    }

    return query;
  }, "list date range validation")
    .messages({
      "object.dateConflict": '"date" cannot be combined with "dateFrom" or "dateTo"',
      "object.dateOrder": '"dateFrom" must be before or equal to "dateTo"',
    })
    .unknown(false);

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getSearchRegex = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return new RegExp(escapeRegex(value.trim()), "i");
};

const getSort = (
  query,
  allowedFields,
  defaultField = "createdAt",
  defaultOrder = "desc"
) => {
  const field = allowedFields.includes(query?.sortBy)
    ? query.sortBy
    : defaultField;
  const direction =
    query?.sortOrder === "asc" || query?.sortOrder === 1
      ? 1
      : query?.sortOrder === "desc" || query?.sortOrder === -1
        ? -1
        : defaultOrder === "asc"
          ? 1
          : -1;

  return field === "_id"
    ? { _id: direction }
    : { [field]: direction, _id: direction };
};

const getCairoMidnight = (date) => {
  const [year, month, day] = date.split("-").map(Number);
  const localMidnight = Date.UTC(year, month - 1, day);
  let timestamp = localMidnight;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(timestamp));
    const values = Object.fromEntries(
      parts.map(({ type, value }) => [type, value])
    );
    const cairoAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );

    timestamp = localMidnight - (cairoAsUtc - timestamp);
  }

  return new Date(timestamp);
};

const applyCairoDateRange = (
  filter,
  field,
  { date, dateFrom, dateTo } = {}
) => {
  const from = date || dateFrom;
  const to = date || dateTo;
  const range = {};

  if (from) {
    range.$gte = getCairoMidnight(from);
  }

  if (to) {
    const [year, month, day] = to.split("-").map(Number);
    const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
    const nextDay = [
      nextDate.getUTCFullYear(),
      String(nextDate.getUTCMonth() + 1).padStart(2, "0"),
      String(nextDate.getUTCDate()).padStart(2, "0"),
    ].join("-");
    range.$lt = getCairoMidnight(nextDay);
  }

  if (Object.keys(range).length) {
    filter[field] = range;
  }
};

const applyDoctorScope = async (
  filter,
  query,
  currentUser,
  Doctor
) => {
  if (currentUser?.role !== "doctor") {
    return;
  }

  const doctor = await Doctor.findOne({
    user: currentUser._id,
  })
    .select("_id")
    .lean()
    .exec();

  if (!doctor) {
    filter.doctor = { $in: [] };
    return;
  }

  const requestedDoctor = query?.doctor;
  filter.doctor =
    requestedDoctor &&
    requestedDoctor !== doctor._id.toString()
      ? { $in: [] }
      : doctor._id;
};

const getDoctorScopeId = async (currentUser, Doctor) => {
  if (currentUser?.role !== "doctor") {
      return undefined;
  }

  const doctor = await Doctor.findOne({
      user: currentUser._id,
  })
      .select("_id")
      .lean()
      .exec();

  return doctor?._id ?? null;
};

module.exports = {
  objectId,
  createListQuerySchema,
  getSearchRegex,
  getSort,
  applyCairoDateRange,
  applyDoctorScope,
  getDoctorScopeId,
};
