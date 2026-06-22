// 跟读评分：基于 Web Speech API 的 SpeechRecognition 进行语音识别 + 相似度评分
// 评分算法：Levenshtein 距离 + 词级匹配率

// 浏览器 SpeechRecognition 兼容性检测
export function recognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  );
}

// 获取 SpeechRecognition 构造函数
function getRecognitionCtor(): { new (): SpeechRecognitionLike } | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: { new (): SpeechRecognitionLike };
    webkitSpeechRecognition?: { new (): SpeechRecognitionLike };
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// SpeechRecognition 实例的最小类型定义（浏览器 API，TS 未内置）
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

interface SpeechRecognitionErrorLike {
  error: string;
}

export interface RecognitionResult {
  transcript: string;       // 识别出的文本
  score: number;            // 0-100 分
  matchedWords: number;     // 匹配的词数
  totalWords: number;       // 原文总词数
}

// 计算两个字符串的 Levenshtein 距离
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,        // 删除
        dp[i][j - 1] + 1,        // 插入
        dp[i - 1][j - 1] + cost, // 替换
      );
    }
  }
  return dp[m][n];
}

// 标准化文本：去除标点、转小写、压缩空格
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"(){}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 计算评分：基于词级匹配率 + 编辑距离
function calculateScore(original: string, recognized: string): RecognitionResult {
  const normOrig = normalize(original);
  const normRec = normalize(recognized);

  if (!normOrig) {
    return { transcript: recognized, score: 0, matchedWords: 0, totalWords: 0 };
  }

  const origWords = normOrig.split(' ').filter(Boolean);
  const recWords = normRec.split(' ').filter(Boolean);
  const totalWords = origWords.length;

  if (totalWords === 0) {
    return { transcript: recognized, score: 0, matchedWords: 0, totalWords: 0 };
  }

  // 词级匹配：统计原文中每个词是否在识别结果中出现
  const recSet = new Set(recWords);
  let matchedWords = 0;
  for (const w of origWords) {
    if (recSet.has(w)) matchedWords++;
  }

  // 编辑距离相似度（0-1）
  const maxLen = Math.max(normOrig.length, normRec.length, 1);
  const dist = levenshtein(normOrig, normRec);
  const distSim = 1 - dist / maxLen;

  // 综合评分：词匹配率 70% + 编辑距离相似度 30%
  const wordMatchRate = matchedWords / totalWords;
  const score = Math.round(Math.max(0, Math.min(100, (wordMatchRate * 0.7 + distSim * 0.3) * 100)));

  return {
    transcript: recognized,
    score,
    matchedWords,
    totalWords,
  };
}

// 识别选项
export interface RecognizeOptions {
  lang?: string;        // 识别语言，默认 en-US
  onResult?: (result: RecognitionResult) => void;
  onError?: (err: string) => void;
  onEnd?: () => void;
}

// 开始语音识别，返回一个可以调用的 stop 函数
export function startRecognition(original: string, options: RecognizeOptions = {}): () => void {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    options.onError?.('当前浏览器不支持语音识别，请使用 Chrome 浏览器');
    return () => {};
  }

  const recognition = new Ctor();
  recognition.lang = options.lang || 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  let finalTranscript = '';

  recognition.onresult = (event: SpeechRecognitionEventLike) => {
    // 拼接所有识别结果
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript;
      }
    }
    const result = calculateScore(original, finalTranscript);
    options.onResult?.(result);
  };

  recognition.onerror = (event: SpeechRecognitionErrorLike) => {
    let msg = '识别失败';
    if (event.error === 'no-speech') msg = '没有听到声音，请再试一次';
    else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      msg = '请允许麦克风权限后重试';
    } else if (event.error === 'aborted') {
      msg = '识别已取消';
    } else {
      msg = `识别失败：${event.error}`;
    }
    options.onError?.(msg);
  };

  recognition.onend = () => {
    options.onEnd?.();
  };

  try {
    recognition.start();
  } catch (err) {
    options.onError?.(`无法启动识别：${err instanceof Error ? err.message : '未知错误'}`);
    return () => {};
  }

  return () => {
    try {
      recognition.stop();
    } catch {
      // 忽略已停止的错误
    }
  };
}

// 评分等级文案
export function getScoreLabel(score: number): { label: string; color: string; emoji: string } {
  if (score >= 90) return { label: '太棒了！', color: 'text-primary', emoji: '🎉' };
  if (score >= 75) return { label: '很好！', color: 'text-primary', emoji: '👍' };
  if (score >= 60) return { label: '不错', color: 'text-amber-600', emoji: '💪' };
  if (score >= 40) return { label: '继续努力', color: 'text-amber-600', emoji: '📖' };
  return { label: '再试一次', color: 'text-destructive', emoji: '🔄' };
}
