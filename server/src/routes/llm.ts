// LLM 代理路由：生产环境下替代 Vite 代理
// 前端调用 /api/llm/chat/completions，由后端转发到 LLM 服务
// 使用 llmScheduler 进行多模型调度（failover/loadbalance）

import { Router, Request, Response } from 'express';
import { callLlm } from '../lib/llmScheduler.js';

const router = Router();

// POST /api/llm/chat/completions
// 请求体格式（OpenAI 兼容）：
// { model: string, messages: [{role, content}], temperature?: number }
// 响应体格式（OpenAI 兼容）：
// { choices: [{ message: { content: string } }] }
router.post('/chat/completions', async (req: Request, res: Response) => {
  try {
    const { messages, temperature } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: { message: 'messages 字段必填且不能为空', type: 'invalid_request_error' } });
      return;
    }

    const result = await callLlm(messages, { temperature: typeof temperature === 'number' ? temperature : undefined });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('LLM 代理调用失败:', message);
    res.status(500).json({ error: { message, type: 'server_error' } });
  }
});

export default router;
