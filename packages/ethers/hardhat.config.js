require("@typechain/hardhat");
require("@nomicfoundation/hardhat-ethers");

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: "0.8.17",
  paths: {
    sources: "./src/__tests__/contracts/source",
    artifacts: "./src/__tests__/contracts/artifacts",
    cache: "./.cache",
  },
  typechain: {
    outDir: "src/__tests__/typechain",
    target: "ethers-v6",
    alwaysGenerateOverloads: false,
    externalArtifacts: [],
    dontOverrideCompile: false,
  },
};

module.exports = config;
