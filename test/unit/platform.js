var platform = require("../../platform.js"),
childProcess = require("child_process"),
os = require("os"),
path = require("path"),
fs = require("fs-extra"),
ws = require("windows-shortcuts"),
assert = require("assert"),
simpleMock = require("simple-mock"),
mock = require("simple-mock").mock;

global.messages = {};
describe("platform", ()=>{
  beforeEach("setup mocks", ()=>{

  });

  afterEach("clean mocks", ()=>{
    simpleMock.restore();
  });

  it("returns a valid URL for viewer", ()=>{
    assert(platform.getViewerUrl());
  });

  it("returns a valid name for Windows installer name", ()=>{
    mock(platform, "isWindows").returnWith(true);
    assert(platform.getInstallerName());
  });

  it("returns a valid name for Linux installer name", ()=>{
    mock(platform, "isWindows").returnWith(false);
    assert(platform.getInstallerName());
  });

  it("returns a valid name for old Windows installer name", ()=>{
    mock(platform, "isWindows").returnWith(true);
    assert(platform.getOldInstallerName());
  });

  it("returns a valid name for old Linux installer name", ()=>{
    mock(platform, "isWindows").returnWith(false);
    assert(platform.getOldInstallerName());
  });

  it("gets Ubuntu version", ()=>{
    mock(childProcess, "spawnSync").returnWith({ stdout: {} });

    platform.getUbuntuVer();

    assert(childProcess.spawnSync.called);
    assert.equal(childProcess.spawnSync.lastCall.args[0], "lsb_release");
    assert.equal(childProcess.spawnSync.lastCall.args[1][0], "-sr");
  });

  it("gets temporary directory", ()=>{
    mock(os, "tmpdir").returnWith("temp");

    platform.getTempDir();

    assert(os.tmpdir.called);
  });

  it("waits for 100ms to resolve the promise", ()=>{
    var time0 = new Date().getTime();

    return platform.waitForMillis(100).then(()=>{
      assert(new Date().getTime() - time0 >= 0);
    });
  });

  it("starts a detached child process", ()=>{
    mock(childProcess, "spawn").returnWith({ unref() {} });

    platform.startProcess("ls", ["-a", "*"]);

    assert(childProcess.spawn.called);
    assert.equal(childProcess.spawn.lastCall.args[0], "ls");
    assert.equal(childProcess.spawn.lastCall.args[2].detached, true);
  });

  it("starts a detached child process after a couple of failures", function() {
    var intervalHandler,
    expectedCallCount = 3;

    this.timeout(8000);
    mock(childProcess, "spawn")
    .throwWith(new Error("1"))
    .throwWith(new Error("2"))
    .returnWith({ unref() {} });

    return new Promise((res)=>{
      platform.startProcess("ls", ["-a", "*"]);
      intervalHandler = setInterval(()=>{
        if (childProcess.spawn.callCount === expectedCallCount) {
          clearInterval(intervalHandler);
          res();
        }
      }, 500);
    });
  });

  it("kills Java on Windows", ()=>{
    mock(platform, "isWindows").returnWith(true);
    mock(platform, "spawn").resolveWith();

    return platform.killJava().then(()=>{
      assert(platform.spawn.called);
      assert(platform.spawn.lastCall.args[1].indexOf("javaw.exe") >= 0);
    });
  });

  it("kills Java on Linux", ()=>{
    mock(platform, "isWindows").returnWith(false);
    mock(platform, "spawn").resolveWith();

    return platform.killJava().then(()=>{
      assert(platform.spawn.called);
      assert(platform.spawn.lastCall.args[0].indexOf("pkill") >= 0);
    });
  });

  it("kills explorer.exe on Windows 10", ()=>{
    mock(platform, "isWindows").returnWith(true);
    mock(platform, "spawn").resolveWith();
    mock(platform, "getWindowsVersion").returnWith("10");

    return platform.killExplorer().then(()=>{
      assert(platform.spawn.called);
      assert(platform.spawn.lastCall.args[1].indexOf("explorer.exe") >= 0);
    });
  });

  it("does not kill explorer.exe on Windows 7", ()=>{
    mock(platform, "isWindows").returnWith(true);
    mock(platform, "spawn").resolveWith();
    mock(platform, "getWindowsVersion").returnWith("7");

    return platform.killExplorer().then(()=>{
      assert(!platform.spawn.called);
    });
  });

  it("does not attempt to kill explorer.exe on Linux", ()=>{
    mock(platform, "isWindows").returnWith(false);
    mock(platform, "spawn").resolveWith();

    return platform.killExplorer().then(()=>{
      assert(!platform.spawn.called);
    });
  });

  it("reads a text file", ()=>{
    mock(fs, "readFile").callbackWith(null, "text");

    return platform.readTextFile("file.txt").then((content)=>{
      assert(fs.readFile.called);
      assert.equal(content, "text");
    });
  });

  it("fails to read a text file", ()=>{
    mock(fs, "readFile").callbackWith("read error", null);

    return platform.readTextFile("file.txt").catch((err)=>{
      assert(fs.readFile.called);
      assert.equal(err.error, "read error");
    });
  });

  it("synchronously reads a text file", ()=>{
    mock(fs, "readFileSync").returnWith("text");

    assert.equal(platform.readTextFileSync("file.txt"), "text");
    assert(fs.readFileSync.called);
  });

  it("fails to synchronously reads a text file", ()=>{
    mock(fs, "readFileSync").throwWith("error");
    mock(log, "file").returnWith();
    mock(log, "external").returnWith();
    mock(log, "error").returnWith();

    assert.equal(platform.readTextFileSync("file.txt"), "");
    assert(fs.readFileSync.called);
    assert(log.file.called);
    assert(!log.error.called);
  });

  it("fails to synchronously reads a text file and logs the error", ()=>{
    mock(fs, "readFileSync").throwWith("error");
    mock(log, "debug").returnWith();
    mock(log, "error").returnWith();

    assert.equal(platform.readTextFileSync("file.txt", true), "");
    assert(fs.readFileSync.called);
    assert(!log.debug.called);
  });

  it("writes a text file", ()=>{
    mock(fs, "writeFile").callbackWith(null);

    return platform.writeTextFile("file.txt", "text").then(()=>{
      assert(fs.writeFile.called);
    });
  });

  it("fails to write a text file", ()=>{
    mock(fs, "writeFile").callbackWith("write error");

    return platform.writeTextFile("file.txt", "text").catch((err)=>{
      assert(fs.writeFile.called);
      assert.equal(err.error, "write error");
    });
  });

  it("writes a text file synchronously", ()=>{
    mock(fs, "writeFileSync").returnWith();

    platform.writeTextFileSync("file.txt", "text");
    assert(fs.writeFileSync.called);
  });

  it("does not throw when it fails to write a text file synchronously", ()=>{
    mock(fs, "writeFileSync").throwWith("write error");

    platform.writeTextFileSync("file.txt", "text");
    assert(fs.writeFileSync.called);
  });

  it("copies folder recursively", ()=>{
    mock(fs, "copy").callbackWith(null);

    return platform.copyFolderRecursive("folder1", "folder2").then((err)=>{
      assert(fs.copy.called);
      assert(!err);
    });
  });

  it("fails to copy folder recursively", ()=>{
    mock(fs, "copy").callbackWith("error");

    return platform.copyFolderRecursive("folder1", "folder2").catch((err)=>{
      assert(fs.copy.called);
      assert.equal(err, "error");
    });
  });

  it("sets file permissions", ()=>{
    mock(fs, "chmod").callbackWith(null);

    return platform.setFilePermissions("file.txt", 0755).then(()=>{
      assert(fs.chmod.called);
    });
  });

  it("fails to write a text file", ()=>{
    mock(fs, "chmod").callbackWith("chmod error");

    return platform.setFilePermissions("file.txt", "text").catch((err)=>{
      assert(fs.chmod.called);
      assert.equal(err.error, "chmod error");
    });
  });

  it("checks if file exists", ()=>{
    mock(fs, "lstatSync").returnWith();

    assert(platform.fileExists("file.txt"));
    assert(fs.lstatSync.called);
  });

  it("fails to write a text file", ()=>{
    mock(fs, "lstatSync").throwWith("lstatSync error");

    assert(!platform.fileExists("file.txt"));
    assert(fs.lstatSync.called);
  });

  it("creates a non-existing directory", ()=>{
    mock(fs, "mkdirSync").returnWith();

    return platform.mkdir("newDir").then(()=>{
      assert(fs.mkdirSync.called);
    });
  });

  it("tries to create an existing directory, but does not fail", ()=>{
    mock(fs, "mkdirSync").throwWith({ code: "EEXIST" });

    return platform.mkdir("newDir").then(()=>{
      assert(fs.mkdirSync.called);
    });
  });

  it("fails tries to create a directory", ()=>{
    mock(fs, "mkdirSync").throwWith({ code: "ERROR" });

    return platform.mkdir("newDir").catch(()=>{
      assert(fs.mkdirSync.called);
    });
  });

  it("creates a folder recursively", ()=>{
    mock(platform, "callMkdirp").callbackWith(null);

    return platform.mkdirRecursively("folder1/folder2").then((err)=>{
      assert(platform.callMkdirp.called);
      assert.equal(platform.callMkdirp.lastCall.args[0], "folder1/folder2");
      assert(!err);
    });
  });

  it("fails to create a folder recursively", ()=>{
    mock(platform, "callMkdirp").callbackWith("error");

    return platform.mkdirRecursively("folder1/folder2").catch((err)=>{
      assert(platform.callMkdirp.called);
      assert.equal(platform.callMkdirp.lastCall.args[0], "folder1/folder2");
      assert.equal(err.error, "error");
    });
  });

  it("renames a file", ()=>{
    mock(fs, "copySync").returnWith();
    mock(fs, "removeSync").returnWith();

    return platform.renameFile("file.txt", "newname.txt").then(()=>{
      assert(fs.copySync.called);
      assert(fs.removeSync.called);
      assert.equal(fs.copySync.lastCall.args[0], "file.txt");
      assert.equal(fs.copySync.lastCall.args[1], "newname.txt");
      assert.equal(fs.removeSync.lastCall.args[0], "file.txt");
    });
  });

  it("fails to rename a file in the copy step", ()=>{
    mock(fs, "copySync").throwWith("copy error");
    mock(fs, "removeSync").returnWith();

    return platform.renameFile("file.txt", "newname.txt").catch((err)=>{
      assert(fs.copySync.called);
      assert(!fs.removeSync.called);
      assert.equal(err.error, "copy error");
    });
  });

  it("fails to rename a file in the remove step", ()=>{
    mock(fs, "copySync").returnWith();
    mock(fs, "removeSync").throwWith("delete error");

    return platform.renameFile("file.txt", "newname.txt").catch((err)=>{
      assert(fs.copySync.called);
      assert(fs.removeSync.called);
      assert.equal(err.error, "delete error");
    });
  });

  it("deletes a folder recursively", ()=>{
    mock(platform, "callRimraf").callbackWith(null);

    return platform.deleteRecursively("folder1").then((err)=>{
      assert(platform.callRimraf.called);
      assert(!err);
    });
  });

  it("fails to copy folder recursively", ()=>{
    mock(platform, "callRimraf").callbackWith("error");

    return platform.deleteRecursively("folder1").catch((err)=>{
      assert(platform.callRimraf.called);
      assert.equal(err.error, "error");
    });
  });

  it("executes a function that returns a promise on first run", ()=>{
    mock(platform, "isFirstRun").returnWith(true);

    return Promise.resolve()
    .then(platform.onFirstRun(()=>{return Promise.resolve(true);}))
    .then((itRan)=> {
      assert.ok(itRan);
    });
  });

  it("does not execute a function on other runs", ()=>{
    mock(platform, "isFirstRun").returnWith(false);

    return Promise.resolve()
    .then(platform.onFirstRun(()=>{return Promise.resolve(true);}))
    .then((itRan)=> {
      assert.ok(!itRan);
    });
  });

  it("creates a shortcut on Windows", ()=>{
    mock(ws, "create").callbackWith();

    return platform.createWindowsShortcut("shortcut.exe")
    .then(()=>{
      assert.ok(ws.create.called);
    });
  });

  it("fails to create a shortcut on Windows", ()=>{
    mock(ws, "create").callbackWith("error");

    return platform.createWindowsShortcut("shortcut.exe")
    .catch((err)=>{
      assert.ok(ws.create.called);
      assert.equal(err, "error");
    });
  });

  it("queries a shortcut on Windows", ()=>{
    mock(ws, "query").callbackWith(null, { target: "target.exe" });

    return platform.queryWindowsShortcut("shortcut.exe")
    .then((options)=>{
      assert(ws.query.called);
      assert(options.target);
    });
  });

  it("fails to query a shortcut on Windows", ()=>{
    mock(ws, "query").callbackWith("error");

    return platform.queryWindowsShortcut("shortcut.exe")
    .catch((err)=>{
      assert(ws.query.called);
      assert.equal(err, "error");
    });
  });

  it("parses a property list (text form) into a map", ()=>{
    var text = "property1=value1\nproperty2=value2";
    var propList = platform.parsePropertyList(text);

    assert.equal(propList.property1, "value1");
    assert.equal(propList.property2, "value2");
    assert(!propList.property3);
  });

  it("reboots a Linux box", ()=>{
    mock(platform, "isWindows").returnWith(false);
    mock(platform, "spawn").resolveWith();

    return platform.reboot().then(()=>{
      assert(platform.spawn.called);
      assert(platform.spawn.lastCall.args[1].indexOf("dbus-send") >= 0);
    });
  });

  it("reboots a Windows box", ()=>{
    mock(platform, "isWindows").returnWith(true);
    mock(platform, "spawn").resolveWith();

    return platform.reboot().then(()=>{
      assert(platform.spawn.called);
      assert(platform.spawn.lastCall.args[0].indexOf("shutdown") >= 0);
    });
  });

  it("list a directory's content", ()=>{
    mock(fs, "readdir").callbackWith(null, [ "file1", "file2" ]);
    mock(fs, "statSync").callFn(()=>{
      return {
        isDirectory() { return false; }
      };
    });

    return platform.listDirectory("localDir").then((response)=>{
      assert(fs.readdir.called);
      assert.equal(fs.statSync.callCount, 2);

      assert.equal(response.length, 2);
      assert.equal(response[0].path, path.join("localDir", "file1"));
    });
  });

  it("fails to list a directory's content", ()=>{
    mock(fs, "readdir").callbackWith("error");
    mock(fs, "statSync").returnWith();

    return platform.listDirectory("localDir").catch((err)=>{
      assert(fs.readdir.called);
      assert.equal(fs.statSync.callCount, 0);
      assert.equal(err, "error");
    });
  });
});
