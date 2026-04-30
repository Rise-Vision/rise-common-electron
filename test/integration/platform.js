const assert = require("assert");
const platform = require("../../platform.js");
const fs = require("fs");
const path = require("path");
global.log = global.log || {debug(){}};

describe("Platform", ()=>{
  describe("writeTextFileSync", ()=>{
    it("writes a file, creating directories as required", ()=>{
      var root = path.join(process.cwd(), "testdir1");
      try {
        fs.rmSync(root, { recursive: true, force: true });
      } catch (e) { /* absent */ }
      assert.throws(()=>{ fs.statSync(root); });

      platform.writeTextFileSync(path.join(root, "testdir2", "testfile"), "test-text");
      assert.equal(fs.readFileSync(path.join(root, "testdir2", "testfile")), "test-text");
    });
  });
});
