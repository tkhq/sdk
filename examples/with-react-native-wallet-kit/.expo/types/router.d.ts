/* eslint-disable */
import * as Router from "expo-router";

export * from "expo-router";

declare module "expo-router" {
  export namespace ExpoRouter {
    export interface __routes<T extends string | object = string> {
      hrefInputParams:
        | {
            pathname: Router.RelativePathString;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: Router.ExternalPathString;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/`; params?: Router.UnknownInputParams }
        | { pathname: `/modal`; params?: Router.UnknownInputParams }
        | { pathname: `/otp`; params?: Router.UnknownInputParams }
        | { pathname: `/_sitemap`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(main)"}/explore` | `/explore`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(main)"}` | `/`;
            params?: Router.UnknownInputParams;
          };
      hrefOutputParams:
        | {
            pathname: Router.RelativePathString;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: Router.ExternalPathString;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `/`; params?: Router.UnknownOutputParams }
        | { pathname: `/modal`; params?: Router.UnknownOutputParams }
        | { pathname: `/otp`; params?: Router.UnknownOutputParams }
        | { pathname: `/_sitemap`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${"/(main)"}/explore` | `/explore`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${"/(main)"}` | `/`;
            params?: Router.UnknownOutputParams;
          };
      href:
        | Router.RelativePathString
        | Router.ExternalPathString
        | `/${`?${string}` | `#${string}` | ""}`
        | `/modal${`?${string}` | `#${string}` | ""}`
        | `/otp${`?${string}` | `#${string}` | ""}`
        | `/_sitemap${`?${string}` | `#${string}` | ""}`
        | `${"/(main)"}/explore${`?${string}` | `#${string}` | ""}`
        | `/explore${`?${string}` | `#${string}` | ""}`
        | `${"/(main)"}${`?${string}` | `#${string}` | ""}`
        | `/${`?${string}` | `#${string}` | ""}`
        | {
            pathname: Router.RelativePathString;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: Router.ExternalPathString;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `/`; params?: Router.UnknownInputParams }
        | { pathname: `/modal`; params?: Router.UnknownInputParams }
        | { pathname: `/otp`; params?: Router.UnknownInputParams }
        | { pathname: `/_sitemap`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(main)"}/explore` | `/explore`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(main)"}` | `/`;
            params?: Router.UnknownInputParams;
          };
    }
  }
}
