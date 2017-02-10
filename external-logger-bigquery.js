module.exports = (systemOS, systemArch, installerVersion, osDesc)=>{
  var bqClient = require("./bq-client.js")("client-side-events", "Installer_Events"),
  failedLogEntries = {},
  MAX_FAILED_LOG_QUEUE = 50,
  displaySettings = {},
  TEN_MINUTE_MS = 60 * 1000 * 10,
  FIVE_HOURS_MS = TEN_MINUTE_MS * 6 * 5,
  FAILED_ENTRY_RETRY_MS = TEN_MINUTE_MS,
  os = osDesc || (systemOS + " " + systemArch);

  function getDateForTableName(nowDate) {
    var year = nowDate.getUTCFullYear(),
    month = nowDate.getUTCMonth() + 1,
    day = nowDate.getUTCDate();

    if (month < 10) {month = "0" + month;}
    if (day < 10) {day = "0" + day;}

    return "" + year + month + day;
  }

  function insert(date, data) {
    return bqClient.insert("events" + mod.getDateForTableName(date), data, date)
    .catch(e=>{
      addFailedLogEntry(date, data);
      setTimeout(insertFailedLogEntries, FAILED_ENTRY_RETRY_MS);
      FAILED_ENTRY_RETRY_MS = Math.min(FAILED_ENTRY_RETRY_MS * 1.5, FIVE_HOURS_MS);
      throw e;
    });
  }

  function addFailedLogEntry(date, data) {
    if (Object.keys(failedLogEntries).length >= MAX_FAILED_LOG_QUEUE) { return; }
    failedLogEntries[Number(date)] = [date, data];
  }

  function insertFailedLogEntries() {
    let entryKey = Object.keys(failedLogEntries)[0];
    if (!entryKey) { return; }

    insert(...failedLogEntries[entryKey])
    .then(()=>{
      delete failedLogEntries[entryKey];
      insertFailedLogEntries();
    })
    .catch(()=>{
      log.file("Could not log previously failed entry.");
    });
  }

  function msToMins(ms) { return ms / 1000 / 60; }

  var mod = {
    getDateForTableName,
    getBQClient() { return bqClient; },
    setDisplaySettings(settings) {
      displaySettings = settings;
    },
    log(eventName, eventDetails, nowDate) {
      if (!eventName) {return Promise.reject("eventName is required");}
      if (!nowDate || !Date.prototype.isPrototypeOf(nowDate)) {
        nowDate = new Date();
      }

      var data = {
        event: eventName,
        event_details: eventDetails || "",
        display_id: displaySettings.displayid || displaySettings.tempdisplayid,
        installer_version: installerVersion,
        os: os,
        ts: nowDate.toISOString()
      };

      return insert(nowDate, data)
      .catch((e)=>{
        log.file("Could not log to bq " + require("util").inspect(e, { depth: null }));
      });
    },
    pendingEntries() { return failedLogEntries; }
  };

  return mod;
};
