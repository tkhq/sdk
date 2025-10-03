export const gasStationAbi = [
  {
    inputs: [
      { internalType: "address", name: "_tkGasDelegate", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  { inputs: [], name: "NoEthAllowed", type: "error" },
  { inputs: [], name: "NotDelegated", type: "error" },
  { stateMutability: "nonpayable", type: "fallback" },
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
