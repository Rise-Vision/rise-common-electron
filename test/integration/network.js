var assert = require("assert"),
network = require("../../network.js"),
logger = require("../../logger.js"),
simple = require("simple-mock"),
platform = require("../../platform.js"),
http = require("http"),
path = require("path"),
url = require("url"),
express = require("express"),
fs = require("fs");

global.log = logger();

describe("Network", function() {
  var fileName = "test-file.txt",
  filePath = path.resolve(__dirname, fileName);

  this.timeout(9000);

  before("setup servers", ()=>{
    return startServer().then(startRedirector);
  });

  beforeEach("restore mocks", ()=>{
    simple.restore();
  });

  it("exists", ()=>{
    assert.ok(network);
  });

  it("tries several downloads on failure", ()=>{
    var badPort = "9875";

    simple.mock(platform, "getTempDir").returnWith(__dirname);
    simple.mock(global.log, "debug");

    return network.downloadFile(`http://localhost:${badPort}/${fileName}`)
    .then(()=>{return Promise.reject();})
    .catch(()=>{
      assert.ok(log.debug.callCount > 4);
    });
  });

  it("downloads a file", ()=>{
    var mainPort = "9876";

    simple.mock(platform, "getTempDir").returnWith(__dirname);

    try {fs.unlinkSync(filePath); } catch(err) {}
    assert.throws(()=>{fs.statSync(filePath);}, "test file already exists");

    return network.downloadFile(`http://localhost:${mainPort}/${fileName}`)
    .then(()=>{
      return assert.equal(fs.statSync(filePath).size, 5);
    });
  });

  it("downloads a file with redirects", ()=>{
    var redirectorPort = "9877";

    simple.mock(platform, "getTempDir").returnWith(__dirname);

    try {fs.unlinkSync(filePath); } catch(err) {}
    assert.throws(()=>{fs.statSync(filePath);}, "test file already exists");

    return network.downloadFile(`http://localhost:${redirectorPort}/${fileName}`)
    .then(()=>{
      return assert.equal(fs.statSync(filePath).size, 5);
    });
  });

  it("gets local ip address", ()=>{
    return network.getLocalIP().then((ip)=>{
      assert.ok(ip);
    });
  });

  function startServer() {
    var server = express();
    server.use(express.static(path.resolve(__dirname, "test-files")));

    return new Promise((res)=>{
      server.listen(9876, ()=>{res();});
    });
  }

  function startRedirector() {
    var mainPort = "9876";

    return new Promise((res)=>{
      http.createServer((req, resp)=>{
        var redirectTo = `http://localhost:${mainPort}${url.parse(req.url).pathname}`;
        resp.writeHead(302, {"Location": redirectTo});
        resp.end("");
      }).listen(9877, ()=>{res();});
    });
  }
});
