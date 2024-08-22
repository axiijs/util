import {resolve} from "path";
import dts from 'vite-plugin-dts'
import pkg from './package.json'

export default {
  esbuild: {
    jsxFactory: 'createElement',
    jsxFragment: 'Fragment',
  },
  define: {
    __DEV__: false
  },
  build: {
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, 'src/index.ts'),
      // 连字符转成驼峰
      name: pkg.name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
      // the proper extensions will be added
      fileName: 'index',
    },
    sourcemap: true,
    rollupOptions: {
      external: ['data0'],
    },
  },
  plugins: [dts({
    tsconfigPath: resolve(__dirname, '../../tsconfig.prod.json'),
    rollupTypes: true,
    include: ['src/**/*.ts'],
  })]
}
