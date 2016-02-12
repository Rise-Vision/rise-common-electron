var http = require("http"),
url = require("url");

http.createServer((req, res)=>{
  res.writeHead(302, {"Location": `http://localhost:9876${url.parse(req.url).pathname}`});
  res.end("");
}).listen(9877);
