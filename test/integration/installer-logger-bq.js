"use strict";
var assert = require("assert"),
installerlogger = require("../../installer-logger-bq.js")
("testos", "testarch", "testversion", "testosdescription", __dirname);

describe("installer logger bigquery", function() {
  it("logs to bigquery", function() {
    return installerlogger.log("testEventName", "testDetails");
  });
});
