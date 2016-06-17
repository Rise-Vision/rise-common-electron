var urlParse = require("url").parse,
platform = require("./platform.js"),
observers = [],
path = require("path"),
pacScriptPath = path.join(platform.getInstallDir(), "proxy-pac.js"),
fs = require("fs"),
config = {};

function reset() {
  config = urlParse("");
  config.username = "";
  config.password = "";
  observers.forEach((fn)=>{fn(config);});
}

module.exports = {
  setEndpoint(configObj) {
    if (!configObj) {return reset();}

    if (typeof configObj === "string") {
      configObj = urlParse(configObj);
    }

    if (configObj.username) {
      configObj.auth = `${configObj.username}`;
      if (configObj.password) {
        configObj.auth += `:${configObj.password}`;
      }
    } else {
      if (configObj.auth) {
        let [user, ...pass] = configObj.auth.split(":");
        configObj.username = user;
        configObj.password = pass.join(":");
      }
    }

    if (!configObj.href) {
      let authString = configObj.auth,
      port = configObj.port;
      
      if (authString) {authString += "@"}
      if (port) {port = ":" + port}

      configObj.href = `http://${authString || ""}${configObj.hostname || ""}${port || ""}`
    }

    log.debug("proxy config: " + JSON.stringify(configObj));
    config = Object.assign({}, configObj);
    module.exports.setPac(config);
    observers.forEach((fn)=>{fn(config);});
  },
  observe(cb) {
    observers.push(cb);
  },
  pacScriptURL() {
    return "file://" + pacScriptPath;
  },
  configuration() {
    return config;
  },
  setPac(configuration) {
    let templatePath = path.join(__dirname, "proxy-pac-template.js"),
    pacTemplate = platform.readTextFileSync(templatePath, {inASAR: true}),
    pacText = pacTemplate.replace("HOSTNAME", configuration.hostname)
              .replace("PORT", configuration.port);
    platform.writeTextFileSync(pacScriptPath, pacText);
  }
};
