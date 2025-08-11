---
"@turnkey/crypto": minor
---

Add `@turnkey/encoding` as a package dependency instead of a devDependency to `@turnkey/crypto`. This resolves an issue with transitive dependencies when devDependencies are not included in the artifact.
