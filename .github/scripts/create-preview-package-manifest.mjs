import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const PACKAGE_NAME_PATTERN = /^@turnkey\/[a-z0-9][a-z0-9._-]*$/;
const VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const TARBALL_PATTERN = /^[a-z0-9][a-z0-9._-]*\.tgz$/;

const [tarballDirectoryArgument] = process.argv.slice(2);

if (!tarballDirectoryArgument) {
  throw new Error(
    "Usage: node create-preview-package-manifest.mjs <tarball-directory>",
  );
}

const repositoryRoot = resolve(import.meta.dirname, "../..");
const packagesDirectory = join(repositoryRoot, "packages");
const tarballDirectory = resolve(tarballDirectoryArgument);

const packageDirectories = await readdir(packagesDirectory, {
  withFileTypes: true,
});
const expectedPackages = new Map();

for (const directory of packageDirectories) {
  if (!directory.isDirectory()) {
    continue;
  }

  const packageJsonPath = join(
    packagesDirectory,
    directory.name,
    "package.json",
  );
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

  if (packageJson.private === true) {
    continue;
  }

  validatePackageIdentity(packageJson, packageJsonPath);
  expectedPackages.set(packageJson.name, packageJson.version);
}

const directoryEntries = await readdir(tarballDirectory, {
  withFileTypes: true,
});
const tarballNames = directoryEntries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".tgz"))
  .map((entry) => entry.name)
  .sort();

if (tarballNames.length !== expectedPackages.size) {
  throw new Error(
    `Expected ${expectedPackages.size} tarballs but found ${tarballNames.length}`,
  );
}

const manifest = [];
const packagedNames = new Set();

for (const tarballName of tarballNames) {
  if (
    !TARBALL_PATTERN.test(tarballName) ||
    basename(tarballName) !== tarballName
  ) {
    throw new Error(`Invalid tarball filename: ${tarballName}`);
  }

  const tarballPath = join(tarballDirectory, tarballName);
  const packageJson = readPackageJsonFromTarball(tarballPath);
  validatePackageIdentity(packageJson, tarballPath);

  const expectedVersion = expectedPackages.get(packageJson.name);
  if (!expectedVersion) {
    throw new Error(`Unexpected package in tarball: ${packageJson.name}`);
  }
  if (expectedVersion !== packageJson.version) {
    throw new Error(
      `Version mismatch for ${packageJson.name}: expected ${expectedVersion}, found ${packageJson.version}`,
    );
  }
  if (packagedNames.has(packageJson.name)) {
    throw new Error(`Duplicate package tarball: ${packageJson.name}`);
  }

  packagedNames.add(packageJson.name);
  const contents = await readFile(tarballPath);
  const fileStats = await stat(tarballPath);

  manifest.push({
    name: packageJson.name,
    version: packageJson.version,
    filename: tarballName,
    size: fileStats.size,
    sha256: createHash("sha256").update(contents).digest("hex"),
  });
}

for (const expectedName of expectedPackages.keys()) {
  if (!packagedNames.has(expectedName)) {
    throw new Error(`Missing package tarball: ${expectedName}`);
  }
}

manifest.sort((left, right) => left.name.localeCompare(right.name));
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);

function readPackageJsonFromTarball(tarballPath) {
  const result = spawnSync(
    "tar",
    ["-xOf", tarballPath, "package/package.json"],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(
      `Could not read package.json from ${tarballPath}: ${result.stderr.trim()}`,
    );
  }

  return JSON.parse(result.stdout);
}

function validatePackageIdentity(packageJson, source) {
  if (!PACKAGE_NAME_PATTERN.test(packageJson.name ?? "")) {
    throw new Error(`Invalid package name in ${source}: ${packageJson.name}`);
  }
  if (!VERSION_PATTERN.test(packageJson.version ?? "")) {
    throw new Error(
      `Invalid package version in ${source}: ${packageJson.version}`,
    );
  }
}
