const PaymentMethod = require("./paymentMethod.model");
const { AppError } = require("../../middlewares/errorHandler");

/**
 * Get active payment methods for receptionists and billing UI
 */
const getActivePaymentMethods = async () => {
  return PaymentMethod.find({ isActive: true })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();
};

/**
 * Get all payment methods (admin only)
 */
const getAllPaymentMethods = async () => {
  return PaymentMethod.find()
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();
};

/**
 * Get single payment method by ID
 */
const getPaymentMethodById = async (id) => {
  const method = await PaymentMethod.findById(id).lean();
  if (!method) {
    throw new AppError(
      "طريقة الدفع غير موجودة",
      404,
      "PAYMENT_METHOD_NOT_FOUND"
    );
  }
  return method;
};

/**
 * Find default payment method
 */
const getDefaultPaymentMethod = async (session = null) => {
  let query = PaymentMethod.findOne({ isDefault: true, isActive: true });
  if (session) query = query.session(session);
  let defaultMethod = await query;

  if (!defaultMethod) {
    let fallbackQuery = PaymentMethod.findOne({ code: "cash", isActive: true });
    if (session) fallbackQuery = fallbackQuery.session(session);
    defaultMethod = await fallbackQuery;
  }

  if (!defaultMethod) {
    let anyQuery = PaymentMethod.findOne({ isActive: true }).sort({ sortOrder: 1 });
    if (session) anyQuery = anyQuery.session(session);
    defaultMethod = await anyQuery;
  }

  // If database has no payment methods (e.g. newly initialized or cleared in tests), auto-create default cash
  if (!defaultMethod) {
    try {
      const [cash] = await PaymentMethod.create(
        [
          {
            code: "cash",
            nameAr: "نقدي",
            nameEn: "Cash",
            requiresReference: false,
            isActive: true,
            isDefault: true,
            sortOrder: 1,
          },
        ],
        session ? { session } : {}
      );
      defaultMethod = cash;
    } catch {
      defaultMethod = await PaymentMethod.findOne({ code: "cash" });
    }
  }

  return defaultMethod;
};

/**
 * Create a new payment method (Admin only)
 */
const createPaymentMethod = async (data) => {
  const existing = await PaymentMethod.findOne({
    code: data.code.toLowerCase().trim(),
  });

  if (existing) {
    throw new AppError(
      "كود طريقة الدفع مستخدم بالفعل",
      409,
      "PAYMENT_METHOD_CODE_EXISTS"
    );
  }

  if (data.isDefault) {
    await PaymentMethod.updateMany(
      { isDefault: true },
      { $set: { isDefault: false } }
    );
  }

  return PaymentMethod.create({
    ...data,
    code: data.code.toLowerCase().trim(),
  });
};

/**
 * Update an existing payment method (Admin only)
 */
const updatePaymentMethod = async (id, updates) => {
  const method = await PaymentMethod.findById(id);

  if (!method) {
    throw new AppError(
      "طريقة الدفع غير موجودة",
      404,
      "PAYMENT_METHOD_NOT_FOUND"
    );
  }

  // Prevent disabling the default method without reassigning
  if (updates.isActive === false && method.isDefault) {
    throw new AppError(
      "لا يمكن تعطيل طريقة الدفع الافتراضية، يرجى تعيين طريقة افتراضية أخرى أولاً",
      400,
      "CANNOT_DEACTIVATE_DEFAULT_METHOD"
    );
  }

  if (updates.isDefault === true) {
    await PaymentMethod.updateMany(
      { _id: { $ne: id }, isDefault: true },
      { $set: { isDefault: false } }
    );
  } else if (updates.isDefault === false && method.isDefault) {
    throw new AppError(
      "يجب أن تكون هناك طريقة دفع افتراضية واحدة على الأقل في النظام",
      400,
      "AT_LEAST_ONE_DEFAULT_REQUIRED"
    );
  }

  Object.assign(method, updates);
  await method.save();

  return method;
};

/**
 * Seed default payment methods (idempotent, safe to run repeatedly)
 */
const seedPaymentMethods = async () => {
  const defaultSeeds = [
    {
      code: "cash",
      nameAr: "نقدي",
      nameEn: "Cash",
      requiresReference: false,
      isActive: true,
      isDefault: true,
      sortOrder: 1,
    },
    {
      code: "card",
      nameAr: "بطاقة ائتمان",
      nameEn: "Credit Card",
      requiresReference: true,
      isActive: true,
      isDefault: false,
      sortOrder: 2,
    },
    {
      code: "vodafone_cash",
      nameAr: "فودافون كاش",
      nameEn: "Vodafone Cash",
      requiresReference: true,
      isActive: true,
      isDefault: false,
      sortOrder: 3,
    },
  ];

  const results = [];
  for (const seed of defaultSeeds) {
    const existing = await PaymentMethod.findOne({ code: seed.code });
    if (!existing) {
      const created = await PaymentMethod.create(seed);
      results.push({ action: "created", method: created });
    } else {
      // Keep attributes aligned without overwriting custom customizations
      results.push({ action: "existing", method: existing });
    }
  }

  // Ensure exactly one default method exists (cash default if none)
  const defaultCount = await PaymentMethod.countDocuments({ isDefault: true });
  if (defaultCount === 0) {
    await PaymentMethod.updateOne({ code: "cash" }, { $set: { isDefault: true } });
  } else if (defaultCount > 1) {
    // Keep only cash as default
    await PaymentMethod.updateMany({ code: { $ne: "cash" } }, { $set: { isDefault: false } });
    await PaymentMethod.updateOne({ code: "cash" }, { $set: { isDefault: true } });
  }

  return results;
};

module.exports = {
  getActivePaymentMethods,
  getAllPaymentMethods,
  getPaymentMethodById,
  getDefaultPaymentMethod,
  createPaymentMethod,
  updatePaymentMethod,
  seedPaymentMethods,
};
