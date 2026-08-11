import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const MAX_MANIFEST_SIZE = 1_000_000;
const MAX_PACKAGE_COUNT = 100;
const MAX_TARBALL_SIZE = 100 * 1024 * 1024;
const PACKAGE_NAME_PATTERN = /^@turnkey\/[a-z0-9][a-z0-9._-]*$/;
const VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const TARBALL_PATTERN = /^[a-z0-9][a-z0-9._-]*\.tgz$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const [previewDirectoryArgument] = process.argv.slice(2);

if (!previewDirectoryArgument) {
  throw new Error(
    "Usage: node validate-preview-package-manifest.mjs <preview-directory>",
  );
}

const previewDirectory = resolve(previewDirectoryArgument);
const manifestPath = join(previewDirectory, "manifest.json");
const manifestStats = await lstat(manifestPath);

if (!manifestStats.isFile() || manifestStats.size > MAX_MANIFEST_SIZE) {
  throw new Error("The package manifest is not a valid file");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (
  !Array.isArray(manifest) ||
  manifest.length < 1 ||
  manifest.length > MAX_PACKAGE_COUNT
) {
  throw new Error("The package manifest has an invalid number of entries");
}

const directoryEntries = await readdir(previewDirectory, {
  withFileTypes: true,
});
const unexpectedEntries = directoryEntries.filter(
  (entry) =>
    !entry.isFile() ||
    (entry.name !== "manifest.json" && !entry.name.endsWith(".tgz")),
);

if (unexpectedEntries.length > 0) {
  throw new Error(`Unexpected artifact entry: ${unexpectedEntries[0].name}`);
}

const tarballNames = directoryEntries
  .map((entry) => entry.name)
  .filter((name) => name.endsWith(".tgz"))
  .sort();

if (tarballNames.length !== manifest.length) {
  throw new Error("The package manifest does not match the tarballs");
}

const normalizedManifest = [];
const packageNames = new Set();
const filenames = new Set();

for (const entry of manifest) {
  if (!entry || typeof entry !== "object") {
    throw new Error("The package manifest contains an invalid entry");
  }
  if (!PACKAGE_NAME_PATTERN.test(entry.name ?? "") || entry.name.length > 214) {
    throw new Error(`Invalid package name: ${entry.name}`);
  }
  if (
    !VERSION_PATTERN.test(entry.version ?? "") ||
    entry.version.length > 100
  ) {
    throw new Error(`Invalid package version: ${entry.version}`);
  }
  if (
    !TARBALL_PATTERN.test(entry.filename ?? "") ||
    basename(entry.filename) !== entry.filename ||
    entry.filename.length > 320
  ) {
    throw new Error(`Invalid tarball filename: ${entry.filename}`);
  }
  if (!SHA256_PATTERN.test(entry.sha256 ?? "")) {
    throw new Error(`Invalid tarball digest: ${entry.sha256}`);
  }
  if (packageNames.has(entry.name) || filenames.has(entry.filename)) {
    throw new Error("The package manifest contains a duplicate entry");
  }

  const expectedFilename = `${entry.name.slice(1).replace("/", "-")}-${entry.version}.tgz`;
  if (entry.filename !== expectedFilename) {
    throw new Error(`Unexpected tarball filename: ${entry.filename}`);
  }

  const tarballPath = join(previewDirectory, entry.filename);
  const fileStats = await lstat(tarballPath);
  if (!fileStats.isFile() || fileStats.size > MAX_TARBALL_SIZE) {
    throw new Error(`Tarball is not a valid file: ${entry.filename}`);
  }

  const contents = await readFile(tarballPath);
  const sha256 = createHash("sha256").update(contents).digest("hex");
  if (sha256 !== entry.sha256) {
    throw new Error(`Digest mismatch for ${entry.filename}`);
  }

  const packagedJson = JSON.parse(
    execFileSync("tar", ["-xOf", tarballPath, "package/package.json"], {
      encoding: "utf8",
      maxBuffer: MAX_MANIFEST_SIZE,
    }),
  );
  if (
    packagedJson.name !== entry.name ||
    packagedJson.version !== entry.version
  ) {
    throw new Error(`Package identity mismatch for ${entry.filename}`);
  }

  packageNames.add(entry.name);
  filenames.add(entry.filename);
  normalizedManifest.push({
    name: entry.name,
    version: entry.version,
    filename: entry.filename,
    size: fileStats.size,
    sha256,
  });
}

normalizedManifest.sort((left, right) => left.name.localeCompare(right.name));
process.stdout.write(
  Buffer.from(JSON.stringify(normalizedManifest)).toString("base64"),
);
