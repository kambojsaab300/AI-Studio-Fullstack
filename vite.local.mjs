// Local Mac preview config with live tunnel & external host support.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
    root: here + 'AI-Studio/preview',
    server: {
        host: '0.0.0.0',
        port: 5174,
        strictPort: true,
        cors: true,
        allowedHosts: true,
        fs: { allow: [here] }
    }
});
