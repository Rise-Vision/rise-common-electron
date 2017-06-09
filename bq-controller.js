module.exports = (projectName, dataSetName, filename, installPath)=>{
  var bqClient = require("./bq-client.js")(projectName, dataSetName),
    fs = require("fs"),
    installPath = installPath || require("os").homedir(),
    failedLogEntries,
    FAILED_FILE_PATH = require("path").join(installPath, filename),
    MAX_FAILED_LOG_QUEUE = 50,
    FAILED_LOG_QUEUE_PURGE_COUNT = 10,
    TEN_MINUTE_MS = 60 * 1000 * 10,
    FIVE_HOURS_MS = TEN_MINUTE_MS * 6 * 5,
    INITIAL_FAILED_LOG_RETRY_MS = 10000,
    FAILED_ENTRY_RETRY_MS = TEN_MINUTE_MS,
    PERSIST_FAILURE_DEBOUNCE = 5000,
    persistFailuresTimeout,
    insertPending;

  function addFailedLogEntry(tableName, data, date, templateSuffix) {
    if (Object.keys(failedLogEntries).length >= MAX_FAILED_LOG_QUEUE) { purgeOldEntries(); }
    failedLogEntries[Number(date)] = [tableName, data, date, templateSuffix];
    schedulePersist();
  }

  function purgeOldEntries() {
    Object.keys(failedLogEntries)
      .sort((a, b)=>a-b)
      .slice(0, FAILED_LOG_QUEUE_PURGE_COUNT)
      .forEach((key)=>{
        delete failedLogEntries[key];
      });
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

  function insert(tableName, data, date, templateSuffix) {
    return bqClient.insert(tableName, data, date, templateSuffix)
      .catch(e=>{
        addFailedLogEntry(tableName, data, date, templateSuffix);
        scheduleLogInsert();

        return Promise.reject(e);
      });
  }

  var mod = {
    getBQClient() { return bqClient; },
    getDateForTableName(date) {
      date = new Date(date);
      var year = date.getUTCFullYear(),
        month = date.getUTCMonth() + 1,
        day = date.getUTCDate();

      if (month < 10) {month = "0" + month;}
      if (day < 10) {day = "0" + day;}

      return "" + year + month + day;
    },
    init() {
      try {
        failedLogEntries = require(FAILED_FILE_PATH);
        if (Object.keys(failedLogEntries).length) {
          insertPending = insertPending || setTimeout(insertFailedLogEntries, INITIAL_FAILED_LOG_RETRY_MS);
        }
      } catch(e) {
        failedLogEntries = {};
      }
    },
    log(tableName, data, date, templateSuffix) {
      return insert(tableName, data, date, templateSuffix);
    },
    pendingEntries() {
      return failedLogEntries;
    },
    maxQueue() {
      return MAX_FAILED_LOG_QUEUE;
    }
  };

  return mod;

};