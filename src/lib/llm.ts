import type { SceneContent, Difficulty } from './types';
import { api, checkBackend } from './api';

// 经 Vite 代理调用火山引擎 ARK（GLM-5.2），代理自动注入 Authorization
// 生产环境（APK）使用线上后端地址，开发环境用相对路径
const LLM_ENDPOINT = import.meta.env.PROD
  ? 'http://47.250.140.131:7500/api/llm/chat/completions'
  : '/api/llm/chat/completions';
const MODEL = 'glm-5.2';
const MAX_RETRY = 2;

// 剥离 markdown 代码块，提取 JSON
function extractJson(raw: string): string {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    text = fence[1].trim();
  }
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    text = text.slice(first, last + 1);
  }
  return text;
}

// 判断字符串是否包含英文字母（英文为主要求）
function hasEnglish(s: string): boolean {
  return /[a-zA-Z]/.test(s);
}

// 校验内容：英文为主，必须有英文；纯中文字段视为无效
function validateContent(data: Record<string, unknown>): boolean {
  // 场景英文名必须有
  if (!data.sceneNameEn || !hasEnglish(String(data.sceneNameEn))) return false;
  // 词汇 word 必须是英文
  if (!Array.isArray(data.vocab) || data.vocab.length === 0) return false;
  for (const v of data.vocab) {
    if (!hasEnglish(String(v.word || ''))) return false;
  }
  // 核心句子 en 必须有英文
  if (!Array.isArray(data.coreSentences) || data.coreSentences.length === 0) return false;
  for (const s of data.coreSentences) {
    if (!hasEnglish(String(s.en || ''))) return false;
  }
  // 对话 parent/child 必须有英文
  if (!Array.isArray(data.dialogue) || data.dialogue.length === 0) return false;
  for (const d of data.dialogue) {
    if (!hasEnglish(String(d.parent || ''))) return false;
    if (!hasEnglish(String(d.child || ''))) return false;
  }
  return true;
}

// 容错：补全/截断字段，兼容 LLM 可能返回的不同字段名
// maxVocab/maxSentences/maxDialogue 按难度调整上限
function normalizeContent(
  data: Record<string, unknown>,
  fallbackName: string,
  maxVocab = 4,
  maxSentences = 6,
  maxDialogue = 3,
): SceneContent {
  const rawVocab = Array.isArray(data.vocab) ? data.vocab : [];
  const vocab = rawVocab.slice(0, maxVocab).map((v) => {
    const o = v as Record<string, unknown>;
    return {
      word: String(o.word || ''),
      // 兼容 LLM 返回 zh / meaning / meaningZh 等字段名
      meaningZh: String(o.meaningZh || o.zh || o.meaning || ''),
      ipa: String(o.ipa || o.phonetic || ''),
    };
  });
  const dialogue = (Array.isArray(data.dialogue) ? data.dialogue : [])
    .slice(0, maxDialogue)
    .map((d, i) => {
      const o = d as Record<string, unknown>;
      return {
        round: i + 1,
        parent: String(o.parent || ''),
        child: String(o.child || ''),
        // 兼容 LLM 可能不返回中文翻译字段
        parentZh: String(o.parentZh || o.parent_zh || ''),
        childZh: String(o.childZh || o.child_zh || ''),
      };
    });
  return {
    sceneNameZh: String(data.sceneNameZh || fallbackName),
    sceneNameEn: String(data.sceneNameEn || ''),
    vocab,
    coreSentences: (Array.isArray(data.coreSentences) ? data.coreSentences : [])
      .slice(0, maxSentences)
      .map((s) => {
        const o = s as Record<string, unknown>;
        return {
          en: String(o.en || ''),
          zh: String(o.zh || o.translation || ''),
        };
      }),
    dialogue,
  };
}

// 黄瓜兜底内容（API 不可用时使用，保证闭环可走通）
export const CUCUMBER_FALLBACK: SceneContent = {
  sceneNameZh: '吃黄瓜',
  sceneNameEn: 'Eating Cucumber',
  vocab: [
    { word: 'cucumber', meaningZh: '黄瓜', ipa: '/ˈkjuːkʌmbər/' },
    { word: 'eating', meaningZh: '吃', ipa: '/ˈiːtɪŋ/' },
    { word: 'crunchy', meaningZh: '脆的', ipa: '/ˈkrʌntʃi/' },
    { word: 'like', meaningZh: '喜欢', ipa: '/laɪk/' },
  ],
  coreSentences: [
    { en: 'What are you eating?', zh: '你在吃什么？' },
    { en: "I'm eating a cucumber.", zh: '我在吃黄瓜。' },
    { en: 'Is it crunchy?', zh: '脆吗？' },
    { en: 'Yes, it is.', zh: '是的，很脆。' },
    { en: 'Do you like it?', zh: '你喜欢吗？' },
    { en: "Yes, I do. / No, I don't.", zh: '喜欢。/ 不喜欢。' },
  ],
  dialogue: [
    {
      round: 1,
      parent: 'What are you eating?',
      child: "I'm eating a cucumber.",
      parentZh: '你在吃什么？',
      childZh: '我在吃黄瓜。',
    },
    {
      round: 2,
      parent: 'Is it crunchy?',
      child: 'Yes, it is.',
      parentZh: '脆吗？',
      childZh: '是的，很脆。',
    },
    {
      round: 3,
      parent: 'Do you like it?',
      child: "Yes, I do. / No, I don't.",
      parentZh: '你喜欢吗？',
      childZh: '喜欢。/ 不喜欢。',
    },
  ],
};

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export class LLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMError';
  }
}

// 难度参数：控制词汇/句子/对话的数量与复杂度
interface DifficultyConfig {
  maxVocab: number;
  maxSentences: number;
  maxDialogue: number;
  // prompt 中描述的词汇/句子复杂度
  complexityDesc: string;
}

const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: {
    maxVocab: 4,
    maxSentences: 6,
    maxDialogue: 3,
    complexityDesc:
      'Use SIMPLE words and short sentences suitable for kids aged 3-5. ' +
      'Basic vocabulary (e.g. eat, like, want, good). Short sentences (3-6 words). ' +
      'Present tense only. No complex grammar.',
  },
  medium: {
    maxVocab: 6,
    maxSentences: 8,
    maxDialogue: 4,
    complexityDesc:
      'Use MODERATE words and sentences suitable for kids aged 5-7. ' +
      'Include some new vocabulary beyond basics. Medium-length sentences (5-10 words). ' +
      'Can use present and past tense. Simple conjunctions (and, but, because).',
  },
  hard: {
    maxVocab: 8,
    maxSentences: 10,
    maxDialogue: 5,
    complexityDesc:
      'Use RICH words and longer sentences suitable for kids aged 7-10. ' +
      'Advanced vocabulary and phrases. Longer sentences (8-15 words). ' +
      'Mixed tenses (present, past, future). Complex sentences with because, if, when. ' +
      'Include questions and reasoning.',
  },
};

// 单次调用 LLM
async function callLLM(sceneInput: string, difficulty: Difficulty): Promise<SceneContent> {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const prompt = buildPrompt(sceneInput, difficulty, cfg);
  const res = await fetch(LLM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new LLMError(`LLM 请求失败：${res.status}`);
  }

  const data: ChatResponse = await res.json();
  const raw = data.choices?.[0]?.message?.content || '';
  if (!raw) throw new LLMError('LLM 返回为空');

  const jsonStr = extractJson(raw);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new LLMError('LLM 返回的 JSON 解析失败');
  }

  // 校验英文为主：不通过则抛错触发重试
  if (!validateContent(parsed)) {
    throw new LLMError('生成内容缺少英文（存在纯中文字段），需重试');
  }

  return normalizeContent(parsed, sceneInput, cfg.maxVocab, cfg.maxSentences, cfg.maxDialogue);
}

// 调用 LLM 生成场景英语内容（含重试，失败抛错由调用方处理）
// 优先查询场景缓存（所有用户共享，归一化匹配），命中则直接返回；未命中则调用 LLM 并写入缓存
export async function generateSceneContent(
  sceneInput: string,
  difficulty: Difficulty = 'easy',
): Promise<SceneContent> {
  // 1. 尝试命中缓存（后台可用时）
  try {
    const backendUp = await checkBackend();
    if (backendUp) {
      try {
        const cached = await api.checkSceneCache(sceneInput, difficulty);
        if (cached?.hit && cached.content) {
          // 缓存命中，直接返回（节省一次 LLM 调用）
          return cached.content as SceneContent;
        }
      } catch {
        // 缓存查询失败（如 404 未命中、网络错误），静默降级到 LLM 生成
      }
    }
  } catch {
    // 后台检测失败，静默降级
  }

  // 2. 缓存未命中，调用 LLM 生成
  let lastErr: unknown = null;
  let content: SceneContent | null = null;
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      content = await callLLM(sceneInput, difficulty);
      break;
    } catch (err) {
      lastErr = err;
      // 最后一次不再等待
      if (attempt < MAX_RETRY) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }
  if (!content) {
    throw lastErr instanceof Error ? lastErr : new LLMError('LLM 生成失败');
  }

  // 3. 异步写入缓存（fire-and-forget，不阻塞返回）
  // 仅当后台可用时尝试；INSERT OR IGNORE 保证第一个生成者胜出
  try {
    const backendUp = await checkBackend();
    if (backendUp) {
      api.saveSceneCache(sceneInput, difficulty, content).catch(() => {
        // 写入失败静默忽略，不影响主流程
      });
    }
  } catch {
    // 静默忽略
  }

  return content;
}

// 丰富场景细节：根据用户补充说明，在现有内容基础上调整
// mode='enrich'：保留原对话轮次，在其上增加新轮次和细节（推荐）
// mode='regenerate'：完全重新生成
// Pro 功能：非 Pro 用户在调用方做权限拦截
export type EnrichMode = 'enrich' | 'regenerate';

export async function enrichSceneContent(
  sceneInput: string,
  difficulty: Difficulty,
  currentContent: SceneContent,
  userHint: string,
  mode: EnrichMode = 'enrich',
): Promise<SceneContent> {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const prompt = buildEnrichPrompt(sceneInput, difficulty, cfg, currentContent, userHint, mode);
  const res = await fetch(LLM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: mode === 'enrich' ? 0.4 : 0.5,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new LLMError(`LLM 请求失败：${res.status}`);
  }

  const data: ChatResponse = await res.json();
  const raw = data.choices?.[0]?.message?.content || '';
  if (!raw) throw new LLMError('LLM 返回为空');

  const jsonStr = extractJson(raw);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new LLMError('LLM 返回的 JSON 解析失败');
  }

  if (!validateContent(parsed)) {
    throw new LLMError('生成内容缺少英文（存在纯中文字段），需重试');
  }

  // enrich 模式：合并原对话 + 新对话，保留原轮次
  if (mode === 'enrich') {
    return mergeEnrichedContent(currentContent, normalizeContent(parsed, sceneInput, cfg.maxVocab, cfg.maxSentences, cfg.maxDialogue), cfg.maxDialogue);
  }
  return normalizeContent(parsed, sceneInput, cfg.maxVocab, cfg.maxSentences, cfg.maxDialogue);
}

// enrich 模式合并策略：保留原对话全部轮次，追加新对话中不重复的轮次，上限 maxDialogue*2
function mergeEnrichedContent(original: SceneContent, enriched: SceneContent, maxDialogue: number): SceneContent {
  const upperLimit = Math.min(maxDialogue + 2, 6); // 最多 6 轮，避免过长
  const merged = [...original.dialogue];
  for (const d of enriched.dialogue) {
    // 跳过与原对话重复的轮次（按 parent+child 内容判断）
    const isDup = merged.some(
      (m) => m.parent === d.parent && m.child === d.child,
    );
    if (!isDup && merged.length < upperLimit) {
      merged.push({ ...d, round: merged.length + 1 });
    }
  }
  // 合并词汇：原词汇 + 新词汇中不重复的，去重
  const vocabWords = new Set(original.vocab.map((v) => v.word.toLowerCase()));
  const mergedVocab = [...original.vocab];
  for (const v of enriched.vocab) {
    if (!vocabWords.has(v.word.toLowerCase()) && mergedVocab.length < 8) {
      mergedVocab.push(v);
      vocabWords.add(v.word.toLowerCase());
    }
  }
  // 合并核心句子：原句子 + 新句子中不重复的
  const sentSet = new Set(original.coreSentences.map((s) => s.en.toLowerCase()));
  const mergedSentences = [...original.coreSentences];
  for (const s of enriched.coreSentences) {
    if (!sentSet.has(s.en.toLowerCase()) && mergedSentences.length < 10) {
      mergedSentences.push(s);
      sentSet.add(s.en.toLowerCase());
    }
  }
  return {
    sceneNameZh: enriched.sceneNameZh || original.sceneNameZh,
    sceneNameEn: enriched.sceneNameEn || original.sceneNameEn,
    vocab: mergedVocab,
    coreSentences: mergedSentences,
    dialogue: merged,
  };
}

function buildEnrichPrompt(
  sceneInput: string,
  difficulty: Difficulty,
  cfg: DifficultyConfig,
  currentContent: SceneContent,
  userHint: string,
  mode: EnrichMode,
): string {
  const difficultyLabel = difficulty === 'easy' ? 'Easy (简单)' : difficulty === 'medium' ? 'Medium (难度)' : 'Hard (复杂)';
  const currentJson = JSON.stringify({
    sceneNameZh: currentContent.sceneNameZh,
    sceneNameEn: currentContent.sceneNameEn,
    vocab: currentContent.vocab,
    coreSentences: currentContent.coreSentences,
    dialogue: currentContent.dialogue,
  });

  const modeInstruction = mode === 'enrich'
    ? [
        'MODE: ENRICH (保留原对话，增加细节)',
        'CRITICAL: You MUST KEEP ALL original dialogue rounds unchanged. Do NOT modify or remove any existing dialogue.',
        'You should ADD 1-2 NEW dialogue rounds that incorporate the user instruction, placing them AFTER the original rounds.',
        'You may also ADD new vocab items and core sentences that fit the user instruction.',
        'Keep existing vocab and sentences. New ones should be ADDITIVE, not replacements.',
        `Total dialogue rounds after enriching: ${currentContent.dialogue.length + 1} to ${Math.min(currentContent.dialogue.length + 2, 6)}.`,
      ].join('\n')
    : [
        'MODE: REGENERATE (完全重新生成)',
        'The user wants to ENRICH/ADJUST the current content based on this instruction:',
        `"${userHint}"`,
        'Current content (adjust based on user instruction, keep what works, change what user wants):',
        currentJson,
        `Requirements: exactly ${cfg.maxVocab} vocab items, ${cfg.maxSentences - 2}-${cfg.maxSentences} coreSentences, exactly ${cfg.maxDialogue} dialogue rounds.`,
      ].join('\n');

  return [
    'You are an English teaching assistant for Chinese families with kids.',
    'The real-life scene is: ' + sceneInput,
    'You MUST generate content ONLY about this scene. Do NOT change to another scene.',
    '',
    `DIFFICULTY LEVEL: ${difficultyLabel}`,
    cfg.complexityDesc,
    '',
    mode === 'enrich'
      ? `The user wants to ADD details/enrichment to the current content based on this instruction:\n"${userHint}"\n\nCurrent content (MUST preserve original dialogue rounds, add new ones based on instruction):`
      : '',
    mode === 'enrich' ? currentJson : '',
    '',
    modeInstruction,
    '',
    'CRITICAL LANGUAGE RULES (violation = failure):',
    '- sceneNameEn MUST be in English (e.g. "Eating an Apple"), NOT Chinese.',
    '- vocab[].word MUST be an English word (e.g. "apple"), NOT Chinese.',
    '- vocab[].meaningZh MUST be the Chinese translation.',
    '- coreSentences[].en MUST be an English sentence, NOT Chinese.',
    '- coreSentences[].zh MUST be the Chinese translation.',
    '- dialogue[].parent and dialogue[].child MUST be in English, NOT Chinese.',
    '- dialogue[].parentZh and dialogue[].childZh MUST be the Chinese translation.',
    '- NEVER put Chinese in any English field. English fields contain ONLY English.',
    '',
    'Output ONLY valid JSON, no markdown, no explanation.',
    'Use EXACTLY the JSON field names: sceneNameZh, sceneNameEn, vocab[], coreSentences[], dialogue[].',
    'Every vocab MUST have: word, meaningZh, ipa. Every dialogue MUST have: round, parent, child, parentZh, childZh.',
  ].filter(Boolean).join('\n');
}

function buildPrompt(sceneInput: string, difficulty: Difficulty, cfg: DifficultyConfig): string {
  const difficultyLabel = difficulty === 'easy' ? 'Easy (简单)' : difficulty === 'medium' ? 'Medium (难度)' : 'Hard (复杂)';
  return [
    'You are an English teaching assistant for Chinese families with kids.',
    'The real-life scene is: ' + sceneInput,
    'You MUST generate content ONLY about this scene. Do NOT change to another scene.',
    '',
    `DIFFICULTY LEVEL: ${difficultyLabel}`,
    cfg.complexityDesc,
    `Requirements: exactly ${cfg.maxVocab} vocab items, ${cfg.maxSentences - 2}-${cfg.maxSentences} coreSentences, exactly ${cfg.maxDialogue} dialogue rounds.`,
    '',
    'CRITICAL LANGUAGE RULES (violation = failure):',
    '- sceneNameEn MUST be in English (e.g. "Eating an Apple"), NOT Chinese.',
    '- vocab[].word MUST be an English word (e.g. "apple"), NOT Chinese.',
    '- vocab[].meaningZh MUST be the Chinese translation.',
    '- coreSentences[].en MUST be an English sentence, NOT Chinese.',
    '- coreSentences[].zh MUST be the Chinese translation.',
    '- dialogue[].parent and dialogue[].child MUST be in English, NOT Chinese.',
    '- dialogue[].parentZh and dialogue[].childZh MUST be the Chinese translation.',
    '- NEVER put Chinese in any English field. English fields contain ONLY English.',
    '',
    'Example output for scene "吃苹果" (Easy difficulty):',
    JSON.stringify({
      sceneNameZh: '吃苹果',
      sceneNameEn: 'Eating an Apple',
      vocab: [
        { word: 'apple', meaningZh: '苹果', ipa: '/ˈæpəl/' },
        { word: 'sweet', meaningZh: '甜的', ipa: '/swiːt/' },
        { word: 'bite', meaningZh: '咬', ipa: '/baɪt/' },
        { word: 'red', meaningZh: '红色的', ipa: '/red/' },
      ],
      coreSentences: [
        { en: 'This apple is so sweet!', zh: '这个苹果真甜！' },
        { en: 'Can I have another bite?', zh: '我能再咬一口吗？' },
        { en: 'I love red apples.', zh: '我喜欢红苹果。' },
      ],
      dialogue: [
        { round: 1, parent: 'Do you like the apple?', child: 'Yes, it is sweet!', parentZh: '你喜欢这个苹果吗？', childZh: '喜欢，很甜！' },
        { round: 2, parent: 'Have another bite.', child: 'Thank you, Mom!', parentZh: '再咬一口。', childZh: '谢谢妈妈！' },
      ],
    }),
    '',
    'Now generate for the scene above at the specified difficulty. Output ONLY valid JSON, no markdown, no explanation.',
    'Use EXACTLY the JSON field names from the example. Every vocab MUST have: word, meaningZh, ipa. Every dialogue MUST have: round, parent, child, parentZh, childZh. Do NOT rename or omit any field.',
  ].join('\n');
}
