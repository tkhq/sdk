import postcss from "rollup-plugin-postcss";
import typescript from "@rollup/plugin-typescript";
import nodeExternals from "rollup-plugin-node-externals";
import path from "node:path";
import alias from "@rollup/plugin-alias";
import url from "@rollup/plugin-url";
import preserveDirectives from "rollup-preserve-directives";
import strip from "@rollup/plugin-strip";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { babel } from "@rollup/plugin-babel";

const getFormatConfig = (format) => {
  const pkgPath = path.join(process.cwd(), "package.json");
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const isCjs = format === "cjs";

  /** @type {import('rollup').RollupOptions} */
  return {
    input: "src/index.ts",
    output: {
      format,
      dir: "dist",
      entryFileNames: `[name].${format === "esm" ? "mjs" : "js"}`,
      preserveModules: true,
      preserveModulesRoot: "src",
      sourcemap: true,
      exports: "named",
    },
    plugins: [
      // Handle assets like images and fonts
      url({
        include: [
          "**/*.svg",
          "**/*.png",
          "**/*.jpg",
          "**/*.gif",
          "**/*.woff",
          "**/*.woff2",
          "**/*.ttf",
          "**/*.eot",
        ],
        limit: 8192,
        emitFiles: true,
        fileName: "assets/fonts/[name].[hash][extname]",
      }),
      alias({
        entries: [
          {
            find: "assets",
            replacement: path.resolve(__dirname, "src/assets"),
          },
        ],
      }),
      // Add nodeResolve to fix deep ESM import resolution
      nodeResolve({
        extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs"],
        preferBuiltins: true,
        mainFields: ["module", "main", "browser"],
      }),
      // Preserve directives such as "use client" or "use server"
      preserveDirectives(),
      strip({
        include: "**/*.(ts|tsx|js|jsx)",
        functions: ['"use client"'],
      }),
      // Transpile using Babel and ensure ES module syntax is preserved
      babel({
        babelHelpers: "bundled",
        extensions: [".js", ".jsx", ".ts", ".tsx"],
        include: ["src/**/*"],
        presets: [
          [
            "@babel/preset-env",
            {
              // Disable module transformation so Rollup can handle imports/exports
              modules: false,
              targets: isCjs ? { node: "current" } : undefined,
            },
          ],
          "@babel/preset-react",
        ],
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
      nodeExternals({
        packagePath: pkgPath,
        builtinsPrefix: "ignore",
      }),
      postcss({
        extract: "styles.css",
        minimize: true,
      }),
    ],
  };
};

export default () => {
  const esm = getFormatConfig("esm");
  const cjs = getFormatConfig("cjs");

  return [esm, cjs];
};
