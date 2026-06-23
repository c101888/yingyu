// 跟读评分：语音识别 + 相似度评分
//
// 设计原则：
// 1. 统一使用 Web Speech API (webkitSpeechRecognition)，原生 App 的 WebView 也支持
// 2. 原生平台仅用 Capacitor 插件请求麦克风权限（保证原生权限弹窗稳定弹出）
// 3. 不调用 SpeechRecognition.available()——国内 Android 设备常返回 false 但实际可用
// 4. 全面处理所有错误：aborted/not-allowed/no-speech/network/audio-capture/service-not-allowed/启动异常

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

  const recSet = new Set(recWords);
  let matchedWords = 0;
  for (const w of origWords) {
    if (recSet.has(w)) matchedWords++;
  }

  const maxLen = Math.max(normOrig.length, normRec.length, 1);
  const dist = levenshtein(normOrig, normRec);
  const distSim = 1 - dist / maxLen;

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

export interface RecognizeOptions {
  lang?: string;        // 识别语言，默认 en-US
  onResult?: (result: RecognitionResult) => void;
  onError?: (err: string) => void;
  onEnd?: () => void;
}

// Web Speech API 类型
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
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
  message?: string;
}

function getRecognitionCtor(): { new (): SpeechRecognitionLike } | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: { new (): SpeechRecognitionLike };
    webkitSpeechRecognition?: { new (): SpeechRecognitionLike };
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// 是否支持语音识别：只看 WebView/浏览器是否有 webkitSpeechRecognition
export function recognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

// 全局识别状态：防止多个按钮同时启动导致 InvalidStateError
let activeRecognition: SpeechRecognitionLike | null = null;
function abortActive(): void {
  if (activeRecognition) {
    try {
      activeRecognition.abort?.();
      activeRecognition.stop();
    } catch {
      // 忽略停止时的异常
    }
    activeRecognition = null;
  }
}

// 原生平台麦克风权限请求（仅用于触发原生权限弹窗，不参与识别）
async function ensureNativeMicPermission(): Promise<{ ok: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) return { ok: true };
  try {
    // 先查当前权限
    const current = await SpeechRecognition.checkPermissions();
    if (current.speechRecognition === 'granted') return { ok: true };
    // 再请求
    const req = await SpeechRecognition.requestPermissions();
    if (req.speechRecognition === 'granted') return { ok: true };
    return { ok: false, error: '请允许麦克风权限后重试' };
  } catch (err) {
    // 即使插件出错也不阻断流程——尝试调用 webkitSpeechRecognition，由它再次请求权限
    console.warn('Capacitor 权限请求失败，回退到 WebView 自己请求权限:', err);
    return { ok: true };
  }
}

// 开始语音识别，返回 stop 函数
export function startRecognition(original: string, options: RecognizeOptions = {}): () => void {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    options.onError?.('当前环境不支持语音识别，请使用 Chrome 浏览器或最新版 App');
    return () => {};
  }

  // 先终止任何残留的识别实例，避免 "already started" 错误
  abortActive();

  let stopped = false;
  let finished = false;        // 是否已通过 onResult/onError 结束
  let retryCount = 0;
  const maxRetries = 2;
  let recognition: SpeechRecognitionLike | null = null;

  const finishOnce = (cb: () => void) => {
    if (finished) return;
    finished = true;
    cb();
  };

  const startAttempt = async () => {
    if (stopped) return;

    // 原生平台先请求麦克风权限
    const perm = await ensureNativeMicPermission();
    if (!perm.ok) {
      finishOnce(() => options.onError?.(perm.error || '请允许麦克风权限后重试'));
      return;
    }

    if (stopped) return;

    recognition = new Ctor();
    activeRecognition = recognition;
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
    };

    recognition.onerror = (event: SpeechRecognitionErrorLike) => {
      // aborted：WebView 权限刚授予时可能立即触发，自动重试
      if (event.error === 'aborted' && retryCount < maxRetries && !stopped) {
        retryCount++;
        setTimeout(() => {
          if (!stopped) startAttempt();
        }, 300);
        return;
      }

      let msg: string;
      switch (event.error) {
        case 'no-speech':
          msg = '没有听到声音，请大声说出英文后再次点击跟读';
          break;
        case 'not-allowed':
        case 'service-not-allowed':
          msg = '请允许麦克风权限后重试';
          break;
        case 'audio-capture':
          msg = '麦克风无法使用，请检查设备麦克风是否被占用';
          break;
        case 'network':
          msg = '语音识别需要网络连接，请检查网络后重试';
          break;
        case 'aborted':
          msg = '识别被中断，请再次点击跟读按钮';
          break;
        case 'language-not-supported':
          msg = '当前设备不支持英文识别，请安装英文语音包';
          break;
        default:
          msg = `识别失败：${event.error}${event.message ? ' - ' + event.message : ''}`;
      }
      finishOnce(() => options.onError?.(msg));
    };

    recognition.onend = () => {
      if (activeRecognition === recognition) activeRecognition = null;
      if (stopped) return;
      // 如果已经通过 onerror 结束，不重复处理
      if (finished) {
        options.onEnd?.();
        return;
      }
      // 检查是否有识别结果
      if (finalTranscript.trim()) {
        const result = calculateScore(original, finalTranscript);
        finishOnce(() => options.onResult?.(result));
      } else {
        // 没有结果 → 视为"没听到声音"，让 UI 进入 error 状态而不是卡死
        finishOnce(() => options.onError?.('没有听到声音，请大声说出英文后再次点击跟读'));
      }
      options.onEnd?.();
    };

    try {
      recognition.start();
    } catch (err) {
      // start() 抛异常常见原因：already started / network error
      if (retryCount < maxRetries && !stopped) {
        retryCount++;
        setTimeout(() => {
          // 先确保旧实例被清理
          if (recognition) {
            try { recognition.abort?.(); } catch {}
          }
          if (!stopped) startAttempt();
        }, 400);
        return;
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      let msg = '无法启动识别';
      if (errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('started')) {
        msg = '语音识别正在运行，请稍后再试';
      } else if (errMsg.toLowerCase().includes('network')) {
        msg = '语音识别需要网络连接，请检查网络后重试';
      } else {
        msg = `无法启动识别：${errMsg}`;
      }
      finishOnce(() => options.onError?.(msg));
    }
  };

  // 立即启动（async 但不 await，让函数同步返回 stop）
  void startAttempt();

  return () => {
    stopped = true;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // 忽略已停止的异常
      }
    }
    if (activeRecognition === recognition) activeRecognition = null;
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
