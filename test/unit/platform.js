const originalEnv = Object.assign({}, process.env);
var platform = require("../../platform.js"),
path = require("path"),
childProcess = require("child_process"),
fs = require("fs-extra"),
ws = require("windows-shortcuts"),
assert = require("assert"),
simpleMock = require("simple-mock"),
mock = require("simple-mock").mock;

global.messages = {};
global.log = global.log || {file: simpleMock.stub(), error:simpleMock.stub(), debug: simpleMock.stub()};

var diskSpaceOutputWin =
`FreeSpace
265906098176     `;

var diskSpaceOutputLnx =
`70538216`;

describe("platform", ()=>{
  beforeEach("setup mocks", ()=>{

  });

  afterEach("clean mocks", ()=>{
    simpleMock.restore();
  });

  it("returns a valid URL for viewer", ()=>{
    assert(platform.getViewerUrl());
  });

  it("gets Ubuntu version", ()=>{
    mock(childProcess, "spawnSync").returnWith({ stdout: {} });

    platform.getUbuntuVer();

    assert(childProcess.spawnSync.called);
    assert.equal(childProcess.spawnSync.lastCall.args[0], "lsb_release");
    assert.equal(childProcess.spawnSync.lastCall.args[1][0], "-sr");
  });

  it("opens the operating system's proxy config window", ()=>{
    let windowsArgs, linuxArgs;
    mock(platform, "isWindows").returnWith(true);
    mock(platform, "startProcess").returnWith(true);

    platform.openOSProxySettingsWindow();

    windowsArgs = platform.startProcess.lastCall.args;
    assert(windowsArgs.length);

    simpleMock.restore();
    mock(platform, "isWindows").returnWith(false);
    mock(platform, "startProcess").returnWith(true);
    mock(platform, "getUbuntuVer").returnWith("16.04");

    platform.openOSProxySettingsWindow();
    linuxArgs = platform.startProcess.lastCall.args;
    assert(linuxArgs.length === 2);
    assert(linuxArgs[0].startsWith("unity"));

    simpleMock.restore();
    mock(platform, "isWindows").returnWith(false);
    mock(platform, "startProcess").returnWith(true);
    mock(platform, "getUbuntuVer").returnWith("18.04");

    platform.openOSProxySettingsWindow();
    linuxArgs = platform.startProcess.lastCall.args;
    assert(linuxArgs.length === 2);
    assert(linuxArgs[0].startsWith("gnome"));
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

  it("creates a shortcut on Windows", ()=>{
    mock(ws, "create").callbackWith();

    return platform.createWindowsShortcut()
    .then(()=>{
      assert.ok(ws.create.called);
    });
  });

  it("fails to create a shortcut on Windows", ()=>{
    mock(ws, "create").callbackWith("error");

    return platform.createWindowsShortcut()
    .catch((err)=>{
      assert.ok(ws.create.called);
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

  it("returns free disk space with dir as parameter on linux", ()=>{
    var installDir = "/home/rise/rvplayer";
    var dir = "/home/rise/rvplayer/test";

    mock(platform, "isWindows").returnWith(false);
    mock(platform, "getInstallDir").returnWith(installDir);
    mock(childProcess, "exec").callbackWith(null, diskSpaceOutputLnx);

    return platform.getFreeDiskSpace(dir)
    .then((space)=>{
      assert(childProcess.exec.called);
      assert.equal(childProcess.exec.lastCall.args[0], "df -k " + dir + " | awk 'NR==2 {print $4}'");
      assert.equal(space, 72231133184);
    });
  });

  it("returns free disk space on Linux", ()=>{
    mock(platform, "isWindows").returnWith(false);
    mock(childProcess, "exec").callbackWith(null, diskSpaceOutputLnx);

    return platform.getFreeDiskSpace()
      .then((space)=>{
      assert(childProcess.exec.called);
    assert.equal(childProcess.exec.lastCall.args[0], "df -k " + path.join(__dirname, "..", "..") + " | awk 'NR==2 {print $4}'");
    assert.equal(space, 72231133184);
    });
  });

  it("fails to return free disk space on Linux", ()=>{
    var installDir = "/home/rise/rvplayer";

    mock(platform, "isWindows").returnWith(false);
    mock(platform, "getInstallDir").returnWith(installDir);
    mock(childProcess, "exec").callbackWith("error");

    return platform.getFreeDiskSpace()
    .catch((err)=>{
      assert.equal(err, "error");
    });
  });

  it("returns free disk space on Windows", ()=>{
    mock(platform, "isWindows").returnWith(true);
    mock(childProcess, "exec").callbackWith(null, diskSpaceOutputWin);

    return platform.getFreeDiskSpace()
    .then((space)=>{
      assert(childProcess.exec.called);
      assert.equal(childProcess.exec.lastCall.args[0], `wmic LogicalDisk Where "Name='${__dirname.substr(0,1)}:'" GET FreeSpace`);
      assert.equal(space, 265906098176);
    });
  });

  it("fails to return free disk space on Windows", ()=>{
    var installDir = "C:\\Users\\rise\\AppData\\Local\\rvplayer";

    mock(platform, "isWindows").returnWith(true);
    mock(platform, "getInstallDir").returnWith(installDir);
    mock(childProcess, "exec").callbackWith("error");

    return platform.getFreeDiskSpace()
      .catch((err)=>{
        assert.equal(err, "error");
      });
  });

  it("it runs a function which resolves a promise and returns it", ()=>{
    var stub = simpleMock.stub().resolveWith("res1");

    return platform.runAsPromise(stub)
      .then((res)=>{
        assert.equal(stub.callCount, 1);
        assert.equal(res, "res1");
      });
  });

  it("it runs a function which rejects a promise and returns it", ()=>{
    var stub = simpleMock.stub().rejectWith("rej1");

    return platform.runAsPromise(stub)
      .catch((err)=>{
        assert.equal(stub.callCount, 1);
        assert.equal(err, "rej1");
      });
  });

  it("it runs a function which returns a value and returns a resolved promise", ()=>{
    var stub = simpleMock.stub().returnWith("res1");

    return platform.runAsPromise(stub)
      .then((res)=>{
        assert.equal(stub.callCount, 1);
        assert.equal(res, "res1");
      });
  });

  it("it runs a function which throws an exception and returns a rejected promise", ()=>{
    var stub = simpleMock.stub().throwWith("rej1");

    return platform.runAsPromise(stub)
      .catch((err)=>{
        assert.equal(stub.callCount, 1);
        assert.equal(err, "rej1");
      });
  });

  it("runs a promise without retries", ()=>{
    var stub = simpleMock.stub().resolveWith();

    return platform.runFunction(stub, 2)
      .then((errors)=>{
        assert.equal(stub.callCount, 1);
        assert.equal(errors.length, 0);
      });
  });

  it("runs a promise succesfully after one retry (plus the original call)", ()=>{
    var stub = simpleMock.stub().rejectWith("err1").resolveWith();

    return platform.runFunction(stub, 2)
      .then((errors)=>{
        assert.equal(stub.callCount, 2);
        assert.equal(errors.toString(), [ "err1" ].toString());
      });
  });

  it("runs a promise and does not succeed after two retries (plus the original call)", ()=>{
    var stub = simpleMock.stub().rejectWith("err1").rejectWith("err2").rejectWith("err3");

    return platform.runFunction(stub, 2)
      .catch((err)=>{
        assert.equal(stub.callCount, 3);
        assert.equal(err.toString(), [ "err1", "err2", "err3" ].toString());
      });
  });

  it("runs a promise and it succeds on the first retry, after the first call times out", ()=>{
    var promise = new Promise(()=>{});
    var stub = simpleMock.stub().returnWith(promise).resolveWith();

    return platform.runFunction(stub, 2, 20)
      .then((errors)=>{
        assert.equal(stub.callCount, 2);
        assert.equal(errors.toString(), [ "function call timed out" ].toString());
      });
  });

  it("runs a promise and it fails every retry because of time out", ()=>{
    var promise = new Promise(()=>{});
    var stub = simpleMock.stub().returnWith(promise).returnWith(promise).returnWith(promise);

    return platform.runFunction(stub, 2, 20)
      .catch((err)=>{
        assert.equal(stub.callCount, 3);
        assert.equal(err[0], "function call timed out");
        assert.equal(err[1], "function call timed out");
        assert.equal(err[2], "function call timed out");
      });
  });

  it("runs a promise and it fails every retry because of errors and time outs", ()=>{
    var promise = new Promise(()=>{});
    var stub = simpleMock.stub().returnWith(promise).rejectWith("regular error").returnWith(promise);

    return platform.runFunction(stub, 2, 20)
      .catch((err)=>{
        assert.equal(stub.callCount, 3);
        assert.equal(err[0], "function call timed out");
        assert.equal(err[1], "regular error");
        assert.equal(err[2], "function call timed out");
      });
  });

  it("checks the retryDelay is used", ()=>{
    var stub = simpleMock.stub().rejectWith("err1").rejectWith("err2").rejectWith("err3").rejectWith("err4");
    var start = Date.now();

    return platform.runFunction(stub, 3, null, 50)
      .catch((err)=>{
        assert.equal(stub.callCount, 4);
        assert.equal(err.toString(), [ "err1", "err2", "err3", "err4" ].toString());
        assert(Date.now() - start >= 150);
      });
  });

  it("launches explorer with initial env vars", ()=>{
    mock(platform, "isWindows").returnWith(true);
    mock(platform, "getWindowsVersion").returnWith("10");
    mock(platform, "startProcess").resolveWith();

    process.env.SET_SOME_NEW_ENV_VAR = "should not be included in the explorer environment";
    platform.launchExplorer();
    assert.deepEqual(platform.startProcess.lastCall.args[3].env, originalEnv);
  });

  it("Retrieves the windows os description", ()=>{
    const osFlavor = "Microsoft Windows 10 Pro";
    const mockResponse = `Caption=${osFlavor}`;
    mock(childProcess, "spawnSync").returnWith({ stdout: mockResponse });
    assert.equal(platform.getWindowsOSCaption(), "Microsoft Windows 10 Pro");
  });

  it("Retrieves a default windows os description", ()=>{
    const mockResponse = "Microsoft Windows";
    mock(childProcess, "spawnSync").returnWith({ stdout: mockResponse });
    assert.equal(platform.getWindowsOSCaption(), "Microsoft Windows");
  });

  it("Handles errors when retrieving windows os description", ()=>{
    mock(childProcess, "spawnSync").throwWith(new Error("Command failed"));
    assert.equal(platform.getWindowsOSCaption(), "Microsoft Windows");
  });

  describe("getWindowsInstallationMode", ()=>{
    let existsSyncMock;

    beforeEach(()=>{
      mock(platform, "isWindows").returnWith(true);
      mock(platform, "getArch").returnWith("x64");
      existsSyncMock = mock(fs, "existsSync");
      process.env.LOCALAPPDATA = "C:\\Users\\TestUser\\AppData\\Local";
      process.env.ProgramFiles = "C:\\Program Files";
      process.env["ProgramFiles(x86)"] = "C:\\Program Files (x86)";
    });

    afterEach(()=>{
      delete process.env.LOCALAPPDATA;
      delete process.env.ProgramFiles;
      delete process.env["ProgramFiles(x86)"];
    });

    it("returns Single when installed in LocalAppData", ()=>{
      const localAppDataPath = path.join(process.env.LOCALAPPDATA, "rvplayer");
      existsSyncMock.callFn((path) => {
        return path === localAppDataPath;
      });

      assert.equal(platform.getWindowsInstallationMode(), "Single");
    });

    it("returns Multi when installed in Program Files (x64)", ()=>{
      mock(platform, "getArch").returnWith("x64");
      const programFilesPath = path.join(process.env.ProgramFiles, "rvplayer");
      existsSyncMock.callFn((path) => {
        return path === programFilesPath;
      });

      assert.equal(platform.getWindowsInstallationMode(), "Multi");
    });

    it("returns Multi when installed in Program Files (x86)", ()=>{
      mock(platform, "getArch").returnWith("x32");
      const programFilesPath = path.join(process.env["ProgramFiles(x86)"], "rvplayer");

      existsSyncMock.callFn((path) => {
        return path === programFilesPath;
      });

      const result = platform.getWindowsInstallationMode();
      assert.equal(result, "Multi");
    });

    it("returns Single as default when no installation is found", ()=>{
      existsSyncMock.returnWith(false);
      assert.equal(platform.getWindowsInstallationMode(), "Single");
    });

    it("handles errors gracefully and returns Single", ()=>{
      existsSyncMock.throwWith(new Error("File system error"));

      assert.equal(platform.getWindowsInstallationMode(), "Single");
    });
  });
});
