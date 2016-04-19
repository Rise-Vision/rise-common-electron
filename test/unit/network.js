var platform = require("../../platform.js"),
network = require("../../network.js"),
proxy = require("../../proxy.js"),
fetch = require("node-fetch"),
http = require("http"),
urlParse = require("url").parse,
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

  it("handles proxy changes", ()=>{
    var resultingProxySetup,
    expectedProxyHref = "http://127.0.0.1:8888/";

    proxy.setEndpoint({address: "127.0.0.1", port: "8888"});
    mock(network, "callFetch").resolveWith({});

    return network.httpFetch("http://testdest.com")
    .then(()=>{
      resultingProxySetup = network.callFetch.calls[0].args[1].agent.proxy;
      assert.equal(resultingProxySetup.href, expectedProxyHref);
    });
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

  it("gets local ip address", ()=>{
    return network.getLocalIP().then((ip)=>{
      assert.ok(ip);
    });
  });
});
