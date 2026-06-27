# 项目记忆恢复指南

> 本文件用于在新账户登录后,把"项目级记忆/规则/约定"重新喂给 AI 助手。
> 记忆的本质:让 AI 在后续会话中保持与项目历史一致的开发风格与约束。
> 最后更新:2026-06-26

## 0. TRAE 记忆机制速览(必读)

依据官方文档 https://docs.trae.cn/ide_memories :

- **记忆类型**:全局记忆(跨项目)+ 项目记忆(仅当前项目)
- **存储位置**:本机磁盘,**绑定当前登录账户**——换账户登录后,新账户的记忆库是空的
- **上限**:全局 20 条 + 项目 20 条,超出按引用频率自动淘汰
- **不会自动保存**:一次性指令、模糊偏好、敏感信息(密码/隐私)
- **手动创建**:对话里说"记住:……"即可生成项目记忆

⚠️ **核心问题**:TRAE IDE 的 Agent 会话任务列表、对话历史、记忆都跟随账户。新账户登录后:
- ❌ 看不到旧账户的会话/任务列表
- ❌ 看不到旧账户的项目记忆
- ✅ 能看到磁盘上的项目文件(本文件就在磁盘上)

## 1. 恢复流程(3 步)

### 第 1 步:读交接文档
打开 TRAE IDE → 打开项目 `e:\trde-kaifa\yingyu-trde` → 在侧边对话里用 `#` 引用:
```
#.trae/documents/HandoffAndProgress.md
```
让 AI 通读项目进度与现状。

### 第 2 步:读开发规则
```
#.trae/documents/DevelopmentRules.md
```
让 AI 掌握响应式红线、Git 备份制度、测试验收等强制规则。

### 第 3 步:恢复项目记忆
**方案 A(推荐):让 AI 批量生成记忆**

在对话里粘贴下面这段指令(见本文件 §2),AI 会逐条把"项目记忆候选清单"写入新账户的记忆库。

**方案 B(快速):只在每次会话开头引用本文件**
```
#.trae/documents/ProjectMemoryRecovery.md
```
每次开新会话/新任务时,先把本文件喂进去,让 AI 临时遵循这些规则。缺点是每次都要手动引用,且无法触发自动淘汰/优先级管理。

## 2. 项目记忆候选清单(直接复制给 AI)

把下面整段(从「开始」到「结束」)粘贴到对话框,然后发送:

---

开始

请把下面这些项目级偏好与规则,逐条保存为项目记忆(用"记住"指令的方式录入)。每条之间用换行分隔,我会逐条确认:

【记忆 1】项目身份:本项目是"家庭场景英语学习应用",家长陪 3-8 岁孩子,把当天家里真实生活场景转成英语听/说/跟读/演练。儿童无独立账号。

【记忆 2】PRD 已滞后:`.trae/documents/PRD.md` 和 `TechnicalArchitecture.md` 是初始 MVP 文档,与实际代码严重脱节。实际已是"前端 SPA + Express 后端 + SQLite + Capacitor Android 三端"架构,有 JWT 登录、会员/积分/奖励、admin-ui 后台。判断现状以源码 + `.trae/documents/HandoffAndProgress.md` 为准。

【记忆 3】端口约定:前端固定 7500(strictPort),后端 7550。`/api/llm` 经 Vite 代理转发到火山引擎 ARK(注入 Bearer Key),`/api` 与 `/health` 代理到 7550。不要随意改端口。

【记忆 4】响应式红线(最高优先级):手机版改样式必须用 `sm:` 前缀隔离。手机样式用无前缀类(如 `p-4`),对应 web/平板样式必须用 `sm:` 覆盖(如 `sm:p-5`)。禁止把无前缀类直接改全局。CardContent 统一用 `p-4 sm:p-5` 模式。修改前不确定原始值时,用 `git diff 61bfd84 HEAD -- <file>` 对比基准。

【记忆 5】三端断点:手机 `< 640px`(无前缀)、平板 `640-1024px`(`sm:`)、桌面 `> 1024px`(`lg:`)。测试视口:iPhone SE 375 / iPad 768 / Desktop 1280。

【记忆 6】Git 自动备份制度:每完成一轮用户指令的修改,立即用 `git add -A; git commit -m "描述"` 提交(PowerShell 用 `;` 不用 `&&`)。提交信息用 `修复:` / `功能:` / `构建:` 前缀。**不要 push**,除非用户明确要求。

【记忆 7】关键版本节点:`0e11b00` 初始完整 MVP、`61bfd84` 手机优化前基准(响应式 UI 对比基准)、`3980c64` 手机优化阶段备份。回滚用 `git checkout <commit> -- <file>`。

【记忆 8】测试验收铁律:每次修改后必须验证才能声明完成。后端 API 用 curl 测端点;前端启动 dev server 验证页面+控制台无错+三视口;UI 改动用浏览器设备模拟器测 375/768/1280;部署后必须 HTTP 验证线上 + 检查 JS hash + Cache-Control + 清缓存。

【记忆 9】错误处理约定:所有 API 调用必须有 try/catch;401 用 `isAuthError(err)` 静默处理;用户可见错误用 toast/alert 显示不阻塞;zustand persist 必须用 merge 函数覆盖旧值;不持久化会变更的配置常量。

【记忆 10】LLM 调用:模型 `glm-5.2`,温度 0.4,要求纯 JSON 输出。前端容错:剥离 ```json 代码块、词汇截断 4 个、对话 3 轮。场景名前置 + 强制约束禁止更换场景。后端 `server/src/lib/llmScheduler.ts` 也调用 ARK 并有调度逻辑。

【记忆 11】跟读功能最终方案(v2.1):Web 端用 Web Speech API(SpeechRecognition),Android 端用 `@capacitor-community/speech-recognition` 插件事件流。关键参数 `partialResults: true`(让 start() 立即 resolve)。stop 改 fire-and-forget + debounce 收集最终结果。涉及文件:`src/lib/speechRecognition.ts`、`src/components/Quiz.tsx`、`SpeakButton.tsx`、`RepeatButton.tsx`。不要再倒退到 v1.x 方案。

【记忆 12】语音服务:启动时枚举 `getVoices()`,优先级:Google US English → Natural/Enhanced/Premium → en-US 非默认 → 任意 en。提供音色下拉。失败不阻断只提示。不做语音识别评分(MVP 边界)。

【记忆 13】文生图:场景插画用 `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=<URL编码>&image_size=<size>`,温暖手绘风、家庭生活、儿童友好。每个核心场景一张。

【记忆 14】范围外(不做):儿童独立账号、双端体系、会员支付、多儿童管理、课程商城、社区、排行榜、大型课程体系、开放 AI 聊天、完整 LMS、原生 App(已用 Capacitor 包装)、推送通知、离线学习、跟读评分。

【记忆 15】密钥管理:`server/.env` 与根目录 `.env.local` 不进 git。`server/.env` 含 JWT_SECRET / ARK_API_KEY / DEFAULT_ADMIN_PASSWORD。`.env.local` 含 VITE_ARK_API_KEY。换环境需手动创建(参考 `server/.env.example`)。

【记忆 16】数据库:SQLite,路径默认 `./data/app.db`,schema 在 `server/src/db/schema.ts`。首次需 `npm run migrate`,创建管理员 `npm run create-admin`。涉及表:users / sessions(历史记录) / points / rewards / tier。

【记忆 17】启动命令:前端 `npm run dev`(7500);后端 `cd server; npm run dev`(7550,tsx watch);后台 `cd server/admin-ui; npm run dev`;Android `npm run build; npx cap sync android; cd android; .\gradlew.bat assembleDebug`。

【记忆 18】PowerShell 限制:本机用 Windows,命令链式分隔用 `;` 不要用 `&&` 或 `||`(PowerShell 不支持)。

【记忆 19】响应语言:用中文回复用户。代码注释也用中文(除非用户另有要求)。

【记忆 20】文档优先级:`.trae/documents/HandoffAndProgress.md`(进度) > `DevelopmentRules.md`(规则) > `PRD.md`/`TechnicalArchitecture.md`(历史参考,已滞后)。

结束

---

> 上面的清单已尽量塞到项目记忆上限 20 条。若 AI 提示达到上限,优先保留 4(响应式红线)、6(Git 备份)、8(测试验收)、11(跟读方案)、15(密钥)、2(PRD 滞后)这 6 条最关键的。

## 3. 全局记忆候选(可选,跨项目复用)

如果新账户还需要全局记忆,可在任意项目里对 AI 说:

- 记住:我用 Windows + PowerShell,命令链式分隔用 `;`,不要用 `&&`。
- 记住:回复用中文,代码注释用中文。
- 记住:每次修改完成后必须先验证再声明完成,不接受"应该可以"。

## 4. 验证恢复是否成功

恢复后,在新会话里问 AI 以下几个问题自检(不用引用任何文档,看 AI 是否能直接答对):

1. "本项目前端默认端口是多少?" → 应答 **7500**
2. "手机端改样式有什么红线?" → 应答 **必须用 `sm:` 前缀隔离**
3. "跟读功能现在用哪个方案?" → 应答 **Web Speech API + Capacitor 插件,partialResults:true**
4. "改完代码后该做什么?" → 应答 **git add -A; git commit + 测试验收**
5. "PRD 还能信吗?" → 应答 **已滞后,以 HandoffAndProgress.md + 源码为准**

答对 4/5 以上即视为记忆恢复成功。

## 5. 长期维护建议

- 每次重要决策后,让 AI 用"记住:……"追加项目记忆
- 每次大版本节点(如 v3.0)更新 `HandoffAndProgress.md` 的 §8/§9
- 不要依赖会话历史长期保存信息——会话会被压缩/清理,文件不会
- 若记忆库满,优先淘汰"文档里已写明"的内容,保留"AI 不读文档也能记住的隐性约定"
