// 跟读评分：语音识别 + 相似度评分
//
// 架构（v1.6 终极方案）：
// - 原生 App (Capacitor): 完全使用 @capacitor-community/speech-recognition 插件
//   * 直接调用 Android 系统 SpeechRecognizer（小米/华为等国内手机自带，不依赖 Google 服务）
//   * 通过 listeningState 事件感知录音开始/结束
//   * 通过 partialResults 事件获取增量识别结果
//   * 用户点"停止"时主动调用 stop()，累积的 partialResults 用于评分
// - Web 浏览器: 使用 webkitSpeechRecognition（Chrome 自带 Google 语音服务可用）
//
// 设计决策记录：
// 1. 国内安卓的 WebView 中 webkitSpeechRecognition 几乎不可用（无 Google 服务），
//    表现为 start() 不报错但立即 onend 且 finalTranscript 为空 —— 这是历史几次修复
//    都没解决跟读问题的根本原因。
// 2. SpeechRecognition.available() 国内安卓常错报 false，故不调用 available 阻断流程。
// 3. 原生插件 partialResults: true 时 start() 立即 resolve void，结果通过事件流；
//    partialResults: false 时 start() 等到说话结束后 resolve 带 matches —— 我们用
//    前者，以便用户点"停止"主动结束。

import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import type { PluginListenerHandle } from '@capacitor/core';

// ==================== 评分算法 ====================

export interface RecognitionResult {
  transcript: string;
  score: number;
  matchedWords: number;
  totalWords: number;
}

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
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"(){}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateScore(original: string, recognized: string): RecognitionResult {
  const normOrig = normalize(original);
  const normRec = normalize(recognized);
  if (!normOrig) return { transcript: recognized, score: 0, matchedWords: 0, totalWords: 0 };
  const origWords = normOrig.split(' ').filter(Boolean);
  const recWords = normRec.split(' ').filter(Boolean);
  const totalWords = origWords.length;
  if (totalWords === 0) return { transcript: recognized, score: 0, matchedWords: 0, totalWords: 0 };
  const recSet = new Set(recWords);
  let matchedWords = 0;
  for (const w of origWords) if (recSet.has(w)) matchedWords++;
  const maxLen = Math.max(normOrig.length, normRec.length, 1);
  const dist = levenshtein(normOrig, normRec);
  const distSim = 1 - dist / maxLen;
  const wordMatchRate = matchedWords / totalWords;
  const score = Math.round(Math.max(0, Math.min(100, (wordMatchRate * 0.7 + distSim * 0.3) * 100)));
  return { transcript: recognized, score, matchedWords, totalWords };
}

// ==================== 公共接口 ====================

export interface RecognizeOptions {
  lang?: string;
  onStart?: () => void;          // 录音真正开始（用户可以开口说话）
  onResult?: (result: RecognitionResult) => void;
  onError?: (err: string) => void;
  onEnd?: () => void;
}

// 是否支持：原生平台始终走插件（系统级支持），Web 检查 webkitSpeechRecognition
export function recognitionSupported(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  if (typeof window === 'undefined') return false;
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

// 统一入口
export function startRecognition(original: string, options: RecognizeOptions = {}): () => void {
  if (Capacitor.isNativePlatform()) {
    return startNativeRecognition(original, options);
  }
  return startWebRecognition(original, options);
}

// ==================== 原生识别（Capacitor 插件） ====================

let nativeRecognitionActive = false; // 全局活动锁

function startNativeRecognition(original: string, options: RecognizeOptions): () => void {
  const lang = options.lang || 'en-US';
  let stopped = false;
  let finished = false;
  let listeningHandle: PluginListenerHandle | null = null;
  let partialHandle: PluginListenerHandle | null = null;
  let accumulatedTranscript = '';
  let lastPartialMatches: string[] = [];

  const cleanup = async () => {
    try { await listeningHandle?.remove(); } catch {}
    try { await partialHandle?.remove(); } catch {}
    listeningHandle = null;
    partialHandle = null;
    nativeRecognitionActive = false;
  };

  const finishOnce = (cb: () => void) => {
    if (finished) return;
    finished = true;
    cb();
    options.onEnd?.();
    void cleanup();
  };

  (async () => {
    try {
      // 如果有残留识别在跑，先停掉
      if (nativeRecognitionActive) {
        try { await SpeechRecognition.stop(); } catch {}
        nativeRecognitionActive = false;
      }

      // 1. 检查/请求权限
      let perm = await SpeechRecognition.checkPermissions();
      if (perm.speechRecognition !== 'granted') {
        perm = await SpeechRecognition.requestPermissions();
      }
      if (perm.speechRecognition !== 'granted') {
        finishOnce(() => options.onError?.('请允许麦克风权限后重试'));
        return;
      }

      if (stopped) return;

      // 2. 注册 listeningState 事件 —— 让 UI 在录音真正开始时进入"录音中"
      try {
        listeningHandle = await SpeechRecognition.addListener(
          'listeningState',
          (data: { status: 'started' | 'stopped' }) => {
            console.warn('[SpeechRecognition] listeningState:', data.status);
            if (data.status === 'started' && !stopped && !finished) {
              options.onStart?.();
            }
          },
        );
      } catch (err) {
        console.warn('[SpeechRecognition] addListener listeningState 失败', err);
      }

      // 3. 注册 partialResults 事件 —— 累积识别结果
      try {
        partialHandle = await SpeechRecognition.addListener(
          'partialResults',
          (data: { matches: string[] }) => {
            console.warn('[SpeechRecognition] partialResults:', data.matches);
            if (data.matches && data.matches.length > 0) {
              lastPartialMatches = data.matches;
            }
          },
        );
      } catch (err) {
        console.warn('[SpeechRecognition] addListener partialResults 失败', err);
      }

      if (stopped) {
        await cleanup();
        return;
      }

      // 4. 启动识别
      // partialResults: true → start() 立即 resolve，结果通过事件流；用户主动 stop() 时再评分
      nativeRecognitionActive = true;
      try {
        const result = await SpeechRecognition.start({
          language: lang,
          maxResults: 5,
          partialResults: true,
          popup: false,
        });
        console.warn('[SpeechRecognition] start() resolved:', result);

        // 某些实现 start() 也可能直接返回 matches（partialResults:false 时）
        if (result && Array.isArray(result.matches) && result.matches.length > 0) {
          accumulatedTranscript = result.matches[0];
        }
      } catch (err) {
        nativeRecognitionActive = false;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn('[SpeechRecognition] start() rejected:', errMsg);
        finishOnce(() => options.onError?.(mapNativeError(errMsg)));
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('[SpeechRecognition] outer error:', errMsg);
      finishOnce(() => options.onError?.(mapNativeError(errMsg)));
    }
  })();

  // 返回 stop 函数：用户点"停止录音"时调用
  return () => {
    if (stopped) return;
    stopped = true;
    void (async () => {
      try {
        // 主动停止识别
        await SpeechRecognition.stop();
      } catch (err) {
        console.warn('[SpeechRecognition] stop() error:', err);
      }
      nativeRecognitionActive = false;

      if (finished) return;

      // 用累积的 partialResults 或 start() 返回的 transcript 评分
      const transcript = accumulatedTranscript || (lastPartialMatches[0] ?? '');
      console.warn('[SpeechRecognition] final transcript:', transcript);
      if (transcript.trim()) {
        const scored = calculateScore(original, transcript);
        finishOnce(() => options.onResult?.(scored));
      } else {
        finishOnce(() => options.onError?.('没有听到清晰的英文，请靠近麦克风并大声朗读后重试'));
      }
    })();
  };
}

function mapNativeError(errMsg: string): string {
  const lower = errMsg.toLowerCase();
  if (lower.includes('permission') || lower.includes('denied')) {
    return '请允许麦克风权限后重试';
  }
  if (lower.includes('not available') || lower.includes('not supported')) {
    return '当前设备的系统语音识别不可用，请到"设置-应用-语音输入"检查';
  }
  if (lower.includes('network')) {
    return '语音识别需要网络连接，请检查网络后重试';
  }
  if (lower.includes('busy') || lower.includes('already')) {
    return '语音识别正在运行，请稍后再试';
  }
  if (lower.includes('no match') || lower.includes('no speech')) {
    return '没有听到清晰的英文，请靠近麦克风并大声朗读后重试';
  }
  if (lower.includes('cancel') || lower.includes('abort')) {
    return '识别被取消，请重新点击跟读';
  }
  if (lower.includes('language')) {
    return '当前设备未安装英文识别包，请到系统设置安装';
  }
  return `识别失败：${errMsg}`;
}

// ==================== Web 识别（Web Speech API） ====================

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart: (() => void) | null;
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

let webActiveRecognition: SpeechRecognitionLike | null = null;

function startWebRecognition(original: string, options: RecognizeOptions): () => void {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    options.onError?.('当前浏览器不支持语音识别，请使用 Chrome 浏览器');
    return () => {};
  }

  // 清理残留实例
  if (webActiveRecognition) {
    try {
      webActiveRecognition.abort?.();
      webActiveRecognition.stop();
    } catch {}
    webActiveRecognition = null;
  }

  let stopped = false;
  let finished = false;
  let retryCount = 0;
  const maxRetries = 2;
  let recognition: SpeechRecognitionLike | null = null;

  const finishOnce = (cb: () => void) => {
    if (finished) return;
    finished = true;
    cb();
  };

  const startAttempt = () => {
    if (stopped) return;
    recognition = new Ctor();
    webActiveRecognition = recognition;
    recognition.lang = options.lang || 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    let finalTranscript = '';

    recognition.onstart = () => {
      if (!stopped && !finished) options.onStart?.();
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalTranscript += r[0].transcript;
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorLike) => {
      if (event.error === 'aborted' && retryCount < maxRetries && !stopped) {
        retryCount++;
        setTimeout(() => { if (!stopped) startAttempt(); }, 300);
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
          msg = '当前浏览器不支持英文识别';
          break;
        default:
          msg = `识别失败：${event.error}${event.message ? ' - ' + event.message : ''}`;
      }
      finishOnce(() => options.onError?.(msg));
    };

    recognition.onend = () => {
      if (webActiveRecognition === recognition) webActiveRecognition = null;
      if (stopped) return;
      if (finished) {
        options.onEnd?.();
        return;
      }
      if (finalTranscript.trim()) {
        finishOnce(() => options.onResult?.(calculateScore(original, finalTranscript)));
      } else {
        finishOnce(() => options.onError?.('没有听到声音，请大声说出英文后再次点击跟读'));
      }
      options.onEnd?.();
    };

    try {
      recognition.start();
    } catch (err) {
      if (retryCount < maxRetries && !stopped) {
        retryCount++;
        setTimeout(() => {
          if (recognition) { try { recognition.abort?.(); } catch {} }
          if (!stopped) startAttempt();
        }, 400);
        return;
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      let msg = '无法启动识别';
      if (errMsg.toLowerCase().includes('already')) msg = '语音识别正在运行，请稍后再试';
      else if (errMsg.toLowerCase().includes('network')) msg = '语音识别需要网络连接，请检查网络后重试';
      else msg = `无法启动识别：${errMsg}`;
      finishOnce(() => options.onError?.(msg));
    }
  };

  startAttempt();

  return () => {
    stopped = true;
    if (recognition) {
      try { recognition.stop(); } catch {}
    }
    if (webActiveRecognition === recognition) webActiveRecognition = null;
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
