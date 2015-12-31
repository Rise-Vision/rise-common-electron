var assert = require("assert"),
mock = require("simple-mock"),
extlogger,
fetchStub;

describe("external logger bigquery", function() {
  beforeEach("setup", ()=> {
    fetchStub = mock.stub()
    .resolveWith({json() {return Promise.resolve({access_token: "test-token"});}})
    .resolveWith({});

    extlogger = require("../../external-logger-bigquery.js")
    ({httpFetch: fetchStub}, "", "", "version");
    extlogger.setDisplaySettings("");
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

  it("makes the post call", function() {
    return extlogger.log("testEvent", "testDetails")
    .then(()=>{
      assert.ok(/datasets\/Installer_Events/.test(fetchStub.lastCall.args[0]));
      assert.ok(/tables\/events[0-9]{8}/.test(fetchStub.lastCall.args[0]));
      assert.ok(fetchStub.lastCall.args[1].headers.Authorization === "Bearer test-token");
      assert.ok(JSON.parse(fetchStub.lastCall.args[1].body).rows[0].json.event === "testEvent");
    });
  });

  it("makes the post call without details", function() {
    return extlogger.log("testEvent")
    .then(()=>{
      assert.ok(/datasets\/Installer_Events/.test(fetchStub.lastCall.args[0]));
      assert.ok(/tables\/events[0-9]{8}/.test(fetchStub.lastCall.args[0]));
      assert.ok(fetchStub.lastCall.args[1].headers.Authorization === "Bearer test-token");
      assert.ok(JSON.parse(fetchStub.lastCall.args[1].body).rows[0].json.event === "testEvent");
    });
  });

  it("logs using temp display id if no real display id set up", function() {
    extlogger.setDisplaySettings({tempdisplayid: "temp id"});
    return extlogger.log("testEvent")
    .then(()=>{
      var calledWithId = JSON.parse(fetchStub.lastCall.args[1].body).rows[0].json.display_id;
      assert.equal(calledWithId, "temp id");
    });
  });

  it("logs using real display id if it exists", function() {
    extlogger.setDisplaySettings({displayid: "real id"});
    return extlogger.log("testEvent")
    .then(()=>{
      var calledWithId = JSON.parse(fetchStub.lastCall.args[1].body).rows[0].json.display_id;
      assert.equal(calledWithId, "real id");
    });
  });

  it("doesn't refresh token if called recently", function() {
    return extlogger.log("testEvent", "testDetails")
    .then(()=>{
      return extlogger.log("testEvent", "testDetails");
    }).then(()=>{
      assert.equal(fetchStub.callCount, 3);
    });
  });

  it("refreshes token if not called recently", function() {
    var now= new Date();
    var hourAhead = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, now.getMinutes(), now.getSeconds());

    return extlogger.log("testEvent", "testDetails")
    .then(()=>{
      return extlogger.log("test2", "testDet", hourAhead);
    }).then(()=>{
      assert.equal(fetchStub.callCount, 4);
    });
  });

  it("rejects logging the event because token refresh failed", function() {
    var mock = require("simple-mock").mock;

    mock(extlogger, "refreshToken").rejectWith("error");

    return extlogger.log("testEvent", "testDetails")
    .catch((err)=>{
      assert(extlogger.refreshToken.called);
      assert(err);
    });
  });
});
