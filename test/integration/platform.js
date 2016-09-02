const assert = require("assert");
const platform = require("../../platform.js");
const fs = require("fs");
const path = require("path");
global.log = global.log || {debug(){}};

describe("Platform", ()=>{
  describe("writeTextFileSync", ()=>{
    it("writes a file, creating directories as required", ()=>{
      try {fs.unlinkSync(path.join(process.cwd(), "testdir1", "testdir2", "testfile"))}catch(e){}
      try {fs.rmdir(path.join(process.cwd(), "testdir1", "testdir2"))}catch(e){}
      try {fs.rmdir(path.join(process.cwd(), "testdir1"))}catch(e){}
      assert.throws(fs.statSync.bind(null, path.join(process.cwd(), "testdir1")));

      platform.writeTextFileSync(path.join(process.cwd(), "testdir1", "testdir2", "testfile"), "test-text");
      assert.equal(fs.readFileSync(path.join(process.cwd(), "testdir1", "testdir2", "testfile")), "test-text");
    });
  });
});
