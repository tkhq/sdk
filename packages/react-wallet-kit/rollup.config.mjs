import postcss from "rollup-plugin-postcss";
import typescript from "@rollup/plugin-typescript";
import nodeExternals from "rollup-plugin-node-externals";
import path from "node:path";
import alias from "@rollup/plugin-alias";
import url from "@rollup/plugin-url";


const getFormatConfig = (format) => {
  const pkgPath = path.join(process.cwd(), "package.json");
  const __dirname = path.dirname(new URL(import.meta.url).pathname);

  /** @type {import('rollup').RollupOptions} */
  return {
    input: "src/index.ts",
    output: {
      format,
      dir: "dist",
      entryFileNames: `[name].${format === "esm" ? "mjs" : "js"}`,
      preserveModules: true,
      sourcemap: true,
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
        extract: "styles.css", // builds dist/styles.css
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
