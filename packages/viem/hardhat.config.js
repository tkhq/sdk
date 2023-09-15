require("@nomiclabs/hardhat-ethers");

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: "0.8.17",
  paths: {
    sources: "./src/__tests__/contracts/source",
    artifacts: "./src/__tests__/contracts/artifacts",
    cache: "./.cache",
  },
};

module.exports = config;
