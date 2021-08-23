import commonjs from 'rollup-plugin-commonjs'
import dts from 'rollup-plugin-dts'
import json from 'rollup-plugin-json'
// 为了将引入的 npm 包，也打包进最终结果中
import resolve from 'rollup-plugin-node-resolve'
import serve from 'rollup-plugin-serve'
import sourceMaps from 'rollup-plugin-sourcemaps'
// 让 rollup 认识 ts 的代码
import typescript from 'rollup-plugin-typescript2'

import pkg from './package.json'

const isDevelopment = process.env.NODE_ENV === 'development'

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: pkg.main,
        name: 'mixinMiddleware',
        format: 'umd',
        sourcemap: false,
      },
      { file: pkg.module, format: 'esm', sourcemap: false },
    ],
    plugins: [
      json(),
      typescript({
        useTsconfigDeclarationDir: true,
        tsconfig: './tsconfig.json',
      }),
      commonjs(),
      resolve(),
      sourceMaps(),
      isDevelopment &&
        serve({
          port: 3000,
          contentBase: [''],
        }),
    ],
  },
  {
    input: 'src/index.ts',
    output: [{ file: 'dist/index.d.ts', format: 'es' }],
    plugins: [dts()],
  },
]
