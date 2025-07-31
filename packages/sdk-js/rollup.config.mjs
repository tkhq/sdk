import path from "node:path";
import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import nodeExternals from "rollup-plugin-node-externals";

const getFormatConfig = (format, target) => {
  const pkgPath = path.join(process.cwd(), "package.json");

  // pick which file-extensions to try first:
  const extensions =
    target === "react-native"
      ? [".mobile.ts", ".mobile.js", ".ts", ".js"]
      : [".web.ts", ".web.js", ".ts", ".js"];

  return {
    input: "src/index.ts",
    output: {
      dir: "dist",
      format,
      sourcemap: true,
      preserveModules: true,
      entryFileNames: `[name].${format === "esm" ? "mjs" : "js"}`,
    },
    plugins: [
      // 1) resolve ./foo → foo.mobile.ts or foo.web.ts first
      nodeResolve({
        extensions,
        preferBuiltins: false,
      }),
      typescript({
        tsconfig: "./tsconfig.json",
        outputToFilesystem: false,
        compilerOptions: {
          outDir: "dist",
          composite: false,
          declaration: format === "esm",
          declarationMap: format === "esm",
          sourceMap: true,
        },
      }),
      // 4) leave node_modules externals out of the bundle
      nodeExternals({
        packagePath: pkgPath,
        builtinsPrefix: "ignore",
      }),
    ],
  };
};

export default (commandLineArgs) => {
  // pull from --environment TARGET:react-native (or browser)
  const target = commandLineArgs.TARGET || process.env.TARGET || "browser";
  console.log(`Building for target: ${target}`);

  return [getFormatConfig("esm", target), getFormatConfig("cjs", target)];
};
