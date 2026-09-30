import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] }),
    basicSsl(), // HTTPS化：iPad等でカメラ（getUserMedia）を使えるようにする
  ],
  server: {
    host: true, // LAN内の他端末（iPad等）からアクセス可能にする
    // フロントは HTTPS なので http の backend を直接叩くと mixed content で
    // ブロックされる。/api を同一オリジンで受けて backend にプロキシする。
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        // ブラウザから見ると /api は同一オリジンなので CORS は不要。
        // iPad 等から LAN の IP でアクセスすると Origin が ALLOWED_ORIGINS に
        // 無く backend に弾かれるため、プロキシ時に Origin を落とす。
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
        },
      },
    },
  },
})
