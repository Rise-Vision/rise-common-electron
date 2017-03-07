var platform = require("./platform.js"),
dns = require("dns"),
fetch = require("node-fetch"),
http = require("http"),
proxy = require("./proxy.js"),
fetchAgents = {},
javaProxyArgs = [],
url = require("url"),
path = require("path"),
fs = require("fs"),
os = require("os"),
downloadStats = {},
observers = [],
proxyFields = null,
proxyObservers = [],
maxRetries = 10;

const downloadTimeout = 1000 * 60 * 60 * 12;

proxy.observe((fields)=>{
  proxyFields = fields;
  setJavaProxyArgs(fields);

  proxyObservers.forEach((observer)=>{
    observer(fields);
  });
});

function setJavaProxyArgs(fields) {
  if (!fields.hostname || !fields.port) {
    javaProxyArgs = [];
  }
  else {
    javaProxyArgs = [
      `-Dhttp.proxyHost=${fields.hostname}`,
      `-Dhttp.proxyPort=${fields.port}`,
      `-Dhttps.proxyHost=${fields.hostname}`,
      `-Dhttps.proxyPort=${fields.port}`,
      `-Dhttp.nonProxyHosts="10.*|192.168.*|0.0.*|localhost|127.*|[::1]"`
    ];
  }
}

function setRequestAgent(dest, opts) {
  let agent = dest.indexOf("https:") > -1 ? fetchAgents.httpsAgent : fetchAgents.httpAgent;

  return Object.assign({}, {agent}, opts);
}

module.exports = {
  setJavaProxyArgs,
  setNodeAgents(httpAgent, httpsAgent) {
    fetchAgents = {
      httpAgent,
      httpsAgent
    };
  },
  httpFetch(dest, opts) {
    return module.exports.callFetch(dest, setRequestAgent(dest, opts));
  },
  getProxyAgents() {
    return fetchAgents;
  },
  getJavaProxyArgs() {
    return javaProxyArgs;
  },
  callFetch(dest, opts) {
    return fetch(dest, opts);
  },
  downloadFile(originalUrl, savePath) {
    var resolve, reject;

    if(!savePath) {
      savePath = path.join(platform.getTempDir(), url.parse(originalUrl).pathname.split("/").pop());
    }

    downloadStats[originalUrl] = {tries: 0, bytesExpected: 0, bytesReceived: 0};

    return new Promise((res, rej)=>{
      resolve = res;
      reject = rej;

      setTimeout(()=>{
        reject({ message: "Request timed out because global limit was reached", error: originalUrl });
      }, downloadTimeout);

      tryDownload(originalUrl);
    });

    function tryDownload(downloadUrl) {
      var file = fs.createWriteStream(savePath);
      var opts = url.parse(downloadUrl);

      downloadStats[originalUrl].tries += 1;

      file.on("error", (err)=>{
        reject({ message: "Error creating temporary download file", error: err });
      });

      log.debug("Downloading " + originalUrl + " try " + downloadStats[originalUrl].tries);

      var req = http.get(setRequestAgent(downloadUrl, opts), (res)=>{
        if (isRedirect(res.statusCode)) {
          if (downloadStats[originalUrl].tries === maxRetries) {
            reject({message: "Too many download attempts"});
            return;
          }

          if (!res.headers.location) {
            reject({message: "Missing location header at " + originalUrl});
            return;
          }

          tryDownload(url.resolve(downloadUrl, res.headers.location));
          return;
        } else if(res.statusCode < 200 || res.statusCode >= 300) {
          reject({ message: "Error downloading file", error: res.statusCode });
          return;
        }

        downloadStats[originalUrl].bytesExpected = Number(res.headers["content-length"]);
        downloadStats[originalUrl].bytesReceived = 0;

        res.on("data", (data)=>{
          downloadStats[originalUrl].bytesReceived += data.length;
          file.write(data);
          observers.forEach((observer)=>{observer(downloadStats);});
        });
        res.on("end", ()=>{
          file.end();
          resolve(savePath);
        });
        res.on("error", function(e) {
          file.end();
          if (downloadStats[originalUrl].tries === maxRetries) {
            reject({ message: "Response error downloading file" + e.message, error: e });
          } else {
            tryDownload(downloadUrl);
          }
        });
      });

      req.on("socket", function (socket) {
        socket.setTimeout(30000);
        socket.on("timeout", function() {
          if(!downloadStats[originalUrl].bytesReceived) {
            req.abort();
            if (downloadStats[originalUrl].tries === maxRetries) {
              reject({ message: "Request timed out because of socket inactivity", error: originalUrl });
            } else {
              tryDownload(downloadUrl);
            }
          }
        });
      });

      req.on("error", function(e) {
        file.end();
        if (downloadStats[originalUrl].tries === maxRetries) {
          reject({ message: "Request error downloading file" + e.message, error: e });
        } else {
          tryDownload(downloadUrl);
        }
      });

      function isRedirect(code) {
        return code === 301 || code === 302 || code === 303 || code === 307 || code === 308;
      }
    }
  },
  getLocalIP() {
    return new Promise((res)=> {
      var addresses = [];

      try {
        var interfaces = os.networkInterfaces();
        for (var k in interfaces) {
          for (var k2 in interfaces[k]) {
            var address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
              addresses.push(address.address);
            }
          }
        }

        res(addresses.length === 0 ? null : addresses[0]);
      }
      catch (err) {
        res(null);
      }
    });
  },
  getMAC() {
    try {
      let interfaces = os.networkInterfaces();

      return Object.keys(interfaces)
      .reduce((addresses, key)=>addresses.concat(interfaces[key]), [])
      .filter(address=>!address.internal && address.family === "IPv4")[0].mac
    } catch(e) {
      log.all(e);
      return null;
    }
  },
  registerObserver(fn) {
    observers.push(fn);
  },
  registerProxyUpdatedObserver(fn) {
    proxyObservers.push(fn);
    if (proxyFields) {
      fn(proxyFields);
    }
  },
  isOnline(retryCount = 2) {
    return new Promise((res)=>{
      setTimeout(()=>{
        dns.lookup('google.com',function(err) {
          if (err && err.code == "ENOTFOUND") {
            log.external("not online", require("util").inspect(err));
            res(retryCount <= 0 ? false : module.exports.isOnline(retryCount - 1));
          } else {
            res(true);
          }
        });
      }, 500);
    });
  }
};
