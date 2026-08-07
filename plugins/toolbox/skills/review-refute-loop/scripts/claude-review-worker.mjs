#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function writeExitCode(exitFile, code) {
  const tmpFile = `${exitFile}.tmp.${process.pid}`;
  fs.writeFileSync(tmpFile, `${code}\n`, "utf8");
  fs.renameSync(tmpFile, exitFile);
}

const [mode, claudeBin, promptFile, rawFile, errorFile, exitFile, cwd] = process.argv.slice(2);
if (!mode || !claudeBin || !promptFile || !rawFile || !errorFile || !exitFile || !cwd) {
  fail("claude-review-worker.mjs requires mode, claude bin, prompt, raw output, error output, exit file, and cwd");
}

const scriptPath = fileURLToPath(import.meta.url);

if (mode === "launch") {
  const child = spawn(process.execPath, [scriptPath, "worker", claudeBin, promptFile, rawFile, errorFile, exitFile, cwd], {
    cwd,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  if (child.pid == null) {
    fail("failed to launch detached Claude review worker");
  }
  process.stdout.write(`${child.pid}\n`);
} else if (mode === "worker") {
  let prompt;
  try {
    prompt = fs.readFileSync(promptFile, "utf8");
    fs.mkdirSync(path.dirname(rawFile), { recursive: true });
  } catch (error) {
    process.stderr.write(`${error}\n`);
    writeExitCode(exitFile, 2);
    process.exit(2);
  }

  const outputFd = fs.openSync(rawFile, "w");
  const errorFd = fs.openSync(errorFile, "w");
  const child = spawn(
    claudeBin,
    [
      "-p",
      "--safe-mode",
      "--disable-slash-commands",
      "--disallowedTools",
      "Write,Edit,NotebookEdit",
      "--allowedTools",
      "Bash,Read,Grep,Glob,WebFetch,WebSearch",
    ],
    {
      cwd,
      env: process.env,
      stdio: ["pipe", outputFd, errorFd],
      windowsHide: true,
    },
  );

  // Keep prompt text out of argv so large diffs are not bounded by ARG_MAX.
  child.stdin.on("error", () => {});
  child.stdin.end(prompt);

  let settled = false;
  const finish = (code) => {
    if (settled) return;
    settled = true;
    fs.closeSync(outputFd);
    fs.closeSync(errorFd);
    writeExitCode(exitFile, Number.isInteger(code) ? code : 1);
  };

  child.once("error", () => finish(1));
  child.once("close", (code) => finish(code));
} else {
  fail(`unknown mode: ${mode}`);
}
