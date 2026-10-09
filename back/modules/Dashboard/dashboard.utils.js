const CAIRO_TIMEZONE = "Africa/Cairo";

const getCairoDateParts = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAIRO_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  return {
    year: parts.find((part) => part.type === "year").value,
    month: parts.find((part) => part.type === "month").value,
    day: parts.find((part) => part.type === "day").value,
  };
};

const getCairoDate = () => {
  const { year, month, day } = getCairoDateParts();

  return `${year}-${month}-${day}`;
};

const parseCairoDate = (dateString, endOfDay = false) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error("Date must be in YYYY-MM-DD format");
  }

  return new Date(
    `${dateString}T${
      endOfDay ? "23:59:59.999" : "00:00:00.000"
    }+03:00`
  );
};

const getReportDateRange = ({
  period = "month",
  startDate,
  endDate,
} = {}) => {
  const now = new Date();

  let start;
  let end;

  // TODAY
  if (period === "today") {
    const cairoDate = getCairoDate();

    start = parseCairoDate(cairoDate);
    end = parseCairoDate(cairoDate, true);
  }

  // WEEK
  else if (period === "week") {
    const cairoDate = getCairoDate();

    const currentDay = parseCairoDate(cairoDate);

    const day = currentDay.getDay();

    // Monday = 0
    const diff = day === 0 ? 6 : day - 1;

    start = new Date(currentDay);

    start.setDate(start.getDate() - diff);

    end = new Date(start);

    end.setDate(end.getDate() + 7);
    end.setMilliseconds(-1);
  }

  // YEAR
  else if (period === "year") {
    const { year } = getCairoDateParts();

    start = parseCairoDate(`${year}-01-01`);

    end = parseCairoDate(
      `${Number(year) + 1}-01-01`
    );

    end.setMilliseconds(-1);
  }

  // CUSTOM
  else if (period === "custom") {
    if (!startDate || !endDate) {
      throw new Error(
        "startDate and endDate are required for custom period"
      );
    }

    start = parseCairoDate(startDate);
    end = parseCairoDate(endDate, true);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      throw new Error("Invalid date range");
    }

    if (start > end) {
      throw new Error(
        "startDate must be before or equal to endDate"
      );
    }
  }

  // MONTH
  else if (period === "month") {
    const { year, month } = getCairoDateParts();

    start = parseCairoDate(
      `${year}-${month}-01`
    );

    const nextMonth =
      Number(month) === 12
        ? `${Number(year) + 1}-01`
        : `${year}-${String(
            Number(month) + 1
          ).padStart(2, "0")}`;

    end = parseCairoDate(nextMonth + "-01");

    end.setMilliseconds(-1);
  }

  // INVALID PERIOD
  else {
    throw new Error(
      "Invalid period. Allowed values: today, week, month, year, custom"
    );
  }

  return {
    start,
    end,
  };
};

module.exports = {
  getReportDateRange,
};