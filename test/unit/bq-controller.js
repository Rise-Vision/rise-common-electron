var assert = require("assert"),
  simple = require("simple-mock"),
  lolex = require("lolex"),
  fs = require("fs"),
  bqClient,
  bqController;

describe("big query insert", function() {
  beforeEach("setup", ()=> {
    simple.mock(fs, "writeFile").returnWith();

    bqController = require("../../bq-controller.js")
    ("test-side-events", "Test_Events", ".test-failed-log-entries.json", __dirname);
    bqClient = bqController.getBQClient();

    bqController.init();

  });

  afterEach(()=>{
    simple.restore();
  });

  it("exists", function() {
    assert.ok(bqController);
  });

  it("returns a date formatted correctly for appending to a table name", function() {
    assert.equal(bqController.getDateForTableName(new Date(2015, 5, 3)), "20150603");
    assert.equal(bqController.getDateForTableName(new Date(2015, 11, 3)), "20151203");
    assert.equal(bqController.getDateForTableName(new Date(2015, 11, 30)), "20151230");
  });

  it("adds failed log entries on insert failure", ()=>{
    simple.mock(bqClient, "insert").rejectWith();
    return bqController.log("testTable", {test:"test"}, new Date())
      .catch(()=>{
        assert.equal(Object.keys(bqController.pendingEntries()).length, 1);
      });
  });

  it("failed log entries are logged after time passes", ()=>{
    simple.mock(bqClient, "insert").rejectWith().resolveWith();
    clock = lolex.install();

    return bqController.log("testTable", {test:"test"}, new Date())
      .catch(()=>{
        assert.equal(Object.keys(bqController.pendingEntries()).length, 1);
        clock.runToLast();
        clock.uninstall();
        return new Promise((res, rej)=>{
          setTimeout(()=>{
            assert.equal(bqClient.insert.callCount, 2);
            assert.equal(Object.keys(bqController.pendingEntries()).length, 0);
            res();
          }, 100);
        });
      });
  });

  it("multiple attempts are made to log entries after time passes", ()=>{
    simple.mock(bqClient, "insert").rejectWith().rejectWith().resolveWith();
    nativeTimeout = setTimeout;
    clock = lolex.install();

    return bqController.log("testTable", {test:"test"}, new Date())
      .catch(()=>{
        assert.equal(Object.keys(bqController.pendingEntries()).length, 1);
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
                assert.equal(bqClient.insert.lastCall.args[0], "testTable");
                assert.equal(bqClient.insert.lastCall.args[1].test, "test");
                assert.equal(Object.keys(bqClient.insert.lastCall.args[1]).length, 1);
                assert.equal(Object.keys(bqController.pendingEntries()).length, 0);
                res();
              }, 100);
            });
          });
      });
  });

  it("persists and retrieves failed entries", ()=>{
    nativeTimeout = setTimeout;
    clock = lolex.install();

    bqController = require("../../bq-controller.js")
    ("test-side-events", "Test_Events", ".test-failed-log-entries.json", __dirname);
    bqClient = bqController.getBQClient();
    bqController.init();

    simple.mock(bqClient, "insert").rejectWith().rejectWith().resolveWith();

    return bqController.log("testTable", {test:"test"}, new Date())
      .catch(()=>{
        assert.equal(Object.keys(bqController.pendingEntries()).length, 1);
        assert.equal(bqClient.insert.callCount, 1);
        clock.runToLast();
        clock.uninstall();
        return new Promise((res, rej)=>{
          nativeTimeout(()=>{
            assert.equal(bqClient.insert.callCount, 2);
            assert.equal(fs.writeFile.callCount, 1);
            assert(fs.writeFile.lastCall.args[0].includes(__dirname));
            assert(fs.writeFile.lastCall.args[0].includes(".json"));
            assert(JSON.parse(fs.writeFile.lastCall.args[1])[0][1].test);
            res();
          }, 100);
        });
      });
  });

  it("trims old entries to maintain max queue size", ()=>{
    nativeTimeout = setTimeout;
    clock = lolex.install();

    bqController = require("../../bq-controller.js")
    ("test-side-events", "Test_Events", ".test-failed-log-entries.json", __dirname);
    bqClient = bqController.getBQClient();
    bqController.init();

    simple.mock(bqClient, "insert").rejectWith();

    let insertCount = bqController.maxQueue() * 2;

    while (insertCount--) {
      bqController.log("testTable", {test:"test"}, new Date()).catch(()=>{});
      clock.tick("01");
      clock.runToLast();
    }

    clock.uninstall();

    return new Promise((res, rej)=>{
      setTimeout(()=>{
        let pendingEntryKeys = Object.keys(bqController.pendingEntries());

        assert.equal(bqClient.insert.callCount, bqController.maxQueue() * 2);
        assert.equal(pendingEntryKeys.length, bqController.maxQueue());

        assert(["1000", "2000", "3000"].every((earlierTime)=>{
          return !pendingEntryKeys.includes(earlierTime);
        }));
        assert(["96000", "97000", "98000"].every((laterTime)=>{
          return pendingEntryKeys.includes(laterTime);
        }));

        res();
      }, 100);
    });
  });
});
