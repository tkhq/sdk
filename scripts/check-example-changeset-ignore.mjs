import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const changesetConfigPath = path.join(repoRoot, ".changeset/config.json");
const generatedDirectoryNames = new Set([
  "__generated__",
  ".next",
  ".turbo",
  ".vercel",
  "build",
  "dist",
  "node_modules",
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function globToRegExp(glob) {
  let source = "^";

  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    const next = glob[i + 1];

    if (char === "*" && next === "*") {
      source += ".*";
      i += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else {
      source += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }

  source += "$";
  return new RegExp(source);
}

function matchesAnyIgnore(packageName, ignorePatterns) {
  return ignorePatterns.some((pattern) =>
    globToRegExp(pattern).test(packageName),
  );
}

function readWorkspacePackages() {
  return JSON.parse(
    execFileSync("pnpm", ["list", "--recursive", "--depth", "-1", "--json"], {
      cwd: repoRoot,
      encoding: "utf8",
    }),
  ).map((workspacePackage) => {
    const relativeDir = normalizePath(
      path.relative(repoRoot, workspacePackage.path),
    );

    return {
      name: workspacePackage.name,
      private: workspacePackage.private,
      relativeDir,
      packageJsonPath: `${relativeDir}/package.json`,
    };
  });
}

function isInDirectory(relativeDir, directory) {
  return relativeDir === directory || relativeDir.startsWith(`${directory}/`);
}

function isInGeneratedDirectory(relativeDir) {
  return relativeDir
    .split("/")
    .some((segment) => generatedDirectoryNames.has(segment));
}

const changesetConfig = readJson(changesetConfigPath);
const ignorePatterns = changesetConfig.ignore ?? [];

if (!Array.isArray(ignorePatterns)) {
  throw new Error(".changeset/config.json ignore must be an array");
}

const workspacePackages = readWorkspacePackages();
const examplePackages = workspacePackages.filter(({ relativeDir }) => {
  return (
    isInDirectory(relativeDir, "examples") &&
    !isInGeneratedDirectory(relativeDir)
  );
});

const packagesMissingIgnore = examplePackages.filter(({ name }) => {
  return typeof name !== "string" || !matchesAnyIgnore(name, ignorePatterns);
});

const publishablePackagesMatchingIgnore = workspacePackages.filter(
  ({ name, private: isPrivate, relativeDir }) => {
    return (
      isInDirectory(relativeDir, "packages") &&
      isPrivate !== true &&
      typeof name === "string" &&
      matchesAnyIgnore(name, ignorePatterns)
    );
  },
);

let hasFailure = false;

if (packagesMissingIgnore.length > 0) {
  hasFailure = true;
  console.error(
    "The following workspace example packages are not ignored by Changesets:",
  );
  for (const examplePackage of packagesMissingIgnore) {
    console.error(
      `- ${examplePackage.name ?? "(missing name)"} (${examplePackage.packageJsonPath})`,
    );
  }
  console.error(
    "Rename the example package to an ignored convention or add a narrow ignore pattern in .changeset/config.json.",
  );
}

if (publishablePackagesMatchingIgnore.length > 0) {
  hasFailure = true;
  console.error(
    "The following publishable packages unexpectedly match the Changesets ignore list:",
  );
  for (const publishablePackage of publishablePackagesMatchingIgnore) {
    console.error(
      `- ${publishablePackage.name} (${publishablePackage.packageJsonPath})`,
    );
  }
  console.error(
    "Narrow the ignore pattern so publishable packages continue to receive release changelogs and version bumps.",
  );
}

const trackedExampleChangelogs = execFileSync(
  "git",
  ["ls-files", "examples/**/CHANGELOG.md"],
  { cwd: repoRoot, encoding: "utf8" },
)
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((changelogPath) => fs.existsSync(path.join(repoRoot, changelogPath)));

if (trackedExampleChangelogs.length > 0) {
  hasFailure = true;
  console.error("Example changelogs must not exist in workspace examples:");
  for (const changelogPath of trackedExampleChangelogs) {
    console.error(`- ${changelogPath}`);
  }
}

if (hasFailure) {
  process.exit(1);
}

console.log(
  `Verified ${examplePackages.length} workspace example packages are ignored by Changesets and publishable packages are not ignored.`,
);
