const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const getUriFilePath = (rootDir) =>
  path.join(
    os.tmpdir(),
    `clinic-management-test-mongo-${crypto
      .createHash("sha256")
      .update(path.resolve(rootDir))
      .digest("hex")
      .slice(0, 12)}.json`
  );

module.exports = async (globalConfig) => {
  try {
    if (global.__CLINIC_TEST_MONGO__) {
      await global.__CLINIC_TEST_MONGO__.stop();
    }
  } finally {
    const uriFile = getUriFilePath(globalConfig.rootDir);
    if (fs.existsSync(uriFile)) {
      fs.unlinkSync(uriFile);
    }
  }
};
