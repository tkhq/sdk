# Contributing

## Repo overview

- [`packages/`](/packages/): Turnkey npm packages.
- [`examples/`](/examples/): Examples and templates. Won't be published to npm.
- [`internal/`](/internal/): Internal scripts and configs. Won't be published to npm.

## Getting started

Clone the repo:

```bash
$ git clone https://github.com/tkhq/sdk/
$ cd sdk/
```

Install [nvm (node version manager)](https://github.com/nvm-sh/nvm):

```bash
$ wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
```

Now open a new terminal to install Node.js:

```bash
$ nvm install # Install the version specified in `.nvmrc`
$ nvm use # Activate the local version
```

Use `corepack` to install/manage [`pnpm`](https://pnpm.io):

```bash
$ corepack enable
$ pnpm --version # Should output "8.4.0"
```

Finally, install dependencies and compile source code:

```bash
$ pnpm install -r
$ pnpm run -w build-all
```
