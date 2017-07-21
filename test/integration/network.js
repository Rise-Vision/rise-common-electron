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
var testServer, testRedirectServer;

global.log = logger();

describe("Network", function() {
  var fileName = "test-file.txt",
  filePath = path.resolve(__dirname, fileName);

  this.timeout(60000);

  before("setup servers", ()=>{
    return startServer().then(startRedirector);
  });

  after("close server", ()=>{
    testServer.close();
    testRedirectServer.close();
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
    .then((error)=>{console.log(error)})
    .catch((error)=>{
      assert.equal(error.message, "Response error downloading file connect ECONNREFUSED 127.0.0.1:9875");
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

  it("gets json from httpFecth", ()=>{
    return network.httpFetch("https://rvaserver2.appspot.com/_ah/api/content/v0/display?id=AKQ2K8D9D9VE")
      .then((resp)=>{
        return resp.json().then(content => assert.ok(content.item.companyId));
      });
  });

  it("gets text from httpFecth", ()=>{
    return network.httpFetch("https://rvaserver2.appspot.com/_ah/api/content/v0/display?id=UNB8FAXR598G")
      .then((resp)=>{
        return resp.text().then(content => assert.ok(content));
      });
  });

  it("gets invalid json message", ()=>{
    return network.httpFetch("www.google.com.br")
      .then((resp)=>{
        return resp.json();
      }).catch((error)=>{
         assert.equal(error.message, "invalid json response body at www.google.com.br reason: Unexpected token < in JSON at position 0");
      });
  });

  function startServer() {
    var server = express();
    server.use(express.static(path.resolve(__dirname, "test-files")));

    return new Promise((res)=>{
      testServer = server.listen(9876, ()=>{res();});
    });
  }

  function startRedirector() {
    var mainPort = "9876";

    return new Promise((res)=>{
      testRedirectServer = http.createServer((req, resp)=>{
        var redirectTo = `http://localhost:${mainPort}${url.parse(req.url).pathname}`;
        resp.writeHead(302, {"Location": redirectTo});
        resp.end("");
      }).listen(9877, ()=>{res();});
    });
  }
});
