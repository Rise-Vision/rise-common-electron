var platform = require("./platform.js"),
dns = require("dns"),
proxy = require("./proxy.js"),
fetchAgents = {},
javaProxyArgs = [],
url = require("url"),
path = require("path"),
fs = require("fs"),
os = require("os"),
got = require("got"),
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

  return Object.assign({agent}, opts);
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
    return new Promise((resolve, reject)=>{
      let proxyConfig = proxy.configuration();

      if(proxyConfig && proxyConfig.host) {
        opts = Object.assign({}, opts, {useElectronNet: false});
      }
      else if(!opts || !opts.hasOwnProperty('useElectronNet')) {
        // GOT 8.0 changed the default for useElectronNet, so if not provided we have to ensure to set it as in previous versions
        opts = Object.assign({}, opts, {useElectronNet: true});
      }

      got(dest, opts).then(response => {
        let text = () => {return Promise.resolve(response.body.toString())};
        let json = () => { try {
                            return Promise.resolve(JSON.parse(response.body.toString()));
                          } catch (err) {
                            return Promise.reject({message: `invalid json response body at ${dest} reason: ${err.message}`});
                          }
                        }
        resolve(Object.assign(response, {json: json, text: text}));
      }).catch(error => {
        reject(error);
      })
    });
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
      var withError = false;

      file.on("error", (err)=>{
        reject({ message: "Error creating temporary download file", error: err });
      });

      file.on("finish", ()=> {
        if (!withError) {
          resolve(savePath);
        }
      });

      log.debug(`Downloading${originalUrl}`);

      let moreOpts = {retries: 4, useElectronNet: true};
      let proxyConfig = proxy.configuration();

      if(proxyConfig && proxyConfig.host) {
        moreOpts = Object.assign(moreOpts, {useElectronNet: false});
      }

      got.stream(setRequestAgent(downloadUrl, opts),moreOpts).on("error", (e, body, resp) => {
        withError = true;
        file.end();
        reject({ message: "Response error downloading file " + e.message, error: e });
      }).pipe(file);
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
