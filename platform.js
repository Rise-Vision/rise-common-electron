var childProcess = require("child_process"),
stream = require("stream"),
path = require("path"),
mkdirp = require("mkdirp"),
os = require("os"),
fs = require("fs-extra"),
rimraf = require("rimraf"),
gunzip = require("gunzip-maybe"),
tar = require("tar-fs"),
ws = require("windows-shortcuts"),
tempDir = "rvplayer-" + new Date().getTime();

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
  getInstallDir(version) {
    return path.join(module.exports.getHomeDir(), "rvplayer", version || "");
  },
  getTempDir() {
    return path.join(os.tmpdir(), tempDir);
  },
  getCwd() {
    return process.cwd();
  },
  getRunningPlatformDir() {
    return __dirname;
  },
  isRoot() {
    return process.getuid && process.getuid() === 0;
  },
  getJavaExecutablePath(version) {
    if (module.exports.isWindows()) {
      return path.join(module.exports.getInstallDir(version), "JRE", "bin", "java.exe");
    } else {
      return path.join(module.exports.getInstallDir(version), "jre", "bin", "java");
    }
  },
  getInstallerName() {
    return module.exports.isWindows() ? "installer.exe" : "installer";
  },
  getOldInstallerName() {
    return module.exports.isWindows() ? "RiseVisionPlayer.exe" : "rvplayer";
  },
  getInstallerDir(version) {
    return path.join(module.exports.getInstallDir(version), "Installer");
  },
  getInstallerPath(version) {
    return path.join(module.exports.getInstallerDir(version), module.exports.getInstallerName());
  },
  getOldInstallerPath() {
    return path.join(module.exports.getInstallDir(), module.exports.getOldInstallerName());
  },
  getUncaughtErrorFileName() {
    return path.join(module.exports.getInstallDir(), "uncaught-exception.json");
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
  spawn(command, args, timeout) {
    log.debug("executing " + command + " with " + args);

    return new Promise((res, rej)=>{
      var child, handled,
      options = {
        stdio: "inherit"
      };

      child = childProcess.spawn(command, args, options);
      child.on("exit", (retCode)=>{
        if (!handled) {res(retCode);}
        handled = true;
      });
      child.on("close", (retCode)=>{
        if (!handled) {res(retCode);}
        handled = true;
      });
      child.on("error", (err)=>{
        if (!handled) {rej(err);}
        handled = true;
      });

      setTimeout(()=>{
        if(!handled) {rej("timeout");}
      }, timeout || 9000);
    });
  },
  killJava() {
    if(module.exports.isWindows()) {
      return module.exports.spawn("taskkill", ["/f", "/im", "javaw.exe"]);
    }
    else {
      return module.exports.spawn("pkill", ["-f", "Rise.*jar"]);
    }
  },
  killExplorer() {
    if (module.exports.isWindows() && module.exports.getWindowsVersion() !== "7") {
      return module.exports.spawn("taskkill", ["/f", "/im", "explorer.exe"]);
    } else {
      return Promise.resolve();
    }
  },
  getWindowsVersion() {
    var release = os.release();

    if(release.startsWith("6.0")) {
      return "Vista";
    }
    else if(release.startsWith("6.1")) {
      return "7";
    }
    else if(release.startsWith("6.2")) {
      return "8";
    }
    else if(release.startsWith("6.3")) {
      return "8.1";
    }
    else if(release.startsWith("10.0")) {
      return "10";
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
  readTextFileSync(path) {
    var stringContents = "";

    try {
      stringContents = fs.readFileSync(path, "utf8");
    } catch (e) {
      log.file("Could not read file " + path + " " + require("util").inspect(e));
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
            reject({ message: "Error writing file", error: err });
          }
        });
      });
    });
  },
  writeTextFileSync(filePath, data) {
    log.debug("writing sync " + filePath);

    try {
      fs.writeFileSync(filePath, data);
    }
    catch (err) {
      log.debug(`Error writing file sync ${err}`);
    }
  },
  copyFolderRecursive(source, target) {
    log.debug(`copying ${source} to ${target}`);
    return new Promise((resolve, reject)=>{
      fs.copy(source, target, { clobber: true }, (err)=>{
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
      var tx = new stream.Transform({
        transform(chunk, enc, next) {
          progressCallback(chunk.length, header.name, header.size);
          this.push(chunk);
          next();
        },
        flush(done) {
          done();
        }
      });

      tx.destroy = function() {};
      return fileStream.pipe(tx);
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
          reject({ message: "Error creating directory " + path, userFriendlyMessage: "Error creating directory: " + path, error: e });
        }
        else {
          resolve();
        }
      }
    });
  },
  mkdirRecursively(path) {
    return new Promise((resolve, reject)=>{
      module.exports.callMkdirp(path, (err)=>{
        if (!err) {
          resolve();
        } else {
          reject({ message: "Error creating directory: " + path, userFriendlyMessage: "Error creating directory: " + path, error: err });
        }
      });
    });
  },
  renameFile(oldName, newName) {
    return new Promise((resolve, reject)=>{
      try {
        fs.copySync(oldName, newName);
        fs.removeSync(oldName);
        resolve();
      }
      catch (err) {
        var message = "Error renaming " + oldName + " to " + newName;
        reject({ message: message, userFriendlyMessage: message, error: err });
      }
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
    rimraf(path, fs, cb);
  },
  callMkdirp(path, cb) {
    mkdirp(path, cb);
  },
  isFirstRun() {
    try {
      fs.statSync(module.exports.getInstallerDir());
      return false;
    }catch (e) {
      return true;
    }
  },
  onFirstRun(whatToDo) {
    if (module.exports.isFirstRun()) {
      return whatToDo;
    } else {
      return function() {return Promise.resolve();};
    }
  },
  createWindowsShortcut(version, lnkPath, exePath, args) {
    return new Promise((resolve, reject)=>{
      var shortcutExePath = path.join(module.exports.getInstallerDir(version), "shortcut.exe");
      ws.create(shortcutExePath, lnkPath, { target: exePath, args: args }, (err)=>{
        if(!err) {
          resolve();
        }
        else {
          reject(err);
        }
      });
    });
  },
  parsePropertyList(list) {
    var result = {};
    list.split("\n").forEach((line)=>{
      if (line.indexOf("=") < 0) {return;}
      var vals = line.trim().split("=");
      result[vals[0]] = vals[1];
    });

    return result;
  },
  reboot() {
    var command = "shutdown",
    args = ["-r", "-c", "Rise Player needs to reboot computer."];

    if(!module.exports.isWindows()) {
      command = "bash";
      args = ["-c", "dbus-send", "--system", "--print-reply", "--dest=org.freedesktop.login1", "/org/freedesktop/login1 \"org.freedesktop.login1.Manager.Reboot\"", "boolean:true"];
    }

    return module.exports.spawn(command, args);
  }
};
