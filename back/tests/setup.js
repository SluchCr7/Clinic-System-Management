const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { MongoClient } = require("mongodb");

const originalMongoClientConnect = MongoClient.prototype.connect;
MongoClient.prototype.connect = function (...args) {
  // Jest's VM serializes the driver's Map-based metadata as an empty document.
  this.options.metadata = Promise.resolve({
    driver: { name: "nodejs", version: "test" },
    platform: `Node.js ${process.version}`,
    os: {
      name: os.platform(),
      architecture: os.arch(),
      version: os.release(),
      type: os.type(),
    },
  });
  return originalMongoClientConnect.apply(this, args);
};

const uriFile = path.join(
  os.tmpdir(),
  `clinic-management-test-mongo-${crypto
    .createHash("sha256")
    .update(path.resolve(__dirname, ".."))
    .digest("hex")
    .slice(0, 12)}.json`
);
let connectedDatabaseName;

const clearCollections = async () => {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((collection) =>
      collection.deleteMany({})
    )
  );
};

beforeAll(async () => {
  if (!fs.existsSync(uriFile)) {
    throw new Error(
      "MongoDB test replica set was not initialized by Jest globalSetup"
    );
  }

  const { uri } = JSON.parse(fs.readFileSync(uriFile, "utf8"));
  if (!uri) {
    throw new Error("Jest globalSetup did not provide a MongoDB URI");
  }

  connectedDatabaseName = `clinic_test_${expect
    .getState()
    .testPath.split(/[\\/]/)
    .pop()
    .replace(/[^a-zA-Z0-9_]/g, "_")}`;

  await mongoose.connect(uri, {
    dbName: connectedDatabaseName,
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10_000,
  });
});

beforeEach(clearCollections);
afterEach(clearCollections);

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
