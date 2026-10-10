const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

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
  const replicaSet = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
    },
    binary: process.env.MONGOMS_VERSION
      ? { version: process.env.MONGOMS_VERSION }
      : undefined,
  });
  const uriFile = getUriFilePath(globalConfig.rootDir);

  if (fs.existsSync(uriFile)) {
    fs.unlinkSync(uriFile);
  }
  global.__CLINIC_TEST_MONGO__ = replicaSet;
  fs.writeFileSync(uriFile, JSON.stringify({ uri: replicaSet.getUri() }));
};
