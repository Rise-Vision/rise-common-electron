var platform = require("../../platform.js"),
network = require("../../network.js"),
dns = require("dns"),
http = require("http"),
path = require("path"),
fs = require("fs"),
assert = require("assert"),
simpleMock = require("simple-mock"),
mock = require("simple-mock").mock;

describe("network", ()=>{
  beforeEach("setup mocks", ()=>{
    mock(platform, "getTempDir").returnWith("test");
    mock(platform, "writeTextFile").resolveWith();
    mock(fs, "createWriteStream").returnWith({
      write() {},
      end() {},
      on() {}
    });
  });

  afterEach("clean mocks", ()=>{
    simpleMock.restore();
  });

  it("downloads a file using the given url", ()=>{
    mock(http, "get").callbackWith({
      statusCode: 200,
      headers: {"content-length": 0},
      on(name, cb) {
        if(name === "end") { cb(); }
        if(name === "data") { cb(""); }
        if(name === "error") { cb("err"); }
      }
    });

    return network.downloadFile("http://install-versions.risevision.com/RiseCache.zip", path.join("providedTestPath", "RiseCache.zip"))
    .then((localPath)=>{
      assert.equal(localPath, path.join("providedTestPath", "RiseCache.zip"));
    });
  });

  it("downloads a file using the given url without providing a save path", ()=>{
    mock(http, "get").callbackWith({
      statusCode: 200,
      headers: {"content-length": 0},
      on(name, cb) {
        if(name === "end") { cb(); }
        if(name === "data") { cb(""); }
        if(name === "error") { cb("err"); }
      }
    });

    return network.downloadFile("http://install-versions.risevision.com/RiseCache.zip")
    .then((localPath)=>{
      assert.equal(localPath, path.join("test", "RiseCache.zip"));
    });
  });

  it("fails to download a file because it was not found", ()=>{
    mock(http, "get").callbackWith({
      statusCode: 404,
      on(name, cb) {
        if(name === "end") { cb(); }
      }
    });

    return network.downloadFile("http://install-versions.risevision.com/RiseCache.zip")
    .catch((err)=>{
      assert(err.message);
    });
  });

  it("fails to download a file", ()=>{
    mock(http, "get").callbackWith({
      statusCode: 500,
      on(name, cb) {
        if(name === "end") { cb(); }
      }
    });

    return network.downloadFile("http://install-versions.risevision.com/RiseCache.zip")
    .catch((err)=>{
      assert(err.message);
    });
  });

  it("passes online check", ()=>{
    mock(dns, "lookup").callbackWith(null);

    return network.isOnline()
    .then((result)=>{
      assert.equal(dns.lookup.callCount, 1);
      assert.equal(result, true);
    });
  });

  it("eventually passes online check", ()=>{
    mock(dns, "lookup")
    .callbackWith({code: "ENOTFOUND"})
    .callbackWith({});

    return network.isOnline()
    .then((result)=>{
      assert.equal(dns.lookup.callCount, 2);
      assert.equal(result, true);
    });
  });

  it("eventually fails online check", ()=>{
    mock(dns, "lookup").callbackWith({code: "ENOTFOUND"});

    return network.isOnline()
    .then((result)=>{
      assert.equal(dns.lookup.callCount, 3);
      assert.equal(result, false);
    });
  });
});
