module.exports = (systemOS, systemArch, installerVersion, osDesc, installPath)=>{
  var bqClient = require("./bq-client.js")("client-side-events", "Installer_Events"),
  fs = require("fs"),
  failedLogEntries,
  FAILED_ENTRY_FILE = ".failed-log-entries.json",
  FAILED_FILE_PATH = require("path").join(installPath, FAILED_ENTRY_FILE),
  MAX_FAILED_LOG_QUEUE = 50,
  displaySettings = {},
  TEN_MINUTE_MS = 60 * 1000 * 10,
  FIVE_HOURS_MS = TEN_MINUTE_MS * 6 * 5,
  FAILED_ENTRY_RETRY_MS = TEN_MINUTE_MS,
  PERSIST_FAILURE_DEBOUNCE = 5000,
  persistFailuresTimeout,
  installPath = installPath || require("os").homedir(),
  os = osDesc || (systemOS + " " + systemArch);

  try {
    failedLogEntries = require(FAILED_FILE_PATH);
  } catch(e) {
    failedLogEntries = {};
  }

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
    if (persistFailuresTimeout) {cancelTimeout(persistFailuresTimeout);}
    persistFailuresTimeout = setTimeout(persistFailures, PERSIST_FAILURE_DEBOUNCE);
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

  function persistFailures() {
    persistFailuresTimeout = null;
    fs.writeFile(FAILED_FILE_PATH, JSON.stringify(failedLogEntries, null, 2), {
      encoding: "utf8"
    }, (err)=>{
      log.file("Could not save failed log entries");
    });
  }

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
