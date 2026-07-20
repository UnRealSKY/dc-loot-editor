import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pages 子路徑；改 repo 名時同步改這裡
const REPO = 'dc-loot-editor'

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? `/${REPO}/` : '/',
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
