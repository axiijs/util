import {resolve} from "path";
import dts from 'vite-plugin-dts'

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
      name: 'AxiiAction',
      // the proper extensions will be added
      fileName: 'axii-action',
    },
    sourcemap: 'inline',
    rollupOptions: {

    },
  },
  plugins: [dts({
    tsconfigPath: resolve(__dirname, '../../tsconfig.prod.json'),
    rollupTypes: true,
    include: ['src/**/*.ts'],
  })]
}
