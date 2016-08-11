module.exports = (systemOS, systemArch, installerVersion, osDesc)=>{
  var bqClient = require("./bq-client.js")("client-side-events", "Installer_Events"),
  displaySettings = {},
  os = osDesc || (systemOS + " " + systemArch);

  function getDateForTableName(nowDate) {
    var year = nowDate.getUTCFullYear(),
    month = nowDate.getUTCMonth() + 1,
    day = nowDate.getUTCDate();

    if (month < 10) {month = "0" + month;}
    if (day < 10) {day = "0" + day;}

    return "" + year + month + day;
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
        display_id: displaySettings.displayid || displaySettings.tempdisplayid,
        installer_version: installerVersion,
        os: os,
        ts: nowDate.toISOString()
      };

      if (eventDetails) {
        data.event_details = eventDetails;
      }

      return bqClient.insert("events" + mod.getDateForTableName(nowDate), data, nowDate)
      .catch(e=>{
        log.file("Could not log to bq " + require("util").inspect(e));
      });
    }
  };

  return mod;
};
