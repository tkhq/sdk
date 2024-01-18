require('@typechain/hardhat')
require("@nomicfoundation/hardhat-ethers");
require('@nomicfoundation/hardhat-chai-matchers')

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: "0.8.17",
  paths: {
    sources: "./src/__tests__/contracts/source",
    artifacts: "./src/__tests__/contracts/artifacts",
    cache: "./.cache",
  },
  typechain: {
    outDir: "./src/__tests__/typechain-types",
    target: 'ethers-v6',
  }
};

module.exports = config;
