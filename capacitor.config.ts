import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.c101888.yingyu',
  appName: '家庭英语',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    // 使用线上后端 API
    androidScheme: 'http',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
