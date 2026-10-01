// The base tsconfig uses node10 module resolution, which cannot read the
// polyfill's `exports` map. Declare the side-effect-free entry point here.
// Runtime resolution (Node, bundlers, wrangler) uses the `exports` map.
declare module "urlpattern-polyfill/urlpattern" {
  export const URLPattern: new (init: {
    pathname?: string;
    baseURL?: string;
  }) => { test(input: string): boolean };
}
