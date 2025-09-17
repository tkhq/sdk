export const gassyStationAbi = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "MAX_BATCH_SIZE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "burnNonce",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "burnNonce",
    "inputs": [
      {
        "name": "_nonce",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_signature",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "burnTimeboxedCounter",
    "inputs": [
      {
        "name": "_counter",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_sender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_signature",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "burnTimeboxedCounter",
    "inputs": [
      {
        "name": "_sender",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "eip712Domain",
    "inputs": [],
    "outputs": [
      {
        "name": "fields",
        "type": "bytes1",
        "internalType": "bytes1"
      },
      {
        "name": "name",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "version",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "chainId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "verifyingContract",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "salt",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "extensions",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "execute",
    "inputs": [
      {
        "name": "_nonce",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_outputContract",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_ethAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_arguments",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "_signature",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "execute",
    "inputs": [
      {
        "name": "_nonce",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_outputContract",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_arguments",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "_signature",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "executeBatch",
    "inputs": [
      {
        "name": "_nonce",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_executions",
        "type": "tuple[]",
        "internalType": "struct IBatchExecution.Execution[]",
        "components": [
          {
            "name": "outputContract",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "ethAmount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "arguments",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      },
      {
        "name": "_signature",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "",
        "type": "bytes[]",
        "internalType": "bytes[]"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "executeBatchTimeboxed",
    "inputs": [
      {
        "name": "_counter",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_deadline",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_outputContract",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_executions",
        "type": "tuple[]",
        "internalType": "struct IBatchExecution.Execution[]",
        "components": [
          {
            "name": "outputContract",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "ethAmount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "arguments",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      },
      {
        "name": "_signature",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "",
        "type": "bytes[]",
        "internalType": "bytes[]"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "executeBatchTimeboxedArbitrary",
    "inputs": [
      {
        "name": "_counter",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_deadline",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_executions",
        "type": "tuple[]",
        "internalType": "struct IBatchExecution.Execution[]",
        "components": [
          {
            "name": "outputContract",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "ethAmount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "arguments",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      },
      {
        "name": "_signature",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "",
        "type": "bytes[]",
        "internalType": "bytes[]"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "executeTimeboxed",
    "inputs": [
      {
        "name": "_counter",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_deadline",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_outputContract",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_arguments",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "_signature",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "executeTimeboxed",
    "inputs": [
      {
        "name": "_counter",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_deadline",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_outputContract",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_ethAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_arguments",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "_signature",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "executeTimeboxedArbitrary",
    "inputs": [
      {
        "name": "_counter",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_deadline",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_outputContract",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_ethAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_arguments",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "_signature",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "gassy",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract Gassy"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hashArbitraryTimeboxedExecution",
    "inputs": [
      {
        "name": "_counter",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_deadline",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_sender",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hashBatchExecution",
    "inputs": [
      {
        "name": "_nonce",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_executions",
        "type": "tuple[]",
        "internalType": "struct IBatchExecution.Execution[]",
        "components": [
          {
            "name": "outputContract",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "ethAmount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "arguments",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hashBurnNonce",
    "inputs": [
      {
        "name": "_nonce",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hashBurnTimeboxedCounter",
    "inputs": [
      {
        "name": "_counter",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_sender",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hashExecution",
    "inputs": [
      {
        "name": "_nonce",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_outputContract",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_ethAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_arguments",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hashTimeboxedExecution",
    "inputs": [
      {
        "name": "_counter",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_deadline",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "_sender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_outputContract",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nonce",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "timeboxedCounter",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "EIP712DomainChanged",
    "inputs": [],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "BatchSizeExceeded",
    "inputs": []
  },
  {
    "type": "error",
    "name": "DeadlineExceeded",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ECDSAInvalidSignature",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ECDSAInvalidSignatureLength",
    "inputs": [
      {
        "name": "length",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ECDSAInvalidSignatureS",
    "inputs": [
      {
        "name": "s",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidCounter",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidNonce",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidOutputContract",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidShortString",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SenderMustBeTxOrigin",
    "inputs": []
  },
  {
    "type": "error",
    "name": "StringTooLong",
    "inputs": [
      {
        "name": "str",
        "type": "string",
        "internalType": "string"
      }
    ]
  }
]
 as const;
export type GassyStationAbi = typeof gassyStationAbi;
