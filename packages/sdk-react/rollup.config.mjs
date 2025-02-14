import typescript from "@rollup/plugin-typescript";
import nodeExternals from "rollup-plugin-node-externals";
import path from "node:path";
import postcss from "rollup-plugin-postcss";
import preserveDirectives from "rollup-preserve-directives";
import url from "@rollup/plugin-url";
import alias from "@rollup/plugin-alias";
import copy from "rollup-plugin-copy";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { babel } from "@rollup/plugin-babel";

const getFormatConfig = (format) => {
  const pkgPath = path.join(process.cwd(), "package.json");
  // For __dirname in ES modules:
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const isCjs = format === "cjs";

  return {
    input: "src/index.ts",
    output: {
      format,
      dir: "dist",
      // Use .mjs for ESM builds and .js for CJS builds:
      entryFileNames: `[name].${format === "esm" ? "mjs" : "js"}`,
      preserveModules: true,
      sourcemap: true,
    },
    plugins: [
      // Resolve alias for assets
      alias({
        entries: [
          {
            find: "assets",
            replacement: path.resolve(__dirname, "src/assets"),
          },
        ],
      }),
      // Resolve modules from node_modules
      nodeResolve({
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      }),
      // Process CSS/SCSS files
      postcss({
        modules: true,
        extensions: [".css", ".scss"],
        use: ["sass"],
        extract: `styles.${format}.css`,
        minimize: true,
        sourceMap: true,
      }),
      // Compile TypeScript/TSX files
      typescript({
        outputToFilesystem: true,
        tsconfig: "./tsconfig.json",
        compilerOptions: {
          outDir: "dist",
          composite: false,
          // Emit declarations only for the ESM build
          declaration: format === "esm",
          declarationMap: format === "esm",
          sourceMap: true,
        },
      }),
      // Transpile using Babel and ensure ES module syntax is preserved
      babel({
        babelHelpers: "bundled",
        extensions: [".js", ".jsx", ".ts", ".tsx"],
        include: ["src/**/*", "node_modules/@mui/icons-material/**/*"],
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
      // Preserve directives such as "use client" or "use server"
      preserveDirectives(),
      // Mark most dependencies as external, except @mui/icons-material
      nodeExternals({
        packagePath: pkgPath,
        builtinsPrefix: "ignore",
        deps: true,
        include: ["@mui/icons-material"],
      }),
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
      // Copy fonts from src to dist
      copy({
        targets: [
          {
            src: path.resolve(__dirname, "src/assets/fonts/**/*"),
            dest: path.resolve(__dirname, "dist/assets/fonts"),
          },
        ],
        verbose: false,
      }),
    ],
  };
};

export default () => {
  const esm = getFormatConfig("esm");
  const cjs = getFormatConfig("cjs");

  return [esm, cjs];
};
