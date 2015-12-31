"use strict";
var assert = require("assert"),
extlogger = requireRoot("logger/bigquery/external-logger-bigquery.js")
(requireRoot("common/network.js"));

global.log = requireRoot("logger/logger.js")();

describe("external logger bigquery", function() {
  it("logs to bigquery", function() {
    return extlogger.log("testEvent", "testId", "testVersion", "testDetails")
    .then(resp=>{
      return resp.json();
    })
    .then(json=>{
      assert.ok(json.kind === "bigquery#tableDataInsertAllResponse");
    });
  });
});
