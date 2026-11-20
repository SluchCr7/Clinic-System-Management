const { AppError } = require("../middlewares/errorHandler");

const assertVisitInProgress = (visit) => {
  if (visit?.status !== "in_progress") {
    throw new AppError(
      "Clinical records can only be added to an in-progress visit",
      409,
      "VISIT_NOT_EDITABLE"
    );
  }

  return visit;
};

module.exports = {
  assertVisitInProgress,
};
