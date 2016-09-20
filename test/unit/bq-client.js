const testTableName = "events20160101";

var assert = require("assert"),
simple = require("simple-mock"),
network = require("../../network.js"),
bqClient;

describe("bigquery client", function() {
  beforeEach("setup", ()=> {
    simple.mock(network, "httpFetch")
      .resolveWith({json() {return Promise.resolve({access_token: "test-token"});}});

    bqClient = require("../../bq-client.js")("client-side-events", "Installer_Events");
  });

  afterEach(()=>{
    simple.restore();
  });

  it("exists", function() {
    assert.ok(bqClient);
  });

  it("rejects the call if tableName is not provided", function() {
    return bqClient.insert()
    .catch((err)=>{
      assert(err);
    });
  });

  it("makes the post call", function() {
    return bqClient.insert(testTableName, { event: "testEvent" })
    .then(()=>{
      assert.ok(/datasets\/Installer_Events/.test(network.httpFetch.lastCall.args[0]));
      assert.ok(/tables\/events[0-9]{8}/.test(network.httpFetch.lastCall.args[0]));
      assert.ok(network.httpFetch.lastCall.args[1].headers.Authorization === "Bearer test-token");
      assert.ok(JSON.parse(network.httpFetch.lastCall.args[1].body).rows[0].json.event === "testEvent");
    });
  });

  it("makes the post call with template sufix", function() {
    return bqClient.insert(testTableName, { event: "testEvent" }, null, "20160101")
      .then(()=>{
      assert.ok(/datasets\/Installer_Events/.test(network.httpFetch.lastCall.args[0]));
    assert.ok(/tables\/events[0-9]{8}/.test(network.httpFetch.lastCall.args[0]));
    assert.ok(network.httpFetch.lastCall.args[1].headers.Authorization === "Bearer test-token");
    assert.ok(JSON.parse(network.httpFetch.lastCall.args[1].body).rows[0].json.event === "testEvent");
    assert.ok(JSON.parse(network.httpFetch.lastCall.args[1].body).templateSuffix === "20160101");

    });
  });

  it("makes the post call without details", function() {
    return bqClient.insert(testTableName, { event: "testEvent" })
    .then(()=>{
      assert.ok(/datasets\/Installer_Events/.test(network.httpFetch.lastCall.args[0]));
      assert.ok(/tables\/events[0-9]{8}/.test(network.httpFetch.lastCall.args[0]));
      assert.ok(network.httpFetch.lastCall.args[1].headers.Authorization === "Bearer test-token");
      assert.ok(JSON.parse(network.httpFetch.lastCall.args[1].body).rows[0].json.event === "testEvent");
    });
  });

  it("doesn't refresh token if called recently", function() {
    return bqClient.insert(testTableName, { event: "testEvent" })
    .then(()=>{
      return bqClient.insert(testTableName, { event: "testEvent" });
    }).then(()=>{
      assert.equal(network.httpFetch.callCount, 3);
    });
  });

  it("refreshes token if not called recently", function() {
    var now= new Date();
    var hourAhead = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, now.getMinutes(), now.getSeconds());

    return bqClient.insert(testTableName, { event: "testEvent" })
    .then(()=>{
      return bqClient.insert(testTableName, { event: "testEvent" }, hourAhead);
    }).then(()=>{
      assert.equal(network.httpFetch.callCount, 4);
    });
  });

  it("rejects logging the event because token refresh failed", function() {
    var mock = require("simple-mock").mock;

    mock(bqClient, "refreshToken").rejectWith("error");

    return bqClient.insert(testTableName, { event: "testEvent" })
    .catch((err)=>{
      assert(bqClient.refreshToken.called);
      assert(err);
    });
  });
});
