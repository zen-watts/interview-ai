import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const DEFAULT_URL = "http://localhost:3000";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function step(title) {
  console.log(`\n[STEP] ${title}`);
}

function info(message) {
  console.log(`[INFO] ${message}`);
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function warn(message) {
  console.warn(`[WARN] ${message}`);
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
}

function runVersionCheck(label, command, args = ["--version"]) {
  info(`Checking for ${label}...`);
  const result = spawnSync(command, args, {
    encoding: "utf-8",
    shell: true,
  });

  if (result.error || result.status !== 0) {
    fail(`${label} was not found or is not runnable.`);
    if (result.error?.message) {
      fail(result.error.message);
    }
    process.exit(1);
  }

  const output = (result.stdout || result.stderr || "").trim();
  ok(`Found ${label}: ${output || "version unavailable"}. Continuing.`);
}

function ensureEnvFile() {
  const envPath = join(process.cwd(), ".env.local");
  const examplePath = join(process.cwd(), ".env.example");

  info("Checking for .env.local...");
  if (existsSync(envPath)) {
    ok("Found .env.local. Continuing.");
  } else if (existsSync(examplePath)) {
    copyFileSync(examplePath, envPath);
    ok("No .env.local found. Created one from .env.example.");
  } else {
    writeFileSync(
      envPath,
      "OPENAI_API_KEY=\nOPENAI_MODEL=gpt-5.2\n# Optional\n# OPENAI_BASE_URL=\n",
      "utf-8",
    );
    ok("No .env.local or .env.example found. Created a baseline .env.local.");
  }

  const envText = readFileSync(envPath, "utf-8");
  const hasOpenAIKey = /^OPENAI_API_KEY=\S+/m.test(envText);
  if (!hasOpenAIKey) {
    warn("OPENAI_API_KEY is empty. The app will run, but AI calls will fail until you set it.");
  } else {
    ok("OPENAI_API_KEY appears to be set.");
  }
}

function runInstall() {
  info("Running npm install to ensure dependencies are present...");
  const install = spawnSync(npmCommand, ["install"], {
    stdio: "inherit",
    shell: true,
  });

  if (install.status !== 0) {
    fail("npm install failed. Please fix install errors and retry.");
    process.exit(1);
  }

  ok("Dependencies look good.");
}

function openBrowser(url) {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }

  if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }

  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

function runDevServer() {
  info("Starting dev server...");
  const child = spawn(npmCommand, ["run", "dev"], {
    stdio: ["inherit", "pipe", "pipe"],
    shell: true,
  });

  let browserOpened = false;

  const maybeOpenBrowser = (chunkText) => {
    if (browserOpened) {
      return;
    }

    if (!/ready|local:|localhost/i.test(chunkText)) {
      return;
    }

    const urlMatch = chunkText.match(/https?:\/\/[^\s)]+/i);
    const targetUrl = urlMatch?.[0] || DEFAULT_URL;

    try {
      openBrowser(targetUrl);
      browserOpened = true;
      ok(`Dev server looks ready. Opened ${targetUrl} in your browser.`);
    } catch (error) {
      warn(
        `Could not open browser automatically (${error instanceof Error ? error.message : "unknown error"}).`,
      );
      warn(`Please open ${targetUrl} manually.`);
    }
  };

  child.stdout.on("data", (chunk) => {
    const text = String(chunk);
    process.stdout.write(text);
    maybeOpenBrowser(text);
  });

  child.stderr.on("data", (chunk) => {
    const text = String(chunk);
    process.stderr.write(text);
    maybeOpenBrowser(text);
  });

  child.on("error", (error) => {
    fail(`Unable to start dev server: ${error.message}`);
    process.exit(1);
  });

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });

  process.on("SIGINT", () => {
    child.kill("SIGINT");
  });

  process.on("SIGTERM", () => {
    child.kill("SIGTERM");
  });
}

console.log("[START] Interview AI startup assistant");
step("Environment checks");
runVersionCheck("Node.js", "node");
runVersionCheck("npm", npmCommand);
ensureEnvFile();

step("Dependencies");
runInstall();

step("Run app");
runDevServer();
