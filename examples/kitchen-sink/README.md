# Kitchen Sink

A playground and example bank for making Turnkey requests in various ways:

- `src/http`: create Turnkey requests in the most primitive way, using `@turnkey/http` and a stamper (e.g. `@turnkey/api-key-stamper`)
- `src/sdk-server`: create Turnkey requests using `@turnkey/sdk-server`, which abstracts away some of the internals in the above method
- 🚧 WIP `src/sdk-browser`: create Turnkey requests using `@turnkey/sdk-browser`, which also abstracts away some of the internals from the `@turnkey/http` approach. Note that `@turnkey/sdk-browser` has an interface identical to `@turnkey/sdk-server`
