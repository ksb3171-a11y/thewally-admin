import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // 포트가 사용 중이면 다른 포트로 변경하지 않고 에러 발생
    proxy: {
      '/api/cafe24': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/directsend': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
