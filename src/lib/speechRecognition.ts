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
let nativeLastStopTime = 0;          // 上一次 stop 的时间戳，用于防止过快重启

function startNativeRecognition(original: string, options: RecognizeOptions): () => void {
  const lang = options.lang || 'en-US';
  let stopped = false;
  let finished = false;
  let started = false; // 是否已经回调过 onStart
  let stopRequested = false; // 用户已点击停止
  let noMatchRetried = false; // ERROR_NO_MATCH 是否已自动重试过
  let listeningHandle: PluginListenerHandle | null = null;
  let partialHandle: PluginListenerHandle | null = null;
  let accumulatedTranscript = '';
  let lastPartialMatches: string[] = [];
  let startFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let finalizeTimer: ReturnType<typeof setTimeout> | null = null;

  const triggerStartOnce = () => {
    if (started || stopped || finished) return;
    started = true;
    if (startFallbackTimer) {
      clearTimeout(startFallbackTimer);
      startFallbackTimer = null;
    }
    options.onStart?.();
  };

  const cleanup = async () => {
    if (startFallbackTimer) {
      clearTimeout(startFallbackTimer);
      startFallbackTimer = null;
    }
    if (finalizeTimer) {
      clearTimeout(finalizeTimer);
      finalizeTimer = null;
    }
    try { await listeningHandle?.remove(); } catch {}
    try { await partialHandle?.remove(); } catch {}
    listeningHandle = null;
    partialHandle = null;
    nativeRecognitionActive = false;
    nativeLastStopTime = Date.now();
  };

  const finishOnce = (cb: () => void) => {
    if (finished) return;
    finished = true;
    cb();
    options.onEnd?.();
    void cleanup();
  };

  // 关键：用累积的识别结果评分
  // 在用户点停止后，可能还有 1-2 个 partialResults 事件到来（系统的最终回调），
  // 所以用 debounce：每来一个 partialResults 就重置 500ms 计时器，500ms 没新事件即定稿
  const finalizeScoring = () => {
    if (finished) return;
    if (finalizeTimer) {
      clearTimeout(finalizeTimer);
      finalizeTimer = null;
    }
    const transcript = accumulatedTranscript || (lastPartialMatches[0] ?? '');
    console.warn('[SpeechRecognition] finalize transcript:', transcript);
    if (transcript.trim()) {
      const scored = calculateScore(original, transcript);
      finishOnce(() => options.onResult?.(scored));
    } else {
      finishOnce(() => options.onError?.('没有听到清晰的英文，请靠近麦克风并大声朗读后重试'));
    }
  };

  const scheduleFinalize = (delay: number) => {
    if (finished) return;
    if (finalizeTimer) clearTimeout(finalizeTimer);
    finalizeTimer = setTimeout(() => {
      finalizeTimer = null;
      finalizeScoring();
    }, delay);
  };

  (async () => {
    try {
      // 如果有残留识别在跑，先停掉并等待释放
      if (nativeRecognitionActive) {
        try { await SpeechRecognition.stop(); } catch {}
        nativeRecognitionActive = false;
        await new Promise(r => setTimeout(r, 300));
      } else {
        // 即使没有活动识别，距上次 stop 不足 400ms 也强制等一下
        // 因为 SpeechRecognizer 释放底层资源需要时间
        const sinceLastStop = Date.now() - nativeLastStopTime;
        if (nativeLastStopTime > 0 && sinceLastStop < 400) {
          await new Promise(r => setTimeout(r, 400 - sinceLastStop));
        }
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

      // 2. listeningState 事件
      try {
        listeningHandle = await SpeechRecognition.addListener(
          'listeningState',
          (data: { status: 'started' | 'stopped' }) => {
            console.warn('[SpeechRecognition] listeningState:', data.status);
            if (data.status === 'started') {
              triggerStartOnce();
            } else if (data.status === 'stopped' && stopRequested && !finished) {
              // 系统已确认停止，快速定稿（300ms 给最后一个 partialResults 留时间）
              scheduleFinalize(300);
            }
          },
        );
      } catch (err) {
        console.warn('[SpeechRecognition] addListener listeningState 失败', err);
      }

      // 3. partialResults 事件
      try {
        partialHandle = await SpeechRecognition.addListener(
          'partialResults',
          (data: { matches: string[] }) => {
            console.warn('[SpeechRecognition] partialResults:', data.matches);
            triggerStartOnce();
            if (data.matches && data.matches.length > 0) {
              lastPartialMatches = data.matches;
            }
            // 用户已点停止：每个新 partialResults 都重置 debounce 计时器
            // 500ms 内没有新事件就认为是最终结果
            if (stopRequested && !finished) {
              scheduleFinalize(500);
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
      // 架构决策 (v2.1):
      // - 改回 partialResults:true,因为 partialResults:false 模式下 Android 系统的
      //   SpeechRecognizer 沉默检测非常激进(用户没立即说话 ~500ms 就直接 ERROR_NO_MATCH).
      // - partialResults:true 模式 start() 立即 resolve,用户有充足时间开口说话.
      // - 即使 partialResults 事件在某些设备不触发,也可以通过 stop() 后系统返回的最终
      //   结果或事件兜底.
      // - 加入自动重试: ERROR_NO_MATCH 时自动重试 1 次,因为这通常是用户还没来得及说话.
      nativeRecognitionActive = true;
      startFallbackTimer = setTimeout(() => {
        startFallbackTimer = null;
        triggerStartOnce();
      }, 800);

      try {
        const result = await SpeechRecognition.start({
          language: lang,
          maxResults: 5,
          partialResults: true, // 让用户有充足时间开口,避免立即 NO_MATCH
          popup: false,
        });
        console.warn('[SpeechRecognition] start() resolved:', result);
        triggerStartOnce();

        // partialResults:true 模式: start() 立即 resolve 无 matches,识别通过事件流
        // 但某些设备(如华为)即使 partialResults:true 也会在结束时返回 matches
        if (result && Array.isArray(result.matches) && result.matches.length > 0) {
          accumulatedTranscript = result.matches[0];
          console.warn('[SpeechRecognition] start() returned matches:', accumulatedTranscript);
          if (!stopRequested && !finished) {
            finishOnce(() => options.onResult?.(calculateScore(original, accumulatedTranscript)));
          }
        }
      } catch (err) {
        nativeRecognitionActive = false;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn('[SpeechRecognition] start() rejected:', errMsg);

        // ERROR_NO_MATCH / didn't understand: 用户还没来得及说话就被系统超时
        // 这是 Android SpeechRecognizer 已知问题,自动重试一次给用户更多反应时间
        const lower = errMsg.toLowerCase();
        const isNoMatch =
          lower.includes("didn't understand") ||
          lower.includes('didnt understand') ||
          lower.includes('no match') ||
          lower.includes('no_match');
        if (isNoMatch && !noMatchRetried && !stopped && !finished) {
          noMatchRetried = true;
          console.warn('[SpeechRecognition] NO_MATCH 自动重试 1 次');
          // 短暂延迟让系统资源释放
          await new Promise((r) => setTimeout(r, 300));
          nativeRecognitionActive = false;
          // 重新启动一次
          startFallbackTimer = setTimeout(() => {
            startFallbackTimer = null;
            triggerStartOnce();
          }, 800);
          nativeRecognitionActive = true;
          try {
            const result2 = await SpeechRecognition.start({
              language: lang,
              maxResults: 5,
              partialResults: true,
              popup: false,
            });
            console.warn('[SpeechRecognition] retry start() resolved:', result2);
            triggerStartOnce();
            if (result2 && Array.isArray(result2.matches) && result2.matches.length > 0) {
              accumulatedTranscript = result2.matches[0];
              if (!stopRequested && !finished) {
                finishOnce(() =>
                  options.onResult?.(calculateScore(original, accumulatedTranscript)),
                );
              }
            }
          } catch (err2) {
            nativeRecognitionActive = false;
            const errMsg2 = err2 instanceof Error ? err2.message : String(err2);
            console.warn('[SpeechRecognition] retry start() rejected:', errMsg2);
            finishOnce(() =>
              options.onError?.(
                '请在看到"录音中"后立即朗读英文,不要停顿。可再次点击跟读重试',
              ),
            );
          }
          return;
        }

        finishOnce(() => options.onError?.(mapNativeError(errMsg)));
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('[SpeechRecognition] outer error:', errMsg);
      finishOnce(() => options.onError?.(mapNativeError(errMsg)));
    }
  })();

  // 返回 stop 函数：用户点"完成"时调用
  // partialResults:false 模式下: stop() 让系统提前结束录音并 finalize,
  // 上面的 await SpeechRecognition.start() 会随后 resolve 并直接走到 result.matches 处理逻辑.
  // 因此这里只需要触发 stop(),不再需要 debounce 等待事件.
  return () => {
    if (stopped) return;
    stopped = true;
    stopRequested = true;
    console.warn('[SpeechRecognition] user requested stop');

    // fire-and-forget stop:不阻塞调用方
    SpeechRecognition.stop().catch((err) => {
      console.warn('[SpeechRecognition] stop() error (non-blocking):', err);
    });

    // 兜底:如果 4 秒内 start() Promise 还没 resolve(系统未正确 finalize),
    // 强制走 finalize 用累积内容评分
    scheduleFinalize(4000);
  };
}

function mapNativeError(errMsg: string): string {
  const lower = errMsg.toLowerCase();
  if (lower.includes('permission') || lower.includes('denied')) {
    return '请允许麦克风权限后重试';
  }
  if (lower.includes('not available') || lower.includes('not supported')) {
    return '当前设备未安装兼容的语音识别引擎，请在应用商店搜索"Google 语音服务"或安装系统语音输入包';
  }
  if (lower.includes('network')) {
    return '语音识别需要网络连接，请检查网络后重试';
  }
  if (lower.includes('busy') || lower.includes('already')) {
    return '语音识别正在运行，请稍后再试';
  }
  if (
    lower.includes('no match') ||
    lower.includes('no_match') ||
    lower.includes('no speech') ||
    lower.includes("didn't understand") ||
    lower.includes('didnt understand')
  ) {
    // Android SpeechRecognizer 的"沉默检测"非常激进,用户没立即开口就报这个
    return '请点击跟读后立即朗读英文(不要停顿),再次点击重试';
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
    let started = false; // 是否真正进入录音状态（onstart 是否触发过）

    recognition.onstart = () => {
      started = true;
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

      // 关键修复：如果 onstart 都没触发就 onend，说明启动失败（Chrome 移动端首次授权后常见问题）
      // 自动重试一次，让用户感受不到这个 bug
      if (!started && retryCount < maxRetries && !stopped) {
        retryCount++;
        console.warn('[SpeechRecognition Web] onstart 未触发就 onend，自动重试', retryCount);
        setTimeout(() => { if (!stopped) startAttempt(); }, 400);
        return;
      }

      if (finalTranscript.trim()) {
        finishOnce(() => options.onResult?.(calculateScore(original, finalTranscript)));
      } else if (!started) {
        // 重试用完依然 onstart 没触发，说明浏览器/网络真的有问题
        finishOnce(() => options.onError?.('识别启动失败，可能是网络或浏览器限制，请检查网络后重试'));
      } else {
        // onstart 触发过但没识别到内容
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
