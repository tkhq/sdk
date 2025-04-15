const fs = require("fs").promises;
const path = require("path");

const changelogDirectoryPaths = [];

async function addFrontmatterToMdxFiles(dir, directoryName) {
  try {
    const files = await fs.readdir(dir, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        // lowercase the CHANGELOG directory name
        if (file.name === "CHANGELOG") {
          const changelogDir = path.join(dir, file.name.toLowerCase());
          await fs.rename(fullPath, changelogDir);
          changelogDirectoryPaths.push(changelogDir);
        } else {
          await addFrontmatterToMdxFiles(fullPath, file.name); // Recurse into subdirectories
        }
      } else if (file.isFile() && fullPath.endsWith(".mdx")) {
        // read the content of the file into memory
        const content = await fs.readFile(fullPath, "utf8");

        // Generate YAML frontmatter
        const title = path.basename(fullPath, ".mdx").replace(/[-_]/g, " ");

        /**
         * parse the directory name to get the title
         * if the directory name is not present, use the file name
         * if the directory name is present, attempt to split it by "-".
         * the root level directory names for our sdk packages may contain hyphens
         * if they do, we want to format the directory name to be more readable and set it as the title
         * for example: "react-native-passkey-stamper" becomes "React Native Passkey Stamper"
         */
        const directoryNameParts = directoryName?.split("-") || [title];
        const formattedDirectoryName = directoryNameParts
          .map((part) => {
            if (part === "sdk" || part === "api") {
              return part.toUpperCase();
            }
            return part.charAt(0).toUpperCase() + part.slice(1);
          })
          .join(" ");

        // this indentation is required for Mintlify to process the frontmatter correctly
        const frontmatter = `---
title: "${formattedDirectoryName}"
mode: wide
---
  
`;
        let formattedContent = content;

        /**
         * TypeDoc automatically inserts a heading at the start of the file
         * that contains backlinks to the documentation that are not compatible with Mintlify
         * we want to remove everything before the first '#' sign
         */
        const hashIndex = formattedContent.indexOf("#");

        if (hashIndex > 0) {
          // Keep content from '#' onward
          formattedContent = formattedContent.slice(hashIndex);
        }

        // Prepend frontmatter (avoid duplicating if already present)
        if (!formattedContent.startsWith("---")) {
          formattedContent = frontmatter + formattedContent;
        }

        // Remove ".mdx" from the content to support links to other files in Mintlify
        if (formattedContent.includes(".mdx")) {
          formattedContent = formattedContent.replaceAll(".mdx", "");
        }

        // lowercase all references to README in the content
        if (formattedContent.includes("README")) {
          formattedContent = formattedContent.replaceAll("README", "readme");
        }

        // lowercase all references to CHANGELOG in the content
        if (formattedContent.includes("CHANGELOG")) {
          formattedContent = formattedContent.replaceAll(
            "CHANGELOG",
            "changelog"
          );
        }

        // remove the changelog reference links from the content
        if (formattedContent.includes("- [changelog](changelog/readme)")) {
          formattedContent = formattedContent.replaceAll(
            "- [changelog](changelog/readme)",
            ""
          );
        }

        const formattedFileName = file.name.toLowerCase();
        file.name = formattedFileName;
        const formattedFilePath = path.join(dir, formattedFileName);

        await fs.writeFile(formattedFilePath, formattedContent);
        await fs.rename(fullPath, formattedFilePath); // rename the file to lowercase
      }
    }
  } catch (error) {
    console.error(`Error adding frontmatter to ${dir}:`, error);
  }
}

async function createChangelogDirectories(outputDir) {
  try {
    const changelogPaths = [];
    for (const changelogDir of changelogDirectoryPaths) {
      const newChangelogDir = changelogDir
        .replace("/changelog", "")
        .replace("/sdks/", "/changelogs/");

      try {
        // create new changelog directory for the given package
        await fs.rm(newChangelogDir, { recursive: true, force: true });
        await fs.mkdir(newChangelogDir, { recursive: true });

        // move the directory
        await fs.rename(changelogDir, newChangelogDir);

        changelogPaths.push(
          `${newChangelogDir.replace("generated-docs/", "")}/readme`
        );
      } catch (error) {
        console.error(`Error accessing ${changelogDir}: ${error.message}`);
      }
    }

    const docsJson = await fs.readFile(`${outputDir}/docs.json`, "utf8");
    const docsObject = JSON.parse(docsJson);
    const navigationTabs = docsObject.navigation.tabs.map((tab) => {
      if (tab.tab === "Changelogs") {
        return {
          ...tab,
          pages: tab.pages.map((page) => {
            if (page.group === "Changelogs") {
              return {
                ...page,
                pages: page.pages.map((page) => {
                  if (page.group === "SDK changelogs") {
                    return {
                      ...page,
                      pages: [...new Set([...changelogPaths, ...page.pages])],
                    };
                  }
                  return { ...page };
                }),
              };
            }
            return { ...page };
          }),
        };
      }
      return { ...tab };
    });

    // update the navigation tabs in generated-docs/docs.json with the new changelog paths
    docsObject.navigation.tabs = navigationTabs;
    await fs.writeFile(
      `${outputDir}/docs.json`,
      JSON.stringify(docsObject),
      "utf8"
    );
  } catch (error) {
    console.error("Error creating changelog directories:", error);
  }
}

async function createDocsStructure(outputDir) {
  const pageGroups = [];

  const buildPageGroup = async (dir, pageGroup) => {
    const files = await fs.readdir(dir, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        // recurse into subdirectories
        let _pageGroup = await buildPageGroup(fullPath, {
          group: file.name,
          pages: [],
        });

        pageGroup.pages.push(_pageGroup);
      } else if (file.isFile() && fullPath.endsWith(".mdx")) {
        pageGroup.pages.push(
          fullPath.replace("generated-docs/", "").replace(".mdx", "")
        );
      }
    }
    return pageGroup;
  };

  try {
    const files = await fs.readdir(outputDir, { withFileTypes: true });
    let pageGroup = {
      group: "SDK Reference",
      pages: [],
    };
    for (const file of files) {
      const fullPath = path.join(outputDir, file.name);

      if (file.isDirectory()) {
        // ignore the changelogs directory
        if (file.name !== "changelogs") {
          // recurse into subdirectories
          let _pageGroup = await buildPageGroup(fullPath, {
            group: file.name,
            pages: [],
          });

          pageGroup.pages.push(_pageGroup);
        }
      } else if (file.isFile() && fullPath.endsWith(".mdx")) {
        pageGroup.pages.push(fullPath);
      }
    }
    pageGroups.push(pageGroup);

    await fs.writeFile(
      `${outputDir}/sdk-docs.json`,
      JSON.stringify(pageGroups),
      "utf8"
    );
  } catch (error) {
    console.error(`Error createDocsStructure ${outputDir}:`, error);
  }
}

async function mergeSdkReferenceGroups(outputDir = "generated-docs") {
  try {
    // docs.json represents the mintlify structure in tkhq/docs
    const docsData = JSON.parse(
      await fs.readFile(`${outputDir}/docs.json`, "utf8")
    );

    // sdk-docs.json represents the structure generated TypeDoc
    const sdkDocsData = JSON.parse(
      await fs.readFile(`${outputDir}/sdk-docs.json`, "utf8")
    );

    // extract the "SDK Reference" tab group from docs.json
    const docsSdkRef = docsData.navigation.tabs
      .find((tab) => tab.tab === "SDK Reference")
      ?.groups.find((group) => group.group === "SDK Reference");
    if (!docsSdkRef) {
      throw new Error("SDK Reference group not found in docs.json");
    }

    // extract the "SDK Reference" tab group from sdk-docs.json
    const sdkDocsSdkRef = sdkDocsData.find(
      (group) => group.group === "SDK Reference"
    );
    if (!sdkDocsSdkRef) {
      throw new Error("SDK Reference group not found in sdk-docs.json");
    }

    // collect string pages and groups, separating top-level and nested / grouped pages
    function collectPagesAndGroups(pages) {
      const topLevelStringPages = new Set();
      const groupContainedPages = new Set();
      const nestedGroups = [];

      function processPages(items, isTopLevel = true) {
        if (!Array.isArray(items)) {
          console.warn(`Expected pages to be an array, got ${typeof items}`);
          return;
        }

        for (const item of items) {
          // some pages are string paths e.g. "sdks/migration-path"
          if (typeof item === "string") {
            if (isTopLevel) {
              topLevelStringPages.add(item);
            } else {
              groupContainedPages.add(item);
            }
          } else if (item.group && Array.isArray(item.pages)) {
            nestedGroups.push({
              group: item.group,
              pages: item.pages,
            });
            processPages(item.pages, false);
          }
        }
      }

      processPages(pages);
      return {
        topLevelStringPages: Array.from(topLevelStringPages),
        groupContainedPages: Array.from(groupContainedPages),
        nestedGroups,
      };
    }

    // get pages from docs.json
    const docsPages = collectPagesAndGroups(docsSdkRef.pages);

    // get pages from sdk-docs.json
    const sdkDocsPages = collectPagesAndGroups(sdkDocsSdkRef.pages);

    // Start with sdk-docs.json's pages to preserve its structure
    const mergedPages = [...sdkDocsSdkRef.pages]; // includes { group: "sdks", pages: [...] }

    // merge top-level string pages from docs.json, excluding those in sdk-docs.json or docs.json groups
    const allSdkDocsPages = new Set([
      ...sdkDocsPages.topLevelStringPages,
      ...sdkDocsPages.groupContainedPages,
    ]);
    const docsUniquePages = docsPages.topLevelStringPages.filter(
      (page) =>
        !allSdkDocsPages.has(page) &&
        !docsPages.groupContainedPages.includes(page)
    );

    // add unique top-level string pages from docs.json, ensuring no duplicates
    const mergedStringPages = new Set(docsUniquePages);
    mergedPages.forEach((page) => {
      if (typeof page === "string") {
        mergedStringPages.add(page);
      }
    });

    // replace top-level string pages with deduplicated set
    const finalMergedPages = mergedPages.filter(
      (page) => typeof page !== "string"
    );
    finalMergedPages.push(...Array.from(mergedStringPages));

    // merge nested groups from docs.json, preserving structure and deduplicating pages
    const sdkDocsGroupNames = new Set(
      sdkDocsPages.nestedGroups.map((g) => g.group)
    );
    for (const docsGroup of docsPages.nestedGroups) {
      if (!sdkDocsGroupNames.has(docsGroup.group)) {
        // preserve unique groups as-is (e.g., Swift, Web3 Libraries, Advanced) from docs.json
        finalMergedPages.push({
          group: docsGroup.group,
          pages: docsGroup.pages,
        });
      } else {
        // merge pages from overlapping groups, preserving sdk-docs.json's structure
        let targetGroup = null;
        // check for the group in mergedPages (top level or under "sdks")
        for (const page of finalMergedPages) {
          if (typeof page !== "string" && page.group === docsGroup.group) {
            targetGroup = page;
            break;
          }
          if (typeof page !== "string" && page.group === "sdks") {
            targetGroup = page.pages.find(
              (p) => typeof p !== "string" && p.group === docsGroup.group
            );
            if (targetGroup) break;
          }
        }
        if (targetGroup) {
          // deduplicate pages within the target group
          const existingPages = new Set(
            collectPagesAndGroups(targetGroup.pages).groupContainedPages
          );
          const newPages = [];
          for (const item of docsGroup.pages) {
            if (typeof item === "string") {
              if (!existingPages.has(item)) {
                newPages.push(item);
                existingPages.add(item);
              }
            } else if (item.group && Array.isArray(item.pages)) {
              // check if subgroup exists
              const existingSubgroup = targetGroup.pages.find(
                (p) => typeof p !== "string" && p.group === item.group
              );
              if (!existingSubgroup) {
                newPages.push(item);
              } else {
                // merge subgroup pages and deduplicate
                const subExistingPages = new Set(
                  collectPagesAndGroups(
                    existingSubgroup.pages
                  ).groupContainedPages
                );
                const subNewPages = item.pages.filter(
                  (subItem) =>
                    typeof subItem !== "string" ||
                    !subExistingPages.has(subItem)
                );
                existingSubgroup.pages.push(...subNewPages);
              }
            }
          }
          targetGroup.pages.push(...newPages);
        }
      }
    }

    // deduplicate pages within each group in finalMergedPages
    function deduplicateGroupPages(group) {
      if (!group.pages) return;
      const seenPages = new Set();
      const deduplicatedPages = [];
      for (const item of group.pages) {
        if (typeof item === "string") {
          if (!seenPages.has(item)) {
            seenPages.add(item);
            deduplicatedPages.push(item);
          }
        } else if (item.group && Array.isArray(item.pages)) {
          deduplicateGroupPages(item); // recursively deduplicate subgroups
          const groupKey = JSON.stringify({
            group: item.group,
            pages: item.pages,
          });
          if (!seenPages.has(groupKey)) {
            seenPages.add(groupKey);
            deduplicatedPages.push(item);
          }
        }
      }
      group.pages = deduplicatedPages;
    }

    finalMergedPages.forEach((page) => {
      if (typeof page !== "string") {
        deduplicateGroupPages(page);
      }
    });

    // Create merged group structure
    const mergedGroup = {
      group: "SDK Reference",
      pages: finalMergedPages,
    };

    // wrap generated sdk output in docs.json-compatible structure
    const mergedOutput = {
      navigation: {
        tabs: [
          {
            tab: "SDK Reference",
            groups: [mergedGroup],
          },
          // preserve Changelogs tab and any others
          ...docsData.navigation.tabs.filter(
            (tab) => tab.tab !== "SDK Reference"
          ),
        ],
      },
    };

    // write to output file
    const outputJsonPath = path.join(outputDir, "docs.json");
    const dir = path.dirname(outputJsonPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      outputJsonPath,
      JSON.stringify(mergedOutput, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error(`Error merging SDK Reference groups: ${error.message}`);
    throw error;
  }
}

async function main() {
  const outputDir = "generated-docs"; // match the typedoc.json's "out" directory
  try {
    await addFrontmatterToMdxFiles(outputDir);
    console.log("Frontmatter added to SDK MDX files successfully.");

    await createChangelogDirectories(outputDir);
    console.log("Changelog directories created successfully.");

    await addFrontmatterToMdxFiles(path.join(outputDir, "changelogs"));
    console.log("Frontmatter added to Changelog MDX files successfully.");

    await createDocsStructure(outputDir);
    console.log("Docs structure created successfully.");

    await mergeSdkReferenceGroups(outputDir);
    console.log("SDK Reference groups merged successfully.");
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
