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
  INITIAL_FAILED_LOG_RETRY_MS = 10000,
  FAILED_ENTRY_RETRY_MS = TEN_MINUTE_MS,
  PERSIST_FAILURE_DEBOUNCE = 5000,
  persistFailuresTimeout,
  insertPending
  installPath = installPath || require("os").homedir(),
  os = osDesc || (systemOS + " " + systemArch);

  try {
    failedLogEntries = require(FAILED_FILE_PATH);
    if (Object.keys(failedLogEntries).length) {
      insertPending = setTimeout(insertFailedLogEntries, INITIAL_FAILED_LOG_RETRY_MS);
    }
  } catch(e) {
    failedLogEntries = {};
  }

  function getDateForTableName(nowDate) {
    nowDate = new Date(nowDate);
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
      scheduleLogInsert();

      return Promise.reject(e);
    });
  }

  function addFailedLogEntry(date, data) {
    if (Object.keys(failedLogEntries).length >= MAX_FAILED_LOG_QUEUE) { return; }
    failedLogEntries[Number(date)] = [date, data];
    schedulePersist();
  }

  function insertFailedLogEntries() {
    insertPending = null;
    log.file("Inserting failed bq log entries");

    Object.keys(failedLogEntries).reduce((promiseChain, key)=>{
      return promiseChain.then(()=>insert(...failedLogEntries[key]))
      .then(()=>{
        log.file("inserted " + key);
        delete failedLogEntries[key];
      });
    }, Promise.resolve())
    .catch(()=>{
      log.file("Could not log all previously failed bq logs entries.");
      scheduleLogInsert();
    })
    .then(()=>{
      schedulePersist();
    });
  }

  function scheduleLogInsert() {
    if (!insertPending) {
      insertPending = setTimeout(insertFailedLogEntries, FAILED_ENTRY_RETRY_MS);
      FAILED_ENTRY_RETRY_MS = Math.min(FAILED_ENTRY_RETRY_MS * 1.5, FIVE_HOURS_MS);
    }
  }

  function schedulePersist() {
    if (persistFailuresTimeout) {clearTimeout(persistFailuresTimeout);}
    persistFailuresTimeout = setTimeout(persistFailures, PERSIST_FAILURE_DEBOUNCE);
  }

  function msToMins(ms) { return ms / 1000 / 60; }

  function persistFailures() {
    persistFailuresTimeout = null;
    fs.writeFile(FAILED_FILE_PATH, JSON.stringify(failedLogEntries, null, 2), {
      encoding: "utf8"
    }, (err)=>{
      if (err) {
        log.file("Could not save failed log entries. " + err.message);
      }
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

      if (typeof eventDetails === "object") eventDetails = JSON.stringify(eventDetails);

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
