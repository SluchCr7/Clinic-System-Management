const getPagination = (page = 1, limit = 10) => {
  const parsedPage = Number(page);
  const parsedLimit = Number(limit);

  let currentPage =
    Number.isSafeInteger(parsedPage) && parsedPage > 0
      ? parsedPage
      : 1;

  const currentLimit =
    Number.isSafeInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 100)
      : 10;

  currentPage = Math.min(
    currentPage,
    Math.floor(Number.MAX_SAFE_INTEGER / currentLimit)
  );
  const skip = (currentPage - 1) * currentLimit;

  return {
    page: currentPage,
    limit: currentLimit,
    skip,
  };
};

const getPaginationMeta = (page, limit, total) => {
  const pages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    pages,
    hasNextPage: page < pages,
    hasPrevPage: page > 1,
  };
};

const paginateQuery = async (
  findQuery,
  countQuery,
  page,
  limit
) => {
  const pagination = getPagination(page, limit);
  const [data, total] = await Promise.all([
    findQuery
      .skip(pagination.skip)
      .limit(pagination.limit)
      .exec(),
    countQuery.exec(),
  ]);

  return {
    data,
    pagination: getPaginationMeta(
      pagination.page,
      pagination.limit,
      total
    ),
  };
};

module.exports = {
  getPagination,
  getPaginationMeta,
  paginateQuery,
};