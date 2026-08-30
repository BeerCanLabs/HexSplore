// A dependency-free local server for trying HexSplore during development.
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

http
  .createServer((request, response) => {
    const urlPath =
      request.url === "/" ? "/index.html" : request.url.split("?")[0];
    const filePath = path.resolve(root, `.${urlPath}`);
    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      response.writeHead(200, {
        "Content-Type":
          types[path.extname(filePath)] || "application/octet-stream",
      });
      response.end(data);
    });
  })
  .listen(3000, () =>
    console.log("HexSplore is running at http://localhost:3000")
  );
