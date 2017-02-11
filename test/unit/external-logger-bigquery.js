var assert = require("assert"),
simple = require("simple-mock"),
lolex = require("lolex"),
fs = require("fs"),
bqClient,
extlogger;

describe("external logger bigquery", function() {
  beforeEach("setup", ()=> {
    simple.mock(fs, "writeFile").returnWith();
  
    extlogger = require("../../external-logger-bigquery.js")
    ("", "", "version", "", __dirname);
    extlogger.setDisplaySettings("");

    bqClient = extlogger.getBQClient();

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
    .then(()=>{
      throw Error("Should not be here");
    })
    .catch((err)=>{
      assert(err === "eventName is required");
    });
  });

  it("logs using temp display id if no real display id set up", function() {
    simple.mock(bqClient, "insert").resolveWith();
    extlogger.setDisplaySettings({tempdisplayid: "temp id"});
    return extlogger.log("testEvent")
    .then(()=>{
      var calledWithId = bqClient.insert.lastCall.args[1].display_id;
      assert.equal(calledWithId, "temp id");
    });
  });

  it("logs using real display id if it exists", function() {
    simple.mock(bqClient, "insert").resolveWith();
    extlogger.setDisplaySettings({displayid: "real id"});
    return extlogger.log("testEvent")
    .then(()=>{
      var calledWithId = bqClient.insert.lastCall.args[1].display_id;
      assert.equal(calledWithId, "real id");
    });
  });

  it("adds failed log entries on insert failure", ()=>{
    simple.mock(bqClient, "insert").rejectWith();
    return extlogger.log("testEvent")
    .then(()=>{
      assert.equal(Object.keys(extlogger.pendingEntries()).length, 1);
      console.log(extlogger.pendingEntries());
    });
  });

  it("failed log entries are logged after time passes", ()=>{
    simple.mock(bqClient, "insert").rejectWith().resolveWith();
    clock = lolex.install();

    return extlogger.log("testEvent")
    .then(()=>{
      assert.equal(Object.keys(extlogger.pendingEntries()).length, 1);
      clock.runToLast();
      clock.uninstall();
      return new Promise((res, rej)=>{
        setTimeout(()=>{
          assert.equal(bqClient.insert.callCount, 2);
          assert.equal(Object.keys(extlogger.pendingEntries()).length, 0);
          res();
        }, 100);
      });
    });
  });

  it("multiple attempts are made to log entries after time passes", ()=>{
    simple.mock(bqClient, "insert").rejectWith().rejectWith().resolveWith();
    nativeTimeout = setTimeout;
    clock = lolex.install();

    return extlogger.log("testEvent")
    .then(()=>{
      assert.equal(Object.keys(extlogger.pendingEntries()).length, 1);
      assert.equal(bqClient.insert.callCount, 1);
      clock.runToLast();
      return new Promise((res, rej)=>{
        nativeTimeout(()=>{
          assert.equal(bqClient.insert.callCount, 2);
          clock.runToLast();
          res();
        }, 100);
      })
      .then(()=>{
        clock.uninstall();
        return new Promise((res, rej)=>{
          setTimeout(()=>{
            assert.equal(bqClient.insert.callCount, 3);
            assert(/events[\d]{8}/.test(bqClient.insert.lastCall.args[0]));
            assert.equal(bqClient.insert.lastCall.args[1].event, "testEvent");
            assert.equal(Object.keys(bqClient.insert.lastCall.args[1]).length, 6);
            assert.equal(Object.keys(extlogger.pendingEntries()).length, 0);
            res();
          }, 100);
        });
      });
    });
  });

  it("persists and retrieves failed entries", ()=>{
    nativeTimeout = setTimeout;
    clock = lolex.install();

    extlogger = require("../../external-logger-bigquery.js")
    ("", "", "version", "", __dirname);
    extlogger.setDisplaySettings("");

    bqClient = extlogger.getBQClient();
    simple.mock(bqClient, "insert").rejectWith().rejectWith().resolveWith();

    return extlogger.log("testEvent")
    .then(()=>{
      assert.equal(Object.keys(extlogger.pendingEntries()).length, 1);
      assert.equal(bqClient.insert.callCount, 1);
      clock.runToLast();
      clock.uninstall();
      return new Promise((res, rej)=>{
        nativeTimeout(()=>{
          assert.equal(bqClient.insert.callCount, 2);
          assert.equal(fs.writeFile.callCount, 1);
          assert(fs.writeFile.lastCall.args[0].includes(__dirname));
          assert(fs.writeFile.lastCall.args[0].includes(".json"));
          assert(JSON.parse(fs.writeFile.lastCall.args[1])[0][1].installer_version);
          res();
        }, 100);
      });
    });
  });
});
