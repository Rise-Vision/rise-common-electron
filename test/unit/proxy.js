var proxy = require("../../proxy.js"),
proxySetup = {},
assert = require("assert"),
url = require("url"),
simpleMock = require("simple-mock"),
platform = require("../../platform.js"),
path = require("path"),
fs = require("fs"),
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

  it("returns a url to the PAC file", ()=>{
    assert.ok(url.parse(proxy.pacScriptURL()).href);
  });

  it("provides configuration information", ()=>{
    proxy.setEndpoint({username: "test", hostname: "test"});
    assert.equal(proxy.configuration().hostname, "test")
  });

  it.only("creates a pac file from the template", ()=>{
    let pacFilePath = path.join(platform.getInstallDir(), "proxy-pac.js"); 
    proxy.setEndpoint({hostname: "test", port: 80});
    assert.ok(fs.readFileSync(pacFilePath, {encoding: "utf8"}).includes("PROXY test:80"));
  });
});
