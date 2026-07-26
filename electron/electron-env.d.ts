/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
    // must be `interface`, not `type`: only interfaces merge with @types/node's ambient ProcessEnv
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface ProcessEnv {
        /**
         * The built directory structure
         *
         * ```tree
         * ├─┬─┬ dist
         * │ │ └── index.html
         * │ │
         * │ ├─┬ dist-electron
         * │ │ ├── index.js
         * │ │ └── preload.mjs
         * │
         * ```
         */
        APP_ROOT: string,
        /** /dist/ or /public/ */
        VITE_PUBLIC: string,
        VITE_DEV_SERVER_URL?: string,
        OPENAI_API_KEY?: string,
        OPENAI_MODEL?: string
    }
}

// Used in Renderer process, expose in `preload.ts`
// must be `interface`, not `type`: only interfaces merge with lib.dom's global Window
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
interface Window {
    ipcRenderer: import("electron").IpcRenderer
}
