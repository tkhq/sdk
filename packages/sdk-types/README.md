# @turnkey/sdk-types

[![npm](https://img.shields.io/npm/v/@turnkey/sdk-types?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/sdk-types)

## Getting started

A package for common and reusable Turnkey Types which can be used for consistent typing across packages.

### Installation

#### npm

```bash
$ npm install @turnkey/sdk-types
```

#### Yarn

```bash
$ yarn add @turnkey/sdk-types
```

#### pnpm

```bash
$ pnpm add @turnkey/sdk-types
```

### Usage

```js
import { useTurnkey } from "@turnkey/sdk-react";
import { SessionType } from "@turnkey/sdk-types";

export default function AuthComponent() {
  const { passkeyClient } = useTurnkey();

  await passkeyClient?.loginWithPasskey({
    sessionType: SessionType.READ_WRITE,
    ...
  });
}
```
