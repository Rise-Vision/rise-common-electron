"use strict";
var assert = require("assert"),
extlogger = require("../../external-logger-bigquery.js")
("testos", "testarch", "testversion", "testosdescription");

describe("external logger bigquery", function() {
  it("logs to bigquery", function() {
    return extlogger.log("testEventName", "testDetails");
  });
});
