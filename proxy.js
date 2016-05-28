var urlParse = require("url").parse,
platform = require("./platform.js"),
observers = [],
path = require("path"),
fs = require("fs"),
config = {};

function reset() {
  observers.forEach((fn)=>{fn(urlParse(""));});
}

module.exports = {
  setEndpoint(configObj) {
    if (!configObj) {return reset();}

    if (typeof configObj === "string") {
      configObj = urlParse(configObj);
    }

    if (configObj.username) {
      configObj.auth = `${configObj.username}:${configObj.password}`;
    } else {
      if (configObj.auth) {
        configObj.username = configObj.auth.split(":")[0];
        configObj.password = configObj.auth.split(":")[1];
      }
    }

    log.debug("proxy", configObj);
    config = Object.assign({}, configObj);
    module.exports.setPac(config);
    observers.forEach((fn)=>{fn(config);});
  },
  observe(cb) {
    observers.push(cb);
  },
  pacScriptURL() {
    return "file://" + path.join(platform.getInstallDir(), "proxy-pac.js");
  },
  configuration() {
    return config;
  },
  setPac(configuration) {
    let templatePath = path.join(__dirname, "proxy-pac-template.js"),
    pacTemplate = platform.readTextFileSync(templatePath, {encoding: "utf8"}),
    pacText = pacTemplate.replace("HOSTNAME", configuration.hostname)
              .replace("PORT", configuration.port);

    platform.writeTextFileSync(path.join(platform.getInstallDir(), "proxy-pac.js"), pacText);
  }
};
