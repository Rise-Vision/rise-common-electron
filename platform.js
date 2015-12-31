var childProcess = require("child_process"),
stream = require("stream"),
path = require("path"),
mkdirp = require("mkdirp"),
os = require("os"),
fs = require(process.versions.electron ? "original-fs" : "fs"),
ncp = require("ncp"),
rimraf = require("rimraf"),
gunzip = require("gunzip-maybe"),
tar = require("tar-fs"),
ws = require("windows-shortcuts");

module.exports = {
  getCoreUrl() {
    return "https://rvaserver2.appspot.com";
  },
  getViewerUrl() {
    return "http://rvashow.appspot.com";
  },
  getOS() {
    return process.platform;
  },
  getArch() {
    return process.arch;
  },
  isWindows() {
    return module.exports.getOS() === "win32";
  },
  getHomeDir() {
    return process.env[module.exports.isWindows() ? "LOCALAPPDATA" : "HOME"];
  },
  getUbuntuVer() {
    return childProcess.spawnSync("lsb_release", ["-sr"]).stdout;
  },
  getInstallDir() {
    return path.join(module.exports.getHomeDir(), "rvplayer");
  },
  getTempDir() {
    return os.tmpdir();
  },
  getCwd() {
    return process.cwd();
  },
  isDevMode() {
    var currPath = module.exports.getCwd().split(path.sep);

    return currPath.length < 2 || currPath[currPath.length - 2] !== "resources";
  },
  getJavaExecutablePath() {
    if (module.exports.isWindows()) {
      return path.join(module.exports.getInstallDir(), "JRE", "bin", "java.exe");
    } else {
      return path.join(module.exports.getInstallDir(), "jre", "bin", "java");
    }
  },
  getInstallerName() {
    return module.exports.isWindows() ? "installer.exe" : "installer";
  },
  getOldInstallerName() {
    return module.exports.isWindows() ? "RiseVisionPlayer.exe" : "rvplayer";
  },
  getInstallerDir() {
    return path.join(module.exports.getInstallDir(), "Installer");
  },
  getInstallerPath() {
    return path.join(module.exports.getInstallerDir(), module.exports.getInstallerName());
  },
  getOldInstallerPath() {
    return path.join(module.exports.getInstallDir(), module.exports.getOldInstallerName());
  },
  getProgramsMenuPath() {
    if(module.exports.isWindows()) {
      return path.join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs");
    }
    else {
      return path.join(module.exports.getHomeDir(), ".local", "share", "applications");
    }
  },
  getAutoStartupPath() {
    if(module.exports.isWindows()) {
      return path.join(module.exports.getProgramsMenuPath(), "Startup");
    }
    else {
      return path.join(module.exports.getHomeDir(), ".config", "autostart");
    }
  },
  waitForMillis(milliseconds) {
    return new Promise((resolve)=>{
      setTimeout(function() {
        resolve();
      }, milliseconds);
    });
  },
  startProcess(command, args) {
    childProcess.spawn(command, args, {
      cwd: path.dirname(command),
      stdio: "ignore",
      detached: true
    }).unref();
  },
  spawn(command, timeout) {
    var args = command.split(" ")
    .map((val)=>{return val.trim();})
    .filter((val)=>{return val !== "";});

    args.splice(0, 1);
    log.debug("executing " + command.split(" ")[0] + " with [" + args + "]");

    return new Promise((res, rej)=>{
      var child,
      options = {
        timeout: timeout || 9000,
        stdio: "inherit"
      };

      child = childProcess.spawn(command.split(" ")[0], args, options);
      child.on("close", (retCode)=>{
        res(retCode);
      });
      child.on("error", (err)=>{
        rej(err);
      });
    });
  },
  killJava() {
    if(module.exports.isWindows()) {
      return module.exports.spawn("taskkill /f /im javaw.exe");
    }
    else {
      return module.exports.spawn("pkill -f " + module.exports.getJavaExecutablePath() + "\n");
    }
  },
  killChromium() {
    if(module.exports.isWindows()) {
      return module.exports.spawn("taskkill /f /im chrome.exe");
    }
    else {
      return module.exports.spawn("pkill -f " + path.join(module.exports.getInstallDir(), "chrome-linux") + "\n");
    }
  },
  readTextFile(path) {
    return new Promise((resolve, reject)=>{
      fs.readFile(path, "utf8", function (err, data) {
        if(!err) {
          resolve(data);
        }
        else {
          reject({ message: "Error reading file", error: err });
        }
      });
    });
  },
  readTextFileSync(path, logError) {
    var stringContents = "";

    try {
      stringContents = fs.readFileSync(path, "utf8");
    } catch (e) {
      if(logError) {
        log.error("Could not read file " + path + " " + require("util").inspect(e), messages.fileReadError);
      }
      else {
        log.file("Could not read file " + path + " " + require("util").inspect(e));
      }
    }

    return stringContents;
  },
  writeTextFile(filePath, data) {
    log.debug("writing " + filePath);
    return new Promise((resolve, reject)=>{
      mkdirp(path.dirname(filePath), (err)=>{
        if (!err) {
          resolve();
        } else {
          log.error("Error writing file", messages.fileWriteError);
          reject({ message: "Error writing file", error: err });
        }
      });
    })
    .then(()=>{
      return new Promise((resolve, reject)=>{
        fs.writeFile(filePath, data, "utf8", function (err) {
          if(!err) {
            resolve();
          }
          else {
            log.error("Error writing file", messages.fileWriteError);
            reject({ message: "Error writing file", error: err });
          }
        });
      });
    });
  },
  copyFolderRecursive(source, target) {
    return new Promise((resolve, reject)=>{
      ncp.ncp(source, target, { clobber: true }, (err)=>{
        if(!err) {
          resolve();
        }
        else {
          reject(err);
        }
      });
    });
  },
  extractZipTo(source, destination, progressCallback) {
    function progress(fileStream, header) {
      return fileStream.pipe(new stream.Transform({
        transform(chunk, enc, next) {
          progressCallback(chunk.length, header.name, header.size);
          this.push(chunk);
          next();
        },
        flush(done) {
          done();
        }
      }));
    }

    return new Promise((resolve, reject)=>{
      fs.createReadStream(source)
      .pipe(gunzip())
      .pipe(tar.extract(destination, {fs: fs, mapStream: progress}))
      .on("finish", resolve)
      .on("error", (err)=>{
        reject(err);
      });
    });
  },
  setFilePermissions(path, mode) {
    return new Promise((resolve, reject)=>{
      fs.chmod(path, mode, (err)=>{
        if (err) {
          reject({ message: "Error setting file permissions", error: err });
        }
        else {
          resolve();
        }
      });
    });
  },
  fileExists(path) {
    try {
      fs.lstatSync(path);
      return true;
    }
    catch(e) {
      return false;
    }
  },
  mkdir(path) {
    return new Promise((resolve, reject)=>{
      try {
        fs.mkdirSync(path);
        resolve();
      } catch(e) {
        if (e.code !== "EEXIST") {
          reject({ message: "Error creating directory", error: e });
        }
        else {
          resolve();
        }
      }
    });
  },
  renameFile(oldName, newName) {
    return new Promise((resolve, reject)=>{
      fs.rename(oldName, newName, (err)=>{
        if(!err) {
          resolve();
        }
        else {
          reject({ message: "Error renaming file", error: err });
        }
      });
    });
  },
  deleteRecursively(path) {
    return new Promise((resolve, reject)=>{
      module.exports.callRimraf(path, (err)=>{
        if(!err) {
          resolve();
        }
        else {
          reject({ message: "Error recursively deleting path", error: err });
        }
      });
    });
  },
  callRimraf(path, cb) {
    rimraf(path, cb);
  },
  isFirstRun() {
    return __dirname !== module.exports.getInstallerDir();
  },
  onFirstRun(whatToDo) {
    if (module.exports.isFirstRun()) {
      return whatToDo;
    } else {
      return function() {return Promise.resolve();};
    }
  },
  createWindowsShortcut(lnkPath, exePath, args) {
    return new Promise((resolve, reject)=>{
      ws.create(lnkPath, { target: exePath, args: args }, (err)=>{
        if(!err) {
          resolve();
        }
        else {
          reject(err);
        }
      });        
    });
  }
};
