import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
// import {fileURLToPath, URL} from "url";

export default defineConfig({
    define: {
        __DEV__: true
    },
    test: {
        include: ['__tests__/**/*.spec.ts'],
    },
    resolve: {
        alias: {
            // 'data0': fileURLToPath(new URL('../../../data0/src/index.ts', import.meta.url))
        }
    },
    plugins: [tsconfigPaths()],
})