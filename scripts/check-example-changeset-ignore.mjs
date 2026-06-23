import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const changesetConfigPath = path.join(repoRoot, ".changeset/config.json");
const workspacePath = path.join(repoRoot, "pnpm-workspace.yaml");
const examplesDir = path.join(repoRoot, "examples");
const generatedDirectoryNames = new Set([
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

function readWorkspaceExampleExclusions() {
  const lines = fs.readFileSync(workspacePath, "utf8").split(/\r?\n/);
  const exclusions = [];
  let inPackages = false;
  let hasExamplesInclude = false;

  for (const line of lines) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }

    if (inPackages && line.trim() && /^\S/.test(line)) {
      break;
    }

    if (!inPackages) {
      continue;
    }

    const match = line.match(/^\s*-\s+["']?(.+?)["']?\s*$/);
    if (!match) {
      continue;
    }

    const pattern = match[1];
    if (pattern === "examples/**") {
      hasExamplesInclude = true;
    } else if (pattern.startsWith("!examples/")) {
      exclusions.push(pattern.slice(1));
    }
  }

  if (!hasExamplesInclude) {
    throw new Error("pnpm-workspace.yaml does not include examples/**");
  }

  return exclusions;
}

function workspacePatternMatches(relativeDir, pattern) {
  if (pattern.endsWith("/**")) {
    const base = pattern.slice(0, -3).replace(/\/$/, "");
    return relativeDir === base || relativeDir.startsWith(`${base}/`);
  }

  return relativeDir === pattern;
}

function walkPackageJsonFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (generatedDirectoryNames.has(entry.name)) {
        continue;
      }

      walkPackageJsonFiles(entryPath, files);
    } else if (entry.name === "package.json") {
      files.push(entryPath);
    }
  }

  return files;
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

const changesetConfig = readJson(changesetConfigPath);
const ignorePatterns = changesetConfig.ignore ?? [];

if (!Array.isArray(ignorePatterns)) {
  throw new Error(".changeset/config.json ignore must be an array");
}

const workspaceExclusions = readWorkspaceExampleExclusions();
const examplePackages = walkPackageJsonFiles(examplesDir)
  .map((filePath) => {
    const packageJson = readJson(filePath);
    const relativeFile = normalizePath(path.relative(repoRoot, filePath));
    const relativeDir = normalizePath(path.dirname(relativeFile));

    return {
      file: relativeFile,
      name: packageJson.name,
      relativeDir,
    };
  })
  .filter(({ relativeDir }) => {
    return !workspaceExclusions.some((pattern) =>
      workspacePatternMatches(relativeDir, pattern),
    );
  });

const packagesMissingIgnore = examplePackages.filter(({ name }) => {
  return typeof name !== "string" || !matchesAnyIgnore(name, ignorePatterns);
});

let hasFailure = false;

if (packagesMissingIgnore.length > 0) {
  hasFailure = true;
  console.error(
    "The following workspace example packages are not ignored by Changesets:",
  );
  for (const examplePackage of packagesMissingIgnore) {
    console.error(
      `- ${examplePackage.name ?? "(missing name)"} (${examplePackage.file})`,
    );
  }
  console.error(
    "Rename the example package to an ignored convention or add a narrow ignore pattern in .changeset/config.json.",
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
  `Verified ${examplePackages.length} workspace example packages are ignored by Changesets.`,
);
