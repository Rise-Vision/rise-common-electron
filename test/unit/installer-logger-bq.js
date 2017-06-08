var assert = require("assert"),
  simple = require("simple-mock"),
  lolex = require("lolex"),
  fs = require("fs"),
  bqClient,
  installerLogger;

describe("external logger bigquery", function() {
  beforeEach("setup", ()=> {
    simple.mock(fs, "writeFile").returnWith();

    installerLogger = require("../../installer-logger-bq.js")
    ("", "", "version", "", __dirname);
    installerLogger.setDisplaySettings("");

    bqClient = installerLogger.getBQClient();

  });

  afterEach(()=>{
    simple.restore();
  });

  it("exists", function() {
    assert.ok(installerLogger);
  });

  it("formats the date correctly", function() {
    assert.equal(installerLogger.getDateForTableName(new Date(2015, 5, 3)), "20150603");
    assert.equal(installerLogger.getDateForTableName(new Date(2015, 11, 3)), "20151203");
    assert.equal(installerLogger.getDateForTableName(new Date(2015, 11, 30)), "20151230");
  });

  it("rejects the call if eventName is not provided", function() {
    return installerLogger.log()
      .then(()=>{
        throw Error("Should not be here");
      })
      .catch((err)=>{
        assert(err === "eventName is required");
      });
  });

  it("logs using temp display id if no real display id set up", function() {
    simple.mock(bqClient, "insert").resolveWith();
    installerLogger.setDisplaySettings({tempdisplayid: "temp id"});
    return installerLogger.log("testEvent")
      .then(()=>{
        var calledWithId = bqClient.insert.lastCall.args[1].display_id;
        assert.equal(calledWithId, "temp id");
      });
  });

  it("logs using real display id if it exists", function() {
    simple.mock(bqClient, "insert").resolveWith();
    installerLogger.setDisplaySettings({displayid: "real id"});
    return installerLogger.log("testEvent")
      .then(()=>{
        var calledWithId = bqClient.insert.lastCall.args[1].display_id;
        assert.equal(calledWithId, "real id");
      });
  });

  it("adds failed log entries on insert failure", ()=>{
    simple.mock(bqClient, "insert").rejectWith();
    return installerLogger.log("testEvent")
      .then(()=>{
        assert.equal(Object.keys(installerLogger.pendingEntries()).length, 1);
      });
  });
});
