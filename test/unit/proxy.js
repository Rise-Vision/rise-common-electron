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
    proxySetup.proxyFields = {};
  });

  afterEach("clean mocks", ()=>{
    simpleMock.restore();
  });

  it("sets new endpoint from an object with hostname and port", ()=>{
    proxy.setEndpoint({hostname: "127.0.0.1", port: "8888"});
    assert.equal(proxySetup.proxyFields.hostname, "127.0.0.1");
  });

  it("includes an auth value if endpoint is set with username and password", ()=>{
    let testConfig = {username: "user", password: "pass", hostname: "192.168.0.1", port: 1234};
    proxy.setEndpoint(testConfig);
    console.log(proxySetup.proxyFields);
    assert.ok(Object.keys(proxySetup.proxyFields).every((key)=>{
      return proxySetup.proxyFields[key] === testConfig[key];
    }));
  });

  it("does not set the new endpoint", ()=>{
    proxy.setEndpoint();
    assert.equal(proxySetup.proxyFields.href, "");
  });
});
