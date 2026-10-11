// middlewares/sanitize.js

/**
 * Recursively removes any keys containing MongoDB operators ($) or dot notation (.)
 * Mutates objects in-place to ensure compatibility with Express 5 getters on req.query.
 */
const sanitizeInPlace = (obj) => {
  if (!obj || typeof obj !== "object") {
    return;
  }

  // Handle Arrays
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (typeof obj[i] === "object" && obj[i] !== null) {
        sanitizeInPlace(obj[i]);
      }
    }
    return;
  }

  // Handle Objects
  const keys = Object.keys(obj);
  for (const key of keys) {
    if (key.includes("$") || key.includes(".")) {
      delete obj[key];
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      sanitizeInPlace(obj[key]);
    }
  }
};

const sanitize = (req, res, next) => {
  if (req.body) sanitizeInPlace(req.body);
  if (req.params) sanitizeInPlace(req.params);
  if (req.query) sanitizeInPlace(req.query);
  next();
};

module.exports = sanitize;
module.exports.sanitize = sanitize;
module.exports.sanitizeInPlace = sanitizeInPlace;
