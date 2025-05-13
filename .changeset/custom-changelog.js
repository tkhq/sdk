const { default: githubChangelog } = require("@changesets/changelog-github");

module.exports = {
  async getReleaseLine(changeset, type, options) {
    // call the original getReleaseLine from @changesets/changelog-github
    const releaseLine = await githubChangelog.getReleaseLine(
      changeset,
      type,
      options
    );

    // replace "Thanks [username]!" with "Author [username]"
    console.log("Original release line:", releaseLine);
    const regex = /Thanks (\[@\w+\]\(https:\/\/github\.com\/\w+\))!/;
    const updatedReleaseLine = releaseLine.replace(regex, "Author $1");

    console.log("Updated release line:", updatedReleaseLine);
    return updatedReleaseLine;
  },
  async getDependencyReleaseLine(changesets, dependenciesUpdated, options) {
    // reuse the original dependency release line logic
    return githubChangelog.getDependencyReleaseLine(
      changesets,
      dependenciesUpdated,
      options
    );
  },
};
