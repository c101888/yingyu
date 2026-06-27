# 项目进度与任务交接

> 本文档用于跨账户/跨设备交接项目状态。新账户登录后,请先读本文件,再读 `ProjectMemoryRecovery.md`。
> 最后更新:2026-06-27（本次变更：后端端口 3001→7550；新建 server/.env 与 .env.local；user_profile.md 全局端口规则修正为"新项目端口需用户授权"）

## 1. 项目一句话定位

**家庭场景英语学习应用** —— 把当天家里真实发生的生活场景(起床/刷牙/早餐/吃黄瓜…),AI 生成英语内容,家长陪孩子(3-8岁)听、说、跟读、演练、复用。

## 2. ⚠️ PRD 与实际实现的差异(重要)

`.trae/documents/PRD.md` 与 `TechnicalArchitecture.md` 是 **初始 MVP 文档,已严重滞后**,不要按它们判断现状。实际项目已远超原始 PRD:

| 项 | PRD 原计划 | 实际现状 |
|---|---|---|
| 架构 | 纯前端 SPA,无后端 | 前端 SPA + Express 后端 + SQLite + Capacitor Android 三端 |
| 认证 | 无登录 | JWT 登录(家长账号) |
| 数据存储 | localStorage | localStorage + SQLite(server),历史记录已入库 |
| 页面数 | 6 页 | 11 页(新增 History/Profile/Upgrade/Rewards/LearnCenter) |
| 会员体系 | 不做 | 已做(tier 会员分级 + 积分 + 奖励) |
| 终端 | 仅 Web | Web + Android APK + PWA |
| 后台 | 不做 | 已做 admin-ui(Dashboard/Users/Logs/LlmSettings/SystemInfo/Backups) |

**新文档以本文件 + 源码为准。** PRD/TechnicalArchitecture 仅作历史参考。

## 3. 技术栈(实际)

### 前端 `e:\trde-kaifa\yingyu-trde`
- React 18 + TypeScript + Vite 6
- Tailwind CSS v3 + shadcn/ui(Radix)
- React Router v7
- 状态:Zustand(`src/store/*Store.ts`,persist 到 localStorage)
- 语音:浏览器 Web Speech API(SpeechSynthesis + SpeechRecognition)
- Android:Capacitor 8(`@capacitor/core` + `@capacitor-community/text-to-speech` + `@capacitor-community/speech-recognition`)
- 文生图:`https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image`

### 后端 `e:\trde-kaifa\yingyu-trde\server`
- Express 4 + TypeScript
- SQLite(`server/src/db/`,schema 在 `schema.ts`)
- JWT 认证(`server/src/middleware/auth.ts`)
- 路由:`auth / admin / sessions / points / rewards / tier / llm / sceneCache`
- 工具:`winston` 日志、`node-cron` 定时、`archiver` 备份、`multer` 上传、`express-rate-limit` 限流
- LLM 调用层:`server/src/lib/llmScheduler.ts`(注意:后端也调用 ARK,有调度逻辑)

### 后台 `e:\trde-kaifa\yingyu-trde\server\admin-ui`
- React + Vite + Tailwind + React Router
- 页面:Dashboard / Users / UserDetail / Logs / LlmSettings / SystemInfo / Backups / Login / Layout

## 4. 端口与代理

| 服务 | 端口 | 说明 |
|---|---|---|
| 前端 dev | **7500**(strictPort) | `vite.config.ts` |
| 后端 API | **7550** | `server/src/config.ts`,默认 `PORT=7550` |
| LLM 代理 | `/api/llm` → ARK | Vite 代理注入 `Bearer ${ARK_API_KEY}` |
| API 代理 | `/api` → 7550 | 后台接口走此代理 |
| 健康检查 | `/health` → 7550 | |

## 5. 关键配置文件与密钥

| 文件 | 用途 | 是否进 git |
|---|---|---|
| `vite.config.ts` | 前端代理 + 端口 7500 | 是 |
| `server/src/config.ts` | 后端配置,从 env 读取 | 是 |
| `server/.env.example` | 环境变量模板 | 是 |
| `server/.env` | **实际密钥**:JWT_SECRET / ARK_API_KEY / 默认管理员密码 | ❌ 不进 git |
| `.env.local`(根目录) | 前端用 `VITE_ARK_API_KEY` | ❌ 不进 git |

⚠️ **换账户/换机时必须重新配置密钥**:`server/.env` 与根目录 `.env.local` 不在 git 里,需要在新环境手动创建(参考 `.env.example`)。

## 6. 页面与路由(实际 11 条)

| 路由 | 页面 | 文件 |
|---|---|---|
| `/` | 场景首页 | `src/pages/Home.tsx` |
| `/daily-route` | 每日路线编辑 | `src/pages/DailyRoute.tsx` |
| `/scene-result` | 场景生成结果 | `src/pages/SceneResult.tsx` |
| `/learn` | 最小学习 | `src/pages/Learn.tsx` |
| `/practice` | 角色演练 | `src/pages/Practice.tsx` |
| `/done` | 今日完成 | `src/pages/Done.tsx` |
| `/history` | 历史记录 | `src/pages/HistoryPage.tsx` |
| `/profile` | 个人中心 | `src/pages/Profile.tsx` |
| `/upgrade` | 升级会员 | `src/pages/Upgrade.tsx` |
| `/rewards` | 奖励 | `src/pages/Rewards.tsx` |
| `/learn-center` | 学习中心 | `src/pages/LearnCenter.tsx` |

路由定义在 `src/App.tsx`。

## 7. 目录结构速查

```
e:\trde-kaifa\yingyu-trde\
├─ src\                  前端源码
│  ├─ pages\             11 个页面
│  ├─ components\         业务组件 + ui\(shadcn)
│  ├─ store\             zustand stores(user/session/route/points/tier/history)
│  ├─ lib\               api/voice/llm/imageCache/levels/tiers/quiz/...
│  └─ App.tsx            路由
├─ server\               后端
│  ├─ src\
│  │  ├─ routes\         auth/admin/sessions/points/rewards/tier/llm/sceneCache
│  │  ├─ middleware\     auth / errorHandler
│  │  ├─ db\             index.ts + schema.ts(SQLite)
│  │  ├─ lib\            llmScheduler.ts
│  │  ├─ config\        tiers.ts(会员分级配置)
│  │  ├─ scripts\        createAdmin.ts / migrate.ts
│  │  └─ config.ts
│  └─ admin-ui\          后台 React 应用
├─ android\              Capacitor Android 工程
├─ public\scenes\        8 张场景插画(起床/刷牙/早餐/出门/上学/零食/穿衣/吃黄瓜)
├─ .trae\documents\      本目录(PRD/技术架构/开发规则/本文件/记忆恢复指南)
└─ capacitor.config.ts   Android 打包配置
```

## 8. Git 提交历史(近 20 次)

```
b422d98 彻底修复点击立即报错: 回退到 partialResults:true(v2.1)
30e70cf 彻底修复跟读: 改用 partialResults:false 模式(v2.0)
238ee8c 修复跟读识别超时+重启慢(v1.9)
8bdab3e 修复跟读卡死(v1.8)
9814cc9 彻底修复跟读两端(v1.7)
f4e229a 彻底重构跟读:原生用Capacitor插件+Web Speech API分离(v1.6)
70accd7 跟读统一Web Speech API+状态机修复(v1.5)
9db8913 跟读改用原生语音识别插件(v1.4)
2b18d99 历史记录重复/删除复活/丰富细节持久化(v1.3)
d2891eb App麦克风权限+场景对话跟读(v1.2)
710b5a1 App声音重试机制+历史记录持久化到数据库+APK版本管理
c753c45 Practice词汇模块分布不均+App声音无声(原生TTS插件)
7da4ec9 响应式UI全面审计 - 11处padding/gap失衡
3980c64 backup: 手机版UI优化阶段性备份
61bfd84 fix: 游客显示/登录过期/UI布局/Profile登录弹窗  ← 手机优化前基准
b80e589 CORS允许APK访问+配额调整+LLM后台可见+场景网格优化
02c8623 add Capacitor Android platform + production API config
7873106 add PWA support
b5a7c77 add LLM proxy route and admin-ui sub-path support
0e11b00 feat: 家庭场景英语学习 MVP 完整版  ← 最初完整版
```

## 9. 当前开发状态(截至 2026-06-26)

### 已完成
- ✅ 6 页核心闭环(首页/路线/结果/学习/演练/完成)
- ✅ LLM 场景内容生成(ARK glm-5.2)
- ✅ 文生图场景插画(8 张默认场景)
- ✅ Web 端 TTS 语音 + 跟读识别
- ✅ Android APK:Capacitor 包装 + 原生 TTS 插件 + 原生语音识别插件
- ✅ JWT 登录注册 + 用户表
- ✅ 后台 admin-ui(7 个页面)
- ✅ 会员分级(tier)+ 积分(points)+ 奖励(rewards)
- ✅ 历史记录持久化到 SQLite(此前曾重复/复活,已修复)
- ✅ 响应式 UI(手机 375 / 平板 768 / 桌面 1280)
- ✅ PWA 支持
- ✅ 跟读功能 v2.1(经历 v1.5→v2.1 共 7 次重构,最终方案见下)

### 跟读功能最终方案(v2.1,近期重点)
- **Web 端**:Web Speech API(`SpeechRecognition`),统一状态机
- **Android 端**:`@capacitor-community/speech-recognition` 插件事件流
- **关键参数**:`partialResults: true`(让 `start()` 立即 resolve,避免点击立即报错)
- **超时处理**:`stop` 改为 fire-and-forget + debounce 收集最终结果
- **取消兜底**:可点击取消,未识别强制 error
- 涉及组件:`src/components/Quiz.tsx`、`src/lib/speechRecognition.ts`、`src/components/SpeakButton.tsx`、`src/components/RepeatButton.tsx`

### 未完成 / 待办(若继续开发)
- ⬜ 跟读评分(MVP 边界外,目前不做语音识别评分)
- ⬜ 多儿童管理(MVP 范围外)
- ⬜ 推送通知(范围外)
- ⬜ 完整 LMS / 课程商城(范围外)
- ⬜ PRD/TechnicalArchitecture 文档与实际代码对齐(强烈建议补做)

### 已知问题 / 注意事项
1. **PRD 与代码已脱节**:见第 2 节,任何"按 PRD 实现"的判断都需先核对源码
2. **密钥不在 git**:`server/.env` 与 `.env.local` 需在新环境手动配置
3. **响应式红线**:手机端改样式必须用 `sm:` 前缀隔离,详见 `DevelopmentRules.md` §2.1.1
4. **Git 自动备份**:每完成一轮修改必须 `git add -A; git commit -m "..."`,详见 `DevelopmentRules.md` §5
5. **bug/ 截图**:7 张 2026-06-23 的 bug 截图在 `bug/` 目录,与跟读功能 v2.0 之前的报错有关

### ⛔ 阻断商业化的重要问题：跟读功能依赖浏览器原生语音识别

**问题性质**：核心学习闭环阻断，不解决无法商业化，只能停留在小范围测试阶段。

**现状**：跟读功能（`src/lib/speechRecognition.ts`）依赖浏览器原生 Web Speech API + Capacitor 插件。Learn 页（`src/pages/Learn.tsx`）的 `canFinish = allRead && quizDone`，而 `markReadWord`/`markReadSentence` 仅在 `RepeatButton` 的 `onScored` 回调（语音识别成功）时触发。

**影响范围**：
- Firefox/Safari 等不支持 `webkitSpeechRecognition` 的浏览器：用户无法标记词汇/句子为已读，永远卡在 Learn 页，无法进入 Practice/Done，无法获得积分
- 国内 Android 手机（小米/华为等无 Google 服务）：即使 `recognitionSupported()` 返回 true，实际识别常失败，`onScored` 不触发，同样卡死
- 用户拒绝麦克风权限后：`onError` 触发但 `onScored` 不触发，依然卡死
- **整个学习闭环（学习→演练→完成→积分）对上述用户完全不可用**

**为什么不解决无法商业化**：
- 移动端是产品主要受众（家庭场景），但国内 Android 手机恰恰是语音识别失败重灾区
- 语音识别失败 = 学习流程卡死 = 用户无法体验核心价值 = 无法留存/付费
- 任何弱降级方案（Web Audio API 音量检测/"跳过跟读"）都放弃了跟读验证发音的核心价值，对英语学习产品来说功能名存实亡，只是凑合不是解决方案

**唯一解决方案**：接入服务端语音识别 API（如火山引擎 ASR / 阿里云语音识别 / 腾讯云 ASR）。录音→上传→返回识别文本→与目标文本比对评分。不依赖浏览器原生 API，覆盖所有终端。

**排查过的替代方案及否决理由**：
1. Web Audio API 音量检测：只能检测"有没有说话"而非"说得对不对"，乱说一通也能过关，违背英语跟读核心价值
2. "跳过跟读"按钮：放弃跟读功能价值，与产品定位冲突
3. 保留现状 + 提示用户换浏览器：用户体验差，且无法解决国内 Android 无 Google 服务问题

**涉及文件**（接入 API 时需改动）：
- `src/lib/speechRecognition.ts`（核心状态机）
- `src/components/RepeatButton.tsx`（跟读按钮）
- `src/pages/Learn.tsx`（canFinish 逻辑、markRead 回调）
- `server/src/routes/llm.ts` 或新增 `server/src/routes/asr.ts`（服务端代理，避免前端暴露 ASR 密钥）

**当前处理方式**：暂不修改，待商业化前必须接入服务端语音识别 API。

### 🕒 初赛期间临时隐藏跟读功能（2026-06-27）

**决策**：TRAE AI 创造力大赛初赛期间（截至 2026-07-15），临时隐藏跟读评分功能（`RepeatButton`），改为"听示范+播放完自动标记已读"模式。

**原因**：Web Speech API 在国内浏览器、iOS Safari、微信内置浏览器兼容性差，评审使用不同设备时跟读失败会卡住学习闭环。为保证评审体验流畅，临时降级为"听示范跟读"模式。

**改造内容**（commit 待提交）：
- `src/components/SpeakButton.tsx`：新增 `onSpoken` 回调，在朗读结束（onend/onerror）或不支持 TTS 时触发
- `src/pages/Learn.tsx`：移除词汇/句子的 `RepeatButton`，改为 `SpeakButton` 播放完自动 `markReadWord`/`markReadSentence`
- `src/pages/Practice.tsx`：移除孩子台词的 `RepeatButton`，改为 `SpeakButton` 播放完自动 `setChildSpoken(true)`
- `src/pages/Upgrade.tsx` / `src/lib/tiers.ts`：权益描述"语音识别评分"改为"听示范跟读"
- `src/components/RepeatButton.tsx` / `src/lib/speechRecognition.ts`：**保留不动**，未删除

**⚠️ 必须恢复**：跟读功能是产品核心卖点之一，初赛结束后必须恢复。恢复方式：
```powershell
# 恢复跟读功能（初赛结束后执行）
git checkout 03c2e30 -- src/components/RepeatButton.tsx src/lib/speechRecognition.ts
# 然后手动还原 Learn.tsx / Practice.tsx 中的 RepeatButton 引用
# 参考 03c2e30 版本的 Learn.tsx:103-112, 142-151 和 Practice.tsx:233-246
```

**未删除的文件**（保留以便恢复）：
- `src/components/RepeatButton.tsx`
- `src/lib/speechRecognition.ts`
- `src/lib/voice.ts`（TTS，仍在使用）

## 10. 本地启动命令

```powershell
# 前端(7500 端口)
cd e:\trde-kaifa\yingyu-trde
npm install
npm run dev

# 后端(7550 端口,新开终端)
cd e:\trde-kaifa\yingyu-trde\server
npm install
npm run dev     # tsx watch

# 后台(可选,admin-ui)
cd e:\trde-kaifa\yingyu-trde\server\admin-ui
npm install
npm run dev

# 数据库迁移(首次)
cd e:\trde-kaifa\yingyu-trde\server
npm run migrate

# 创建管理员
cd e:\trde-kaifa\yingyu-trde\server
npm run create-admin
```

## 11. Android 打包

```powershell
cd e:\trde-kaifa\yingyu-trde
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleDebug
# APK 输出: android\app\build\outputs\apk\debug\
```

## 12. 关键参考文件清单

| 想了解 | 读哪个文件 |
|---|---|
| 产品需求(历史) | `.trae/documents/PRD.md` |
| 技术架构(历史) | `.trae/documents/TechnicalArchitecture.md` |
| 开发规则(必读) | `.trae/documents/DevelopmentRules.md` |
| 路由 | `src/App.tsx` |
| 前端代理/端口 | `vite.config.ts` |
| 后端配置 | `server/src/config.ts`、`server/.env.example` |
| 数据库表结构 | `server/src/db/schema.ts` |
| 会员分级 | `server/src/config/tiers.ts` |
| LLM 调用 | `server/src/lib/llmScheduler.ts`、`src/lib/llm.ts` |
| 跟读状态机 | `src/lib/speechRecognition.ts` |
| 项目记忆恢复 | `.trae/documents/ProjectMemoryRecovery.md` |
