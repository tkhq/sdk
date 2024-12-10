import typescript from "@rollup/plugin-typescript";
import nodeExternals from "rollup-plugin-node-externals";
import path from "node:path";
import postcss from 'rollup-plugin-postcss';
import preserveDirectives from 'rollup-preserve-directives';
import url from '@rollup/plugin-url';
import alias from '@rollup/plugin-alias';
import copy from 'rollup-plugin-copy';

const getFormatConfig = (format) => {
  const pkgPath = path.join(process.cwd(), "package.json");
  const __dirname = path.dirname(new URL(import.meta.url).pathname);

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
      alias({
        entries: [
          { find: 'assets', replacement: path.resolve(__dirname, 'src/assets') }
        ]
      }),
      postcss({
        modules: true,
        extensions: ['.css', '.scss'],
        use: ['sass'],
        extract: `styles.${format}.css`,
        minimize: true,
        sourceMap: true,
      }),
      typescript({
        outputToFilesystem: true,
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
      url({
        include: [
          '**/*.svg', 
          '**/*.png', 
          '**/*.jpg', 
          '**/*.gif',
          '**/*.woff', 
          '**/*.woff2', 
          '**/*.ttf', 
          '**/*.eot'
        ],
        limit: 8192,
        emitFiles: true, 
        fileName: 'assets/fonts/[name].[hash][extname]', 
      }),
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
  const esm = getFormatConfig('esm');
  const cjs = getFormatConfig('cjs');

  return [esm, cjs];
};
