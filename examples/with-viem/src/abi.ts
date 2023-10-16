export const abi = [
    {
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'owner', type: 'address' }],
      outputs: [{ name: 'balance', type: 'uint256' }],
    },
    {
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'collectionId', type: 'uint256' },
      ],
      outputs: [{ name: 'balance', type: 'uint256' }],
    },
    {
      name: 'tokenURI',
      type: 'function',
      stateMutability: 'pure',
      inputs: [{ name: 'id', type: 'uint256' }],
      outputs: [{ name: 'uri', type: 'string' }],
    },
    {
      name: 'safeTransferFrom',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
      ],
      outputs: [],
    },
  ] as const