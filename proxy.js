var urlParse = require("url").parse,
observers = [];

function reset() {
  observers.forEach((fn)=>{fn(urlParse(""));});
}

module.exports = {
  setEndpoint(configObj) {
    if (!configObj) {return reset();}

    if (typeof configObj === "string") {
      configObj = urlParse(configObj);
    }

    if (configObj.username) {configObj.auth = `${configObj.username}:${configObj.password}`}
    log.debug("proxy", configObj);
    observers.forEach((fn)=>{fn(configObj);});
  },
  observe(cb) {
    observers.push(cb);
  }
};
