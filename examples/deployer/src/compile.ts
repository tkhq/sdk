const path = require("path");
const fs = require("fs");
const solc = require("solc");

const source = fs.readFileSync(
  path.resolve(__dirname, "./contracts", "HelloWorld.sol"),
  "utf8"
);

const input = {
  language: "Solidity",
  sources: {
    "HelloWorld.sol": {
      content: source,
    },
  },
  // default settings; feel free to configure
  settings: {
    outputSelection: {
      "*": {
        "*": ["*"],
      },
    },
  },
};

export default function compile() {
  return JSON.parse(solc.compile(JSON.stringify(input))).contracts[
    "HelloWorld.sol"
  ].HelloWorld;
}
