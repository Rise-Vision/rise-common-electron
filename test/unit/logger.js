var log,
uiWindow,
externalLogger,
fs = require("fs"),
path = require("path"),
assert = require("assert"),
simpleMock = require("simple-mock"),
mock = require("simple-mock").mock;

describe("Logger", ()=>{
  afterEach("clean mocks", ()=>{
    simpleMock.restore();
  });

  it("resets log files if they're large and no max size was specified", ()=>{
    simpleMock.mock(fs, "statSync").returnWith({size: Infinity});
    simpleMock.mock(fs, "truncate").returnWith();
    require("../../logger.js")({}, "installDir", "installer").resetLogFiles();
    assert(fs.truncate.calls[0].args[0].includes(path.join("installDir", "installer-events")));
    assert(fs.truncate.calls[1].args[0].includes(path.join("installDir", "installer-detail")));
  });

  it("doesn't reset log files if they're smaller than max allowable", ()=>{
    simpleMock.mock(fs, "statSync").returnWith({size: 50}).returnWith({size: 75});
    simpleMock.mock(fs, "truncate").returnWith();
    require("../../logger.js")({}, "installDir", "installer").resetLogFiles(100);
    assert.equal(fs.truncate.callCount, 0);
  });

  it("resets log files if they're larger than max allowable", ()=>{
    simpleMock.mock(fs, "statSync").returnWith({size: 120}).returnWith({size: 75});
    simpleMock.mock(fs, "truncate").returnWith();
    require("../../logger.js")({}, "installDir", "installer").resetLogFiles(100);
    assert.equal(fs.truncate.callCount, 1);
  })

  it("handles failed attempt to reset log files", ()=>{
    simpleMock.mock(fs, "statSync").returnWith({size: Infinity});
    simpleMock.mock(fs, "truncate").throwWith(new Error("test-truncate-failure"));
    require("../../logger.js")({}, "installDir", "installer").resetLogFiles();
    assert(fs.truncate.calls[0].args[0].includes(path.join("installDir", "installer-events")));
  });

  it("doesn't reset log files if they don't exist", ()=>{
    simpleMock.mock(fs, "statSync").throwWith("ENOENT test");
    simpleMock.mock(fs, "truncate").returnWith();
    require("../../logger.js")({}, "installDir", "installer").resetLogFiles();
    assert(!fs.truncate.callCount);
  });

  it("doesn't throw if logging to file with no detail", ()=>{
    simpleMock.mock(fs, "statSync").throwWith("ENOENT test");
    simpleMock.mock(fs, "truncate").returnWith();
    simpleMock.mock(fs, "mkdirSync").returnWith();
    simpleMock.mock(fs, "appendFileSync").returnWith();
    require("../../logger.js")({}, "installDir").file(null, "user-message");
    assert.equal(fs.appendFileSync.callCount, 1);
    assert(fs.appendFileSync.lastCall.args[1].includes("user-message"));
  });

  it("logs detail if included", ()=>{
    simpleMock.mock(fs, "statSync").throwWith("ENOENT test");
    simpleMock.mock(fs, "truncate").returnWith();
    simpleMock.mock(fs, "mkdirSync").returnWith();
    simpleMock.mock(fs, "appendFileSync").returnWith();
    require("../../logger.js")({}, "installDir").file("some-detail", "user-message");
    assert.equal(fs.appendFileSync.callCount, 3);
    assert(fs.appendFileSync.lastCall.args[1].includes("some-detail"));
  });
});

describe("launcher", ()=>{
  beforeEach("setup mocks", ()=>{
    uiWindow = {};
    externalLogger = {};

    mock(uiWindow, "send").returnWith();
    mock(externalLogger, "log").returnWith();
    mock(fs, "appendFileSync").returnWith();
    mock(fs, "mkdirSync").returnWith();

    log = require("../../logger.js")(externalLogger, "installDir");
  });

  afterEach("clean mocks", ()=>{
    simpleMock.restore();
  });

  it("properly calls registered loggers on 'error' method", ()=>{
    mock(uiWindow, "isDestroyed").returnWith(false);
    log.setUIWindow(uiWindow);
    log.error("test");
    assert(uiWindow.send.called);
    assert(externalLogger.log.called);
  });

  it("does not call uiWindow.send if window destroyed", ()=>{
    mock(uiWindow, "isDestroyed").returnWith(true);
    log.setUIWindow(uiWindow);
    log.error("test");
    assert(!uiWindow.send.called);
    assert(externalLogger.log.called);
  });

  it("properly calls registered loggers on 'all' method", ()=>{
    mock(uiWindow, "isDestroyed").returnWith(false);
    log.setUIWindow(uiWindow);
    log.all("test");
    assert(uiWindow.send.called);
    assert(externalLogger.log.called);
  });

  it("only calls external logger on 'external' method", ()=>{
    log.setUIWindow(uiWindow);
    log.external("test");
    assert(!uiWindow.send.called);
    assert(externalLogger.log.called);
  });

  it("sets external logger's display settings", ()=>{
    mock(externalLogger, "setDisplaySettings").returnWith();
    log.setDisplaySettings("test");
    assert(externalLogger.setDisplaySettings.called);
  });
});
