import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  chmod,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const source = path.join(root, ".build-artifacts", "tap-mppx");
const tool = path.join(root, ".build-artifacts", "tap-pnpm-12.16.1");
const toolArchive = path.join(root, ".build-artifacts", "pnpm-12.16.1.tgz");
const toolIntegrity =
  "sha512-CR0d7nknV1Zhsl2rPCrjHK/BxU1rce1qZgDPDByxBDSkR+rhQBXxsj4ua+3u1535SpMuIWTSgyKA3OP7MvZW0Q==";
const patch = fileURLToPath(
  new URL("../patches/mppx-remote-signers.patch", import.meta.url),
);
const base = "f253219dd2ee4702c7917e288845bd3b1d70cb25";
const patchSha256 =
  "47b990aacc573564b3a341b189d29bdcfd9bc53ef27d9d839ccd7e56cafe72bc";
const diffSha256 =
  "362f266cf50c7ba09b9d13b22d5176b07310853a368df31768d32ca426b66f9c";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

function run(command, args, capture = false) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  env.PATH = `${path.join(tool, "bin")}${path.delimiter}${env.PATH ?? ""}`;
  const result = spawnSync(command, args, {
    cwd: source,
    env,
    shell: false,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
    timeout: 600_000,
    maxBuffer: 1_048_576,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `TAP dependency preparation failed: ${command} ${args.join(" ")}`,
    );
  return result.stdout;
}

async function prepareTool() {
  let archive;
  if (existsSync(toolArchive)) archive = await readFile(toolArchive);
  else {
    const response = await fetch(
      "https://registry.npmjs.org/pnpm/-/pnpm-12.16.1.tgz",
      {
        redirect: "error",
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (
      !response.ok ||
      Number(response.headers.get("content-length")) > 33_554_432
    )
      throw new Error("The pinned pnpm distribution could not be downloaded.");
    archive = Buffer.from(await response.arrayBuffer());
  }
  if (
    archive.length > 33_554_432 ||
    `sha512-${createHash("sha512").update(archive).digest("base64")}` !==
      toolIntegrity
  )
    throw new Error("The pinned pnpm distribution failed its integrity check.");
  await writeFile(toolArchive, archive);
  await rm(tool, { recursive: true, force: true });
  await mkdir(path.join(tool, "bin"), { recursive: true });
  run("tar", ["-xzf", toolArchive, "-C", tool]);
  const executable = path.join(tool, "package", "bin", "pnpm.mjs");
  // Nested pnpm commands in upstream's build must select the same pinned tool.
  await chmod(executable, 0o755);
  await symlink(executable, path.join(tool, "bin", "pnpm"));
  return executable;
}

function checkSource() {
  if (run("git", ["rev-parse", "HEAD"], true).trim() !== base)
    throw new Error(
      "The TAP dependency checkout does not match its pinned base.",
    );
  const diff = run(
    "git",
    ["diff", "--no-ext-diff", "--binary", "--full-index", base],
    true,
  );
  if (hash(diff) !== diffSha256)
    throw new Error(
      "The TAP dependency differs from the reviewed source patch.",
    );
  if (run("git", ["ls-files", "--others", "--exclude-standard"], true).trim())
    throw new Error("The TAP dependency contains unreviewed source files.");
}

try {
  if (hash(await readFile(patch)) !== patchSha256)
    throw new Error("The upstream source patch failed its integrity check.");
  await mkdir(source, { recursive: true });
  if (!existsSync(path.join(source, ".git"))) {
    run("git", ["init", "--quiet"]);
    run("git", ["config", "core.autocrlf", "false"]);
    run("git", ["remote", "add", "origin", "https://github.com/wevm/mppx.git"]);
    run("git", ["fetch", "--quiet", "--depth=1", "origin", base]);
    run("git", ["checkout", "--quiet", "--detach", "FETCH_HEAD"]);
    run("git", ["apply", "--check", patch]);
    run("git", ["apply", "--index", patch]);
  }
  checkSource();
  const pnpm = await prepareTool();
  if (run(process.execPath, [pnpm, "--version"], true).trim() !== "12.16.1")
    throw new Error(
      "TAP dependency preparation requires upstream's pinned pnpm 12.16.1.",
    );
  run(process.execPath, [pnpm, "install", "--frozen-lockfile"]);
  run(process.execPath, [pnpm, "build"]);
  checkSource();
  console.log(
    "Prepared the pinned mppx source with the reviewed remote-signer patch.",
  );
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "TAP dependency preparation failed.",
  );
  process.exitCode = 1;
}
