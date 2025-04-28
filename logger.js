var fs = require("fs"),
path = require("path"),
debugging = process.argv.slice(1).join(" ").indexOf("debug") > -1,
debug = (debugging ? console.log.bind(console) : ()=>{});

module.exports = (externalLogger, logFolder, moduleName = "unknownmodule")=> {
  var uiWindow;

  function validUiWindow() {
    return uiWindow && !uiWindow.isDestroyed();
  }

  function padLeft(number) {
    return (String(number).length === 1 ? "0" : "") + number;
  }

  function getLogDatetime() {
    var d = new Date();

    return [ d.getFullYear(),
             padLeft(d.getMonth() + 1),
             padLeft(d.getDate())].join("/") + " " +
           [ padLeft(d.getHours()),
             padLeft(d.getMinutes()),
             padLeft(d.getSeconds())].join(":");
  }

  function fileExists(path) {
    try {
      fs.lstatSync(path);
      return true;
    }
    catch(e) {
      return false;
    }
  }

  function resetLogFiles(maxSize=0) {
    if (!logFolder) {return;}
    try {
      [`${moduleName}-events.log`,`${moduleName}-detail.log`]
      .forEach((str)=>{
        let filePath = path.join(logFolder, str);
        if (fs.statSync(filePath).size < maxSize) {return;}
        fs.truncate(filePath, err=>debug("could not truncate", filePath));
      });
    } catch(e) {debug(e.stack);}
  }

  function appendToLog(detail, userFriendlyMessage) {
    // Do not log to files if logFolder is not defined
    if(!logFolder) return;

    try {
      var eventsLog = path.join(logFolder, `${moduleName}-events.log`);
      var detailsLog = path.join(logFolder, `${moduleName}-detail.log`);

      var detailsVal = "";
      var userFriendlyMessageVal = userFriendlyMessage || "";

      // backwards compatible for installer and player modules
      if(typeof detail === "string") {
        detailsVal = detail;
      }
      else if(detail) {
        const eventDetails = detail.event_details || detail.eventDetails || "";
        const debugInfo = detail.debug_info || detail.debugInfo || "";
        const debugInfoVal = (typeof debugInfo === "string") ? debugInfo : JSON.stringify(debugInfo);

        if(!userFriendlyMessageVal) {
          userFriendlyMessageVal = eventDetails || "";
          detailsVal = debugInfoVal;
        } else {
          detailsVal = `${eventDetails}\n${debugInfoVal}`;
        }
      }

      if(!fileExists(logFolder)) {
        fs.mkdirSync(logFolder);
      }

      if(userFriendlyMessageVal) {
        fs.appendFileSync(eventsLog, getLogDatetime() + " - " + userFriendlyMessageVal + "\n");
      }

      if(detailsVal) {
        if(userFriendlyMessageVal) {
          fs.appendFileSync(detailsLog, getLogDatetime() + " - " + userFriendlyMessageVal + "\n");
        }
        else {
          fs.appendFileSync(detailsLog, getLogDatetime() + "\n");
        }

        if (typeof detailsVal === "object") { detailsVal = JSON.stringify(detailsVal); }
        fs.appendFileSync(detailsLog, detailsVal + "\n");
      }
    }
    catch (err) {
      debug("Error writing to log file", err);
    }
  }

  return {
    debug,
    error(detail, userFriendlyMessage, table) {
      debug("ERROR: " + detail);
      appendToLog(detail, userFriendlyMessage);

      if (externalLogger) {externalLogger.log("error", detail, table, moduleName);}
      if (validUiWindow()) {uiWindow.send("errorMessage", userFriendlyMessage || detail);}
    },
    warning(detail, table) {
      debug("WARNING: " + detail);
      appendToLog(detail);

      if (externalLogger) {externalLogger.log("warning", detail, table, moduleName);}
    },
    all(evt, detail, pct, table) {
      debug(evt, detail ? detail : "");
      appendToLog(detail, evt);

      if (validUiWindow() && !pct) {uiWindow.send("message", detail ? evt + ": " + detail : evt);}
      if (validUiWindow() && pct) {uiWindow.send("set-progress", {msg: evt, pct});}
      if (externalLogger) {externalLogger.log(evt, detail, table, moduleName);}
    },
    setUIWindow(win) {
      uiWindow = win;
    },
    setDisplaySettings(settings) {
      if (externalLogger) {externalLogger.setDisplaySettings(settings);}
    },
    external(evt, detail, table) {
      appendToLog(detail, evt);

      if (externalLogger) {externalLogger.log(evt, detail, table, moduleName);}
    },
    file(detail, userFriendlyMessage) {
      appendToLog(detail, userFriendlyMessage);
    },
    progress(msg, pct) {
      if (validUiWindow()) {uiWindow.send("set-progress", {msg, pct});}
    },
    resetLogFiles
  };
};
