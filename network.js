var platform = require("./platform.js"),
fetch = require("node-fetch"),
http = require("http"),
httpProxyAgent = require("http-proxy-agent"),
httpsProxyAgent = require("https-proxy-agent"),
proxy = require("./proxy.js"),
fetchOptions = {},
javaProxyArgs = [],
urlParse = require("url").parse,
path = require("path"),
fs = require("fs"),
downloadStats = {},
observers = [],
maxRetries = 10;

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
  downloadFile(url) {
    downloadStats[url] = {tries: 0, bytesExpected: 0, bytesReceived: 0};

    function tryDownload(resolve, reject) {
      var tempPath = path.join(platform.getTempDir(), urlParse(url).pathname.split(path.sep).pop()),
      file = fs.createWriteStream(tempPath);

      downloadStats[url].tries += 1;

      file.on("error", (err)=>{
        reject({ message: "Error creating temporary download file", error: err });
      });

      log.debug("Downloading " + url + " try " + downloadStats[url].tries);

      var req = http.get(url, (res)=>{
        if(res.statusCode === 404) {
          reject({ message: "File not found", error: res.statusCode });
        }
        else if(res.statusCode < 200 || res.statusCode >= 300) {
          reject({ message: "Error downloading file", error: res.statusCode });
        }

        downloadStats[url].bytesExpected = Number(res.headers["content-length"]);
        res.on("data", (data)=>{
          downloadStats[url].bytesReceived += data.length;
          file.write(data);
          observers.forEach((observer)=>{observer(downloadStats);});
        });
        res.on("end", ()=>{
          file.end();
          resolve(tempPath);
        });
        res.on("error", function(e) {
          file.end();
          if (downloadStats[url].tries === maxRetries) {
            reject({ message: "Response error downloading file" + e.message, error: e });
          } else {
            tryDownload(resolve, reject);
          }
        });
      });

      req.on("socket", function (socket) {
        socket.setTimeout(2000);  
        socket.on("timeout", function() {
          if(!downloadStats[url].bytesReceived) {
            req.abort();
            if (downloadStats[url].tries === maxRetries) {
              reject({ message: "Request timed out", error: url });
            } else {
              tryDownload(resolve, reject);
            }
          }
        });
      });

      req.on("error", function(e) {
        file.end();
        if (downloadStats[url].tries === maxRetries) {
          reject({ message: "Request error downloading file" + e.message, error: e });
        } else {
          tryDownload(resolve, reject);
        }
      });
    }

    return new Promise(tryDownload);
  },
  registerObserver(fn) {
    observers.push(fn);
  }
};
