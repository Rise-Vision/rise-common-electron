var assert = require("assert"),
simple = require("simple-mock"),
bqClient,
extlogger;

describe("external logger bigquery", function() {
  beforeEach("setup", ()=> {
    extlogger = require("../../external-logger-bigquery.js")
    ("", "", "version");
    extlogger.setDisplaySettings("");

    bqClient = extlogger.getBQClient();
    simple.mock(bqClient, "insert").resolveWith();
  });

  afterEach(()=>{
    simple.restore();
  });

  it("exists", function() {
    assert.ok(extlogger);
  });

  it("formats the date correctly", function() {
    assert.equal(extlogger.getDateForTableName(new Date(2015, 5, 3)), "20150603");
    assert.equal(extlogger.getDateForTableName(new Date(2015, 11, 3)), "20151203");
    assert.equal(extlogger.getDateForTableName(new Date(2015, 11, 30)), "20151230");
  });

  it("rejects the call if eventName is not provided", function() {
    return extlogger.log()
    .catch((err)=>{
      assert(err);
    });
  });

  it("logs using temp display id if no real display id set up", function() {
    extlogger.setDisplaySettings({tempdisplayid: "temp id"});
    return extlogger.log("testEvent")
    .then(()=>{
      var calledWithId = bqClient.insert.lastCall.args[1].display_id;
      assert.equal(calledWithId, "temp id");
    });
  });

  it("logs using real display id if it exists", function() {
    extlogger.setDisplaySettings({displayid: "real id"});
    return extlogger.log("testEvent")
    .then(()=>{
      var calledWithId = bqClient.insert.lastCall.args[1].display_id;
      assert.equal(calledWithId, "real id");
    });
  });
});
