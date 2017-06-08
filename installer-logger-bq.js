module.exports = (systemOS, systemArch, installerVersion, osDesc, installPath)=>{
  var PROJECT_NAME = "client-side-events",
  DATASET_NAME = "Installer_Events",
  FAILED_ENTRY_FILE = ".failed-log-entries.json",
  bqController = require("./bq-controller.js")(PROJECT_NAME, DATASET_NAME, FAILED_ENTRY_FILE, installPath),
  displaySettings = {},
  os = osDesc || (systemOS + " " + systemArch);

  bqController.init();

  function getDateForTableName(nowDate) {
    nowDate = new Date(nowDate);
    var year = nowDate.getUTCFullYear(),
    month = nowDate.getUTCMonth() + 1,
    day = nowDate.getUTCDate();

    if (month < 10) {month = "0" + month;}
    if (day < 10) {day = "0" + day;}

    return "" + year + month + day;
  }

  var mod = {
    getDateForTableName,
    getBQClient() { return bqController.getBQClient(); },
    setDisplaySettings(settings) {
      displaySettings = settings;
    },
    log(eventName, eventDetails, nowDate) {
      if (!eventName) {return Promise.reject("eventName is required");}
      if (!nowDate || !Date.prototype.isPrototypeOf(nowDate)) {
        nowDate = new Date();
      }

      if (typeof eventDetails === "object") eventDetails = JSON.stringify(eventDetails);

      var data = {
        event: eventName,
        event_details: eventDetails || "",
        display_id: displaySettings.displayid || displaySettings.tempdisplayid,
        installer_version: installerVersion,
        os: os,
        ts: nowDate.toISOString()
      };

      return bqController.log("events" + mod.getDateForTableName(nowDate), data, nowDate)
        .catch((e)=>{
          log.file("Could not log to bq " + require("util").inspect(e, { depth: null }));
        });
    },
    pendingEntries() { return bqController.pendingEntries(); },
    maxQueue() { return bqController.maxQueue(); }
  };

  return mod;
};
