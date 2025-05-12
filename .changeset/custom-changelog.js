const { default: githubChangelog } = require("@changesets/changelog-github");

module.exports = {
  async getReleaseLine(changeset, type, options) {
    // call the original getReleaseLine from @changesets/changelog-github
    const releaseLine = await githubChangelog.getReleaseLine(
      changeset,
      type,
      options,
    );

    // replace "Thanks [username]!" with "Author [username]"
    return releaseLine.replace(/Thanks (\[@.*\])!/, "Author $1");
  },
  async getDependencyReleaseLine(changesets, dependenciesUpdated, options) {
    // reuse the original dependency release line logic
    return githubChangelog.getDependencyReleaseLine(
      changesets,
      dependenciesUpdated,
      options,
    );
  },
};
