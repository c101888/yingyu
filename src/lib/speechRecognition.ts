// 跟读评分：语音识别 + 相似度评分
// 原生 App（Capacitor）：使用 @capacitor-community/speech-recognition 插件（Android 系统 SpeechRecognizer）
// Web 环境：使用 Web Speech API（webkitSpeechRecognition）
//
// 为什么原生不用 Web Speech API：
// Android WebView 的 webkitSpeechRecognition 依赖 Google 语音服务，经常出现：
//   1. start() 抛异常 → "启动识别失败"
//   2. aborted 错误 → 权限刚授予时立即触发
//   3. service-not-allowed → 语音服务不可用
// 原生插件直接调用 Android SpeechRecognizer，稳定可靠。

import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

// ==================== 评分算法（共用） ====================

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

// ==================== 公共接口 ====================

// 识别选项
export interface RecognizeOptions {
  lang?: string;        // 识别语言，默认 en-US
  onResult?: (result: RecognitionResult) => void;
  onError?: (err: string) => void;
  onEnd?: () => void;
}

// 是否支持语音识别（原生平台始终支持，Web 平台检查 Web Speech API）
export function recognitionSupported(): boolean {
  // 原生平台：Capacitor 插件可用
  if (Capacitor.isNativePlatform()) return true;
  // Web 平台：检查 Web Speech API
  if (typeof window === 'undefined') return false;
  return !!(
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  );
}

// 开始语音识别，返回一个可以调用的 stop 函数
export function startRecognition(original: string, options: RecognizeOptions = {}): () => void {
  // 原生平台：用 Capacitor 插件
  if (Capacitor.isNativePlatform()) {
    return startNativeRecognition(original, options);
  }
  // Web 平台：用 Web Speech API
  return startWebRecognition(original, options);
}

// ==================== 原生识别（Capacitor 插件） ====================

function startNativeRecognition(original: string, options: RecognizeOptions): () => void {
  let stopped = false;
  const lang = options.lang || 'en-US';

  // 异步执行：检查可用性 → 请求权限 → 开始识别
  (async () => {
    try {
      // 1. 检查设备是否支持语音识别
      const availResult = await SpeechRecognition.available();
      if (!availResult.available) {
        if (!stopped) options.onError?.('设备不支持语音识别，请检查系统语音服务');
        return;
      }

      // 2. 请求麦克风权限（原生弹窗，不依赖 WebView 权限回调）
      const permResult = await SpeechRecognition.requestPermissions();
      if (permResult.speechRecognition !== 'granted') {
        if (!stopped) options.onError?.('请允许麦克风权限后重试');
        return;
      }

      if (stopped) return;

      // 3. 开始识别（popup: false 不弹系统对话框，直接录音）
      const result = await SpeechRecognition.start({
        language: lang,
        maxResults: 1,
        partialResults: false,
        popup: false,
      });

      if (stopped) return;

      // 4. 处理识别结果
      const matches = result.matches || [];
      if (matches.length === 0) {
        if (!stopped) options.onError?.('没有听到声音，请再试一次');
        return;
      }

      const transcript = matches[0];
      const scoreResult = calculateScore(original, transcript);
      if (!stopped) options.onResult?.(scoreResult);
    } catch (err) {
      if (stopped) return;
      const errMsg = err instanceof Error ? err.message : String(err);
      // 常见原生错误映射
      let msg = '识别失败';
      if (errMsg.includes('permission') || errMsg.includes('Permission')) {
        msg = '请允许麦克风权限后重试';
      } else if (errMsg.includes('network') || errMsg.includes('Network')) {
        msg = '网络错误，语音识别需要网络连接';
      } else if (errMsg.includes('no') && errMsg.includes('speech')) {
        msg = '没有听到声音，请再试一次';
      } else if (errMsg.includes('not') && errMsg.includes('available')) {
        msg = '设备不支持语音识别，请检查系统语音服务';
      } else if (errMsg.includes('busy') || errMsg.includes('listening')) {
        msg = '语音识别正在运行，请稍后再试';
      } else {
        msg = `识别失败：${errMsg}`;
      }
      options.onError?.(msg);
    } finally {
      if (!stopped) options.onEnd?.();
    }
  })();

  // 返回 stop 函数
  return () => {
    stopped = true;
    SpeechRecognition.stop().catch(() => {});
  };
}

// ==================== Web 识别（Web Speech API） ====================

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

// 获取 Web SpeechRecognition 构造函数
function getRecognitionCtor(): { new (): SpeechRecognitionLike } | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: { new (): SpeechRecognitionLike };
    webkitSpeechRecognition?: { new (): SpeechRecognitionLike };
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function startWebRecognition(original: string, options: RecognizeOptions): () => void {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    options.onError?.('当前浏览器不支持语音识别，请使用 Chrome 浏览器');
    return () => {};
  }

  let retryCount = 0;
  const maxRetries = 2; // aborted 时最多重试 2 次
  let stopped = false;
  let recognition: SpeechRecognitionLike | null = null;

  const startAttempt = () => {
    if (stopped) return;
    recognition = new Ctor();
    recognition.lang = options.lang || 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    let finalTranscript = '';

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
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
      // aborted 错误：浏览器/WebView 权限刚授予时可能立即触发，自动重试
      if (event.error === 'aborted' && retryCount < maxRetries) {
        retryCount++;
        setTimeout(() => {
          if (!stopped) startAttempt();
        }, 300);
        return;
      }

      let msg = '识别失败';
      if (event.error === 'no-speech') msg = '没有听到声音，请再试一次';
      else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        msg = '请允许麦克风权限后重试';
      } else if (event.error === 'audio-capture') {
        msg = '麦克风无法使用，请检查设备';
      } else if (event.error === 'network') {
        msg = '网络错误，语音识别需要网络连接';
      } else if (event.error === 'aborted') {
        msg = '识别启动失败，请再次点击跟读按钮';
      } else {
        msg = `识别失败：${event.error}`;
      }
      options.onError?.(msg);
    };

    recognition.onend = () => {
      if (!stopped) options.onEnd?.();
    };

    try {
      recognition.start();
    } catch (err) {
      // start 失败可能是 "already started"，延迟后重试
      if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(() => {
          if (!stopped) startAttempt();
        }, 300);
        return;
      }
      options.onError?.(`无法启动识别：${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  startAttempt();

  return () => {
    stopped = true;
    if (recognition) {
      try {
        recognition.stop();
      } catch {}
    }
  };
}

// ==================== 评分等级文案 ====================

export function getScoreLabel(score: number): { label: string; color: string; emoji: string } {
  if (score >= 90) return { label: '太棒了！', color: 'text-primary', emoji: '🎉' };
  if (score >= 75) return { label: '很好！', color: 'text-primary', emoji: '👍' };
  if (score >= 60) return { label: '不错', color: 'text-amber-600', emoji: '💪' };
  if (score >= 40) return { label: '继续努力', color: 'text-amber-600', emoji: '📖' };
  return { label: '再试一次', color: 'text-destructive', emoji: '🔄' };
}
