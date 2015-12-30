var urlParse = require("url").parse,
observers = [];

function reset() {
  observers.forEach((fn)=>{fn(urlParse(""));});
}

module.exports = {
  setEndpoint(configObj) {
    var newFields;
    if (typeof configObj === "string") {
      configObj = urlParse(configObj);
      configObj.address = configObj.hostname;
    }

    if (!configObj || !configObj.address) {return reset();}
    if (configObj.address.substring(0,4) !== "http") {
      configObj.address = "http://" + configObj.address;
    }

    log.debug("proxy", configObj);
    newFields = urlParse(configObj.address + ":" + (configObj.port ? configObj.port : ""));
    observers.forEach((fn)=>{fn(newFields);});
  },
  observe(cb) {
    observers.push(cb);
  }
};
