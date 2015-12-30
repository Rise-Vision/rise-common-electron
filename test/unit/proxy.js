var proxy = require("../../proxy.js"),
proxySetup = {},
assert = require("assert"),
simpleMock = require("simple-mock"),
platform = require("../../platform.js"),
mock = require("simple-mock").mock;

proxy.observe((proxyFields)=>{proxySetup.proxyFields = proxyFields;});

describe("proxy", ()=>{
  beforeEach("setup mocks", ()=>{
    mock(platform, "writeTextFile").resolveWith();
  });

  afterEach("clean mocks", ()=>{
    simpleMock.restore();
  });

  it("sets new endpoint from an object with address and port", ()=>{
    proxy.setEndpoint({address: "127.0.0.1", port: "8888"});
    assert.equal(proxySetup.proxyFields.href, "http://127.0.0.1:8888/");
  });

  it("sets new endpoint from href string as in display settings doc", ()=>{
    proxy.setEndpoint("http://192.168.0.0:80");
    assert.equal(proxySetup.proxyFields.href, "http://192.168.0.0:80/");
  });

  it("does not set the new endpoint", ()=>{
    proxy.setEndpoint();
    assert.equal(proxySetup.proxyFields.href, "");
  });
});
