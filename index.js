var logger = require("./logger.js"),
externalLogger = require("./external-logger-bigquery.js"),
network = require("./network.js"),
platform = require("./platform.js"),
proxy = require("./proxy.js");

module.exports = {
  logger,
  externalLogger,
  network,
  platform,
  proxy
};
