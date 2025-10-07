export const gasStationAbi = [
  {
    inputs: [
      { internalType: "address", name: "_tkGasDelegate", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  { inputs: [], name: "InvalidFunctionSelector", type: "error" },
  { inputs: [], name: "NoEthAllowed", type: "error" },
  { inputs: [], name: "NotDelegated", type: "error" },
  {
    inputs: [
      { internalType: "address", name: "_targetEoA", type: "address" },
      { internalType: "bytes", name: "_data", type: "bytes" },
    ],
    name: "approveThenExecute",
    outputs: [
      { internalType: "bool", name: "", type: "bool" },
      { internalType: "bytes", name: "", type: "bytes" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_targetEoA", type: "address" },
      { internalType: "bytes", name: "_signature", type: "bytes" },
      { internalType: "uint128", name: "_nonce", type: "uint128" },
    ],
    name: "burnNonce",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_targetEoA", type: "address" },
      { internalType: "bytes", name: "_data", type: "bytes" },
    ],
    name: "execute",
    outputs: [
      { internalType: "bool", name: "", type: "bool" },
      { internalType: "bytes", name: "", type: "bytes" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_targetEoA", type: "address" },
      { internalType: "address", name: "_to", type: "address" },
      { internalType: "uint256", name: "ethAmount", type: "uint256" },
      { internalType: "bytes", name: "_data", type: "bytes" },
    ],
    name: "execute",
    outputs: [
      { internalType: "bool", name: "", type: "bool" },
      { internalType: "bytes", name: "", type: "bytes" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_targetEoA", type: "address" },
      { internalType: "bytes", name: "_data", type: "bytes" },
    ],
    name: "executeBatch",
    outputs: [
      { internalType: "bool", name: "", type: "bool" },
      { internalType: "bytes[]", name: "", type: "bytes[]" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_targetEoA", type: "address" },
      { internalType: "bytes", name: "_data", type: "bytes" },
    ],
    name: "executeNoValue",
    outputs: [
      { internalType: "bool", name: "", type: "bool" },
      { internalType: "bytes", name: "", type: "bytes" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_targetEoA", type: "address" }],
    name: "getNonce",
    outputs: [{ internalType: "uint128", name: "", type: "uint128" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_targetEoA", type: "address" }],
    name: "isDelegated",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "tkGasDelegate",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  { stateMutability: "payable", type: "receive" },
] as const;
