const fs = require("fs").promises;
const path = require("path");

const changelogDirectoryPaths = [];
// const pages = [];

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
        // pages.push(
        //   formattedFilePath.replace("generated-docs/", "").replace(".mdx", "")
        // );
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
        // ignore the changelogs directory
        // if (file.name === "changelogs") return;
        let _pageGroup = await buildPageGroup(fullPath, {
          group: file.name,
          pages: [],
        }); // recurse into subdirectories
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
        if (file.name !== "changelogs") {
          let _pageGroup = await buildPageGroup(fullPath, {
            group: file.name,
            pages: [],
          }); // recurse into subdirectories

          pageGroup.pages.push(_pageGroup);
        }
      } else if (file.isFile() && fullPath.endsWith(".mdx")) {
        pageGroup.pages.push(fullPath);
      }
    }
    pageGroups.push(pageGroup);

    const docsJson = await fs.readFile(`${outputDir}/docs.json`, "utf8");
    const docsObject = JSON.parse(docsJson);
    const navigationTabs = docsObject.navigation.tabs.map((tab) => {
      if (tab.tab === "SDK Reference") {
        return {
          ...tab,
          groups: tab.groups.map((group) => {
            if (group.group === "SDK Reference") {
              return {
                ...group,
                pages: group.pages.map((page) => {
                  if (!page.group) {
                    return page;
                  }
                  const filteredPageGroup = pageGroups[0].pages[0].pages.find(
                    (p) => p.group === page.group
                  );

                  if (filteredPageGroup) {
                    return {
                      ...page,
                      pages: filteredPageGroup.pages,
                    };
                  }
                  return { ...page };
                }),
              };
            }
            return { ...group };
          }),
        };
      }
      return { ...tab };
    });

    // update the navigation tabs in generated-docs/docs.json with generated sdk pages
    docsObject.navigation.tabs = navigationTabs;
    await fs.writeFile(
      `${outputDir}/docs.json`,
      JSON.stringify(docsObject),
      "utf8"
    );
  } catch (error) {
    console.error(`Error createDocsStructure ${outputDir}:`, error);
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
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
