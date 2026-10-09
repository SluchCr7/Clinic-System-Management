const asyncHandler = require("express-async-handler");

const labOrderService = require("./labOrder.service");

const { AppError } = require("../../middlewares/errorHandler");

// ---------------------------------------------
// Create Lab Order
// ---------------------------------------------

const createLabOrder = asyncHandler(
  async (req, res) => {
    const labOrder =
      await labOrderService.createLabOrder(
        req.body,
        req.user
      );

    res.status(201).json({
      success: true,
      message: "Lab order created successfully",
      data: labOrder,
    });
  }
);

// ---------------------------------------------
// Get Lab Orders
// ---------------------------------------------

const getLabOrders = asyncHandler(
  async (req, res) => {
    const { data: labOrders, pagination } =
      await labOrderService.getLabOrders(
        req.validatedQuery,
        req.user
      );

    res.status(200).json({
      success: true,
      data: labOrders,
      pagination,
    });
  }
);

// ---------------------------------------------
// Get Lab Order By ID
// ---------------------------------------------

const getLabOrderById = asyncHandler(
  async (req, res) => {
    const labOrder =
      await labOrderService.getLabOrderById(
        req.params.id
      );

    if (!labOrder) {
      throw new AppError(
        "Lab order not found",
        404,
        "LAB_ORDER_NOT_FOUND"
      );
    }

    res.status(200).json({
      success: true,
      data: labOrder,
    });
  }
);

// ---------------------------------------------
// Update Lab Order
// ---------------------------------------------

const updateLabOrder = asyncHandler(
  async (req, res) => {
    const labOrder =
      await labOrderService.updateLabOrder(
        req.params.id,
        req.body,
        req.user
      );

    if (!labOrder) {
      throw new AppError(
        "Lab order not found",
        404,
        "LAB_ORDER_NOT_FOUND"
      );
    }

    res.status(200).json({
      success: true,
      message: "Lab order updated successfully",
      data: labOrder,
    });
  }
);

module.exports = {
  createLabOrder,
  getLabOrders,
  getLabOrderById,
  updateLabOrder,
};