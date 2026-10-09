const asyncHandler = require("express-async-handler");
const searchService = require("./search.service");

const globalSearch = asyncHandler(async (req, res) => {
  const data = await searchService.globalSearch(
    req.validatedQuery,
    req.user
  );

  res.status(200).json({
    success: true,
    data,
  });
});

module.exports = { globalSearch };
