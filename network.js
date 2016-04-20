var platform = require("./platform.js"),
dns = require("dns"),
fetch = require("node-fetch"),
http = require("http"),
httpProxyAgent = require("http-proxy-agent"),
httpsProxyAgent = require("https-proxy-agent"),
net=require('net'),
proxy = require("./proxy.js"),
fetchOptions = {},
javaProxyArgs = [],
url = require("url"),
path = require("path"),
fs = require("fs"),
downloadStats = {},
observers = [],
maxRetries = 10;

const downloadTimeout = 1000 * 60 * 20;

proxy.observe(setNodeHttpAgent);
function setNodeHttpAgent(fields) {
  log.debug("Setting proxy to " + fields.href);
  if (!fields.href) {return (fetchOptions = {});}
  fetchOptions.httpAgent = new httpProxyAgent(fields.href);
  fetchOptions.httpsAgent = new httpsProxyAgent(fields.href);
}


proxy.observe(setJavaProxyArgs);
function setJavaProxyArgs(fields) {
  if (!fields.hostname || !fields.port) {return (javaProxyArgs = []);}
  javaProxyArgs = [
    `-Dhttp.proxyHost=${fields.hostname}`,
    `-Dhttp.proxyPort=${fields.port}`,
    `-Dhttps.proxyHost=${fields.hostname}`,
    `-Dhttps.proxyPort=${fields.port}`
  ];
}

module.exports = {
  httpFetch(dest, opts) {
    if (!opts) {opts = fetchOptions;}
    if (!opts.agent && fetchOptions.httpAgent) {
      opts.agent = dest.indexOf("https:") > -1 ? fetchOptions.httpsAgent : fetchOptions.httpAgent;
    }

    return module.exports.callFetch(dest, opts);
  },
  getJavaProxyArgs() {
    return javaProxyArgs;
  },
  callFetch(dest, opts) {
    return fetch(dest, opts);
  },
  downloadFile(originalUrl) {
    var resolve, reject,
    savePath = path.join(platform.getTempDir(), url.parse(originalUrl).pathname.split("/").pop());

    downloadStats[originalUrl] = {tries: 0, bytesExpected: 0, bytesReceived: 0};

    return new Promise((res, rej)=>{
      resolve = res;
      reject = rej;

      setTimeout(()=>{
        reject({ message: "Request timed out", error: originalUrl });
      }, downloadTimeout);

      tryDownload(originalUrl);
    });

    function tryDownload(downloadUrl) {
      var file = fs.createWriteStream(savePath);

      downloadStats[originalUrl].tries += 1;

      file.on("error", (err)=>{
        reject({ message: "Error creating temporary download file", error: err });
      });

      log.debug("Downloading " + originalUrl + " try " + downloadStats[originalUrl].tries);

      var req = http.get(downloadUrl, (res)=>{
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
        socket.setTimeout(9000);
        socket.on("timeout", function() {
          if(!downloadStats[originalUrl].bytesReceived) {
            req.abort();
            if (downloadStats[originalUrl].tries === maxRetries) {
              reject({ message: "Request timed out", error: originalUrl });
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
      var s = net.createConnection(80, "www.google.com", ()=>{
        res(s.localAddress);
        s.destroy();
      });
      s.on("error", ()=>res(null));
      s.setTimeout(5000, ()=>{
        s.destroy();
        res(null);
      });
    });
  },

  registerObserver(fn) {
    observers.push(fn);
  },
  isOnline() {
    return new Promise((res)=>{
      dns.lookup('google.com',function(err) {
        if (err && err.code == "ENOTFOUND") {
          log.external("not online", require("util").inspect(err));
          res(false);
        } else {
          res(true);
        }
      });
    });
  }
};
