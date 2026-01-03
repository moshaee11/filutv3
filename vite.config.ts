
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 关键修改：使用相对路径，否则在 APK 中会白屏
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})
