---
"@turnkey/http": major
"@turnkey/cosmjs": patch
"@turnkey/ethers": patch
---

This breaking change updates generated code to be shorter and more intuitive to read:

- generated fetchers do not include the HTTP method in their name. For example `useGetGetActivity` is now `useGetActivity`, and `usePostSignTransaction` is `useSignTransaction`.
- input types follow the same convention (no HTTP method in the name): `TPostCreatePrivateKeysInput` is now `TCreatePrivateKeysInput`.
- the "federated" request helpers introduced in `0.18.0` are now named "signed" requests to better reflect what they are. `FederatedRequest` is now `SignedRequest`, and generated types follow. For example: `federatedPostCreatePrivateKeys` is now `signCreatePrivateKeys`, `federatedGetGetActivity` is now `signGetActivity`, and so on.

The name updates should be automatically suggested if you use VSCode since the new names are simply shorter versions of the old one.