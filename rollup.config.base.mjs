import typescript from "@rollup/plugin-typescript";
import nodeExternals from "rollup-plugin-node-externals";
import path from "node:path";
import postcss from 'rollup-plugin-postcss';
import preserveDirectives from 'rollup-preserve-directives'

const getFormatConfig = (format) => {
  const pkgPath = path.join(process.cwd(), "package.json");

  return {
    input: 'src/index.ts',
    output: {
      format,
      dir: "dist",
      entryFileNames: `[name].${format === 'esm' ? 'mjs' : 'js'}`,
      preserveModules: true,
      sourcemap: true,
    },
    plugins: [
      postcss({
        modules: true,
        extensions: ['.css', '.scss'],
        use: ['sass'],
        extract: `styles.${format}.css`,
        minimize: true,
        sourceMap: true,
      }),
      typescript({
        tsconfig: './tsconfig.json',
        compilerOptions: {
          outDir: "dist",
          composite: false,
          declaration: format === 'esm',
          declarationMap: format === "esm",
          sourceMap: true,
        },
      }),
      preserveDirectives(),
      nodeExternals({
        packagePath: pkgPath,
        builtinsPrefix: 'ignore',
      }),
    ],
  };
};

export default () => {
  const esm = getFormatConfig('esm');
  const cjs = getFormatConfig('cjs');

  return [esm, cjs];
};
