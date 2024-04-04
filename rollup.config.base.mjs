import typescript from "@rollup/plugin-typescript";
import nodeExternals from "rollup-plugin-node-externals";
import path from "node:path";

const getFormatConfig = (format) => {
  const pkgPath = path.join(process.cwd(), "package.json");

  /** @type {import('rollup').RollupOptions} */
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
      typescript({
        tsconfig: './tsconfig.json',
        outputToFilesystem: false,
        compilerOptions: {
          outDir: "dist",
          composite: false,
          declaration: format === 'esm',
          declarationMap: format === "esm",
          sourceMap: true,
        },
      }),
      nodeExternals({
        packagePath: pkgPath,
        builtinsPrefix: 'ignore',
      }),
    ],
  }
}


export default () =>  { 
  const esm = getFormatConfig('esm');
  const cjs = getFormatConfig('cjs');
  
  return [
    esm,
    cjs
  ]
}
