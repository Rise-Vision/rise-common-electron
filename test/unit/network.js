var platform = require("../../platform.js"),
os = require("os"),
network = require("../../network.js"),
dns = require("dns"),
got = require("got"),
path = require("path"),
fs = require("fs"),
assert = require("assert"),
simpleMock = require("simple-mock"),
mock = require("simple-mock").mock,

gotSucess = {
  on(name, cb){
    if (name === "error") {
      return { pipe(file){ file.end();}}
    }
  },
};

describe("network", ()=>{
  beforeEach("setup mocks", ()=>{
    mock(platform, "getTempDir").returnWith("test");
    mock(platform, "writeTextFile").resolveWith();

  });

  afterEach("clean mocks", ()=>{
    simpleMock.restore();
    network.setNodeAgents();
  });

  it("downloads a file using the given url", ()=>{
    mock(got, "stream").returnWith(gotSucess);

    return network.downloadFile("http://install-versions.risevision.com/RiseCache.zip", path.join("providedTestPath", "RiseCache.zip"))
      .then((localPath)=>{
        assert.equal(got.stream.lastCall.args[0], "http://install-versions.risevision.com/RiseCache.zip");
        assert.equal(got.stream.lastCall.args[1].agent.http, null);
        assert.equal(got.stream.lastCall.args[1].retry.limit, 4);
        assert.equal(localPath, path.join("providedTestPath", "RiseCache.zip"));
      });
  });

  it("downloads a file using the given url using an HTTP proxy", ()=>{
    var agentHTTP = { id: 1 }, agentHTTPS = { id: 2};

    mock(got, "stream").returnWith(gotSucess);

    network.setNodeAgents(agentHTTP, agentHTTPS);

    return network.downloadFile("http://install-versions.risevision.com/RiseCache.zip", path.join("providedTestPath", "RiseCache.zip"))
      .then(()=>{
        assert.equal(got.stream.lastCall.args[1].agent.http, agentHTTP);
      });
  });

  it("downloads a file using the given url using an HTTPS proxy", ()=>{
    var agentHTTP = { id: 1 }, agentHTTPS = { id: 2};

    mock(got, "stream").returnWith(gotSucess);

    network.setNodeAgents(agentHTTP, agentHTTPS);

    return network.downloadFile("https://install-versions.risevision.com/RiseCache.zip", path.join("providedTestPath", "RiseCache.zip"))
    .then(()=>{
      assert.equal(got.stream.lastCall.args[1].agent.https, agentHTTPS);
    });
  });

  it("downloads a file using the given url without providing a save path", ()=>{
    mock(got, "stream").returnWith(gotSucess);

    return network.downloadFile("http://install-versions.risevision.com/RiseCache.zip")
    .then((localPath)=>{
      assert.equal(localPath, path.join("test", "RiseCache.zip"));
    });
  });

  it("fails to download a file because it was not found", ()=>{
    mock(got, "stream").callbackWith({
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
    mock(got, "stream").callbackWith({
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

  it("gets first IPv4 external MAC address", ()=>{
    mock(os, "networkInterfaces").returnWith({
      lo: [
        {
          address: '127.0.0.1',
          netmask: '255.0.0.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: true
        },
        {
          address: '::1',
          netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
          family: 'IPv6',
          mac: '00:00:00:00:00:00',
          internal: true
        }
      ],
      eth0: [
        {
          address: '192.168.1.108',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '01:02:03:0a:0b:0c',
          internal: false
        },
        {
          address: 'fe80::a00:27ff:fe4e:66a1',
          netmask: 'ffff:ffff:ffff:ffff::',
          family: 'IPv6',
          mac: '01:02:03:0a:0b:0c',
          internal: false
        },
        {
          address: '192.168.1.108',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '99:02:03:0a:0b:0c',
          internal: false
        }
      ]
    });

    assert.equal(network.getMAC(), '01:02:03:0a:0b:0c');
  });

  it("returns null if no external address found", ()=>{
    mock(os, "networkInterfaces").returnWith({
      lo: [
        {
          address: '127.0.0.1',
          netmask: '255.0.0.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: true
        },
      ]
    });

    assert.equal(network.getMAC(), null);
  });

  it("returns null if no IPv4 address found", ()=>{
    mock(os, "networkInterfaces").returnWith({
      lo: [
        {
          address: '127.0.0.1',
          netmask: '255.0.0.0',
          family: 'IPv6',
          mac: '00:00:00:00:00:00',
          internal: false
        },
      ]
    });

    assert.equal(network.getMAC(), null);
  });

  it("returns null if no MAC property", ()=>{
    mock(os, "networkInterfaces").returnWith({
      lo: [
        {
          address: '127.0.0.1',
          netmask: '255.0.0.0',
          family: 'IPv6',
          internal: false
        },
      ]
    });

    assert.equal(network.getMAC(), null);
  });

  it("returns null if dependency throws", ()=>{
    mock(os, "networkInterfaces").throwWith(Error("test error"));
    assert.equal(network.getMAC(), null);
  });
});
