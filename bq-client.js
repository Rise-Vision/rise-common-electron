var network = require("./network.js");

module.exports = (projectName, dataSetName, refreshUrl)=>{
  var config = require("./config.json"),
  refreshDate = 0,
  token = "";

  function refreshToken(nowDate) {
    if (nowDate - refreshDate < 3580000) {
      return Promise.resolve(token);
    }

    return network.httpFetch(refreshUrl || config.refreshUrl, {method: "POST"})
    .then(resp=>{return resp.json();})
    .then(json=>{
      refreshDate = nowDate;
      token = json.access_token;
    });
  }

  var mod = {
    refreshToken,
    insert(tableName, data, nowDate, templateSuffix) {
      if (!projectName) {return Promise.reject("projectName is required");}
      if (!dataSetName) {return Promise.reject("dataSetName is required");}
      if (!tableName) {return Promise.reject("tableName is required");}

      nowDate = nowDate || new Date();

      return mod.refreshToken(nowDate).then(()=>{
        var insertData = JSON.parse(JSON.stringify(config.insertSchema)),
        row = insertData.rows[0],
        serviceUrl,
        headers;

        if (templateSuffix) {
          insertData.templateSuffix = templateSuffix;
        }

        serviceUrl = config.serviceUrl
          .replace("PROJECT_NAME", projectName)
          .replace("DATA_SET", dataSetName)
          .replace("TABLE_ID", tableName);

        headers = {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        };

        row.insertId = Math.random().toString(36).substr(2).toUpperCase();
        row.json = data;

        return network.httpFetch(serviceUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(insertData)
        })
        .then((res)=>{
          return res.json();
        })
        .then((json)=>{
          if(json.insertErrors && json.insertErrors.length) {
            return Promise.reject(json.insertErrors);
          } else if (json.error && json.error.message) {
            return Promise.reject(json.error.message);
          } else {
            return Promise.resolve();
          }
        });
      });
    }
  };

  return mod;
};
