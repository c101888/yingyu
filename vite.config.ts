import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// 火山引擎 ARK API Key（本地 MVP，经 Vite 代理注入，不暴露到前端 bundle）
// 注意：vite.config.ts 中必须用 loadEnv() 读取 .env 文件，process.env 读不到
// 本地开发：在项目根目录创建 .env.local 文件，写入 VITE_ARK_API_KEY=你的key
const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/coding/v3';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 第三个参数 '' 表示加载所有前缀的变量（默认只加载 VITE_ 前缀）
  const env = loadEnv(mode, process.cwd(), '');
  const ARK_API_KEY = env.VITE_ARK_API_KEY || env.ARK_API_KEY || '';

  return {
  server: {
    port: 7500,
    strictPort: true,
    proxy: {
      // 后台 API（认证、积分、会话、管理员等）转发到本地 server
      '/health': {
        target: 'http://localhost:7550',
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
        target: 'http://localhost:7550',
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: 'hidden',
  },
  plugins: [
    react(),
    tsconfigPaths()
  ],
  };
});
