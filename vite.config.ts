import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

// 火山引擎 ARK API Key（本地 MVP，经 Vite 代理注入，不暴露到前端 bundle）
// 从环境变量读取，避免提交到仓库泄露
// 本地开发：在项目根目录创建 .env.local 文件，写入 VITE_ARK_API_KEY=你的key
const ARK_API_KEY = process.env.VITE_ARK_API_KEY || process.env.ARK_API_KEY || '';
const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/coding/v3';

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 7500,
    strictPort: true,
    proxy: {
      // 后台 API（认证、积分、会话、管理员等）转发到本地 server
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // 注意：/api/llm 必须在 /api 之前，更具体的路径优先匹配
      '/api/llm': {
        target: ARK_BASE,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/llm/, ''),
        headers: {
          Authorization: `Bearer ${ARK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Authorization', `Bearer ${ARK_API_KEY}`);
          });
        },
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: 'hidden',
  },
  plugins: [
    react(),
    traeBadgePlugin({
      variant: 'dark',
      position: 'bottom-right',
      prodOnly: true,
      clickable: true,
      clickUrl: 'https://www.trae.ai/solo?showJoin=1',
    }),
    tsconfigPaths()
  ],
})
