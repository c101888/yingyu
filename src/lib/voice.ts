// 语音服务：Web 环境用 Web Speech API，原生 App（Capacitor）用原生 TTS 引擎
// Android WebView 的 speechSynthesis 不可用（语音列表空、speak 无声音），
// 因此原生环境改用 @capacitor-community/text-to-speech 调用 Android 系统 TTS。

import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

export interface VoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  isNatural: boolean;
}

let cachedVoices: SpeechSynthesisVoice[] = [];

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function isSpeechSupported(): boolean {
  if (isNative()) return true;
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// 加载语音列表（异步，部分浏览器需等待 onvoiceschanged）
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isSpeechSupported()) {
      resolve([]);
      return;
    }

    // 原生环境：用插件获取系统 TTS 语音
    if (isNative()) {
      TextToSpeech.getSupportedVoices()
        .then((result) => {
          cachedVoices = (result.voices || []) as SpeechSynthesisVoice[];
          resolve(cachedVoices);
        })
        .catch(() => resolve([]));
      return;
    }

    // Web 环境：Web Speech API
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      cachedVoices = existing;
      resolve(existing);
      return;
    }
    let settled = false;
    const done = (v: SpeechSynthesisVoice[]) => {
      if (settled) return;
      settled = true;
      cachedVoices = v;
      resolve(v);
    };
    window.speechSynthesis.onvoiceschanged = () => {
      done(window.speechSynthesis.getVoices());
    };
    // 兜底超时
    setTimeout(() => done(window.speechSynthesis.getVoices()), 800);
  });
}

// 自然度评分：分数越高越优先
function naturalScore(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  let score = 0;
  if (name.includes('google us english')) score += 100;
  if (name.includes('google uk english female')) score += 90;
  if (name.includes('google uk english male')) score += 85;
  if (/\b(natural|enhanced|premium|wavenet|neural)\b/.test(name)) score += 80;
  if (name.includes('samantha')) score += 60; // macOS 自然女声
  if (name.includes('aria') || name.includes('jenny')) score += 70; // Edge 自然女声
  if (v.lang === 'en-US') score += 20;
  if (v.lang.startsWith('en')) score += 10;
  // 排除明显机械的默认语音
  if (name.includes('default') && score === 0) score -= 5;
  return score;
}

// 获取可选英文语音列表（按自然度排序）
export function getEnglishVoiceOptions(): VoiceOption[] {
  return cachedVoices
    .filter((v) => v.lang.toLowerCase().startsWith('en'))
    .sort((a, b) => naturalScore(b) - naturalScore(a))
    .map((v) => ({
      voiceURI: v.voiceURI,
      name: v.name,
      lang: v.lang,
      isNatural: naturalScore(v) >= 60,
    }));
}

// 默认推荐自然语音
export function getDefaultVoiceURI(): string | null {
  const opts = getEnglishVoiceOptions();
  return opts[0]?.voiceURI ?? null;
}

let currentVoiceURI: string | null = null;

export function setVoice(voiceURI: string | null) {
  currentVoiceURI = voiceURI;
}

export function getCurrentVoiceURI(): string | null {
  return currentVoiceURI;
}

function pickVoice(): SpeechSynthesisVoice | null {
  const uri = currentVoiceURI || getDefaultVoiceURI();
  if (!uri) return null;
  return cachedVoices.find((v) => v.voiceURI === uri) || null;
}

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  onstart?: () => void;
  onend?: () => void;
  onerror?: () => void;
}

// 朗读英文文本
export function speak(text: string, opts: SpeakOptions = {}): boolean {
  if (!isSpeechSupported() || !text.trim()) {
    opts.onend?.();
    return false;
  }

  // 原生 App：用 @capacitor-community/text-to-speech 调用系统 TTS
  if (isNative()) {
    doNativeSpeak(text, opts);
    return true;
  }

  // Web 环境：Web Speech API
  return doWebSpeak(text, opts);
}

// 原生 TTS 朗读：带重试机制（TTS 引擎初始化是异步的，首次调用可能未就绪）
async function doNativeSpeak(text: string, opts: SpeakOptions) {
  const voice = pickVoice();
  let voiceIndex: number | undefined;
  if (voice) {
    const idx = cachedVoices.findIndex((v) => v.voiceURI === voice.voiceURI);
    voiceIndex = idx >= 0 ? idx : undefined;
  }

  const speakOptions = {
    text,
    lang: voice?.lang || 'en-US',
    rate: opts.rate ?? 0.9,
    pitch: opts.pitch ?? 1.05,
    volume: 1.0,
    voice: voiceIndex,
  };

  // 最多重试 3 次，每次间隔 500ms（等待 TTS 引擎初始化完成）
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt === 0) opts.onstart?.();
      await TextToSpeech.speak(speakOptions);
      opts.onend?.();
      return;
    } catch (err) {
      // TTS 引擎未初始化时返回 "Not yet initialized"，等待后重试
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      // 重试失败：尝试回退到 Web Speech API（Android WebView 可能部分支持）
      if (doWebSpeak(text, opts)) return;
      opts.onerror?.();
    }
  }
}

// Web Speech API 朗读
function doWebSpeak(text: string, opts: SpeakOptions): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    opts.onend?.();
    return false;
  }
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang;
    } else {
      utter.lang = 'en-US';
    }
    utter.rate = opts.rate ?? 0.9;
    utter.pitch = opts.pitch ?? 1.05;
    utter.onstart = () => opts.onstart?.();
    utter.onend = () => opts.onend?.();
    utter.onerror = () => opts.onerror?.();
    window.speechSynthesis.speak(utter);
    return true;
  } catch {
    opts.onerror?.();
    return false;
  }
}

export function stopSpeaking() {
  if (isNative()) {
    TextToSpeech.stop().catch(() => {});
    return;
  }
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeaking(): boolean {
  if (isNative()) {
    return false; // 原生环境无法同步获取状态，靠回调维护
  }
  return isSpeechSupported() && window.speechSynthesis.speaking;
}

export function speechSupported(): boolean {
  return isSpeechSupported();
}
