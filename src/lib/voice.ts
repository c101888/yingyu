// Web Speech 语音服务：自动优先选择自然英文语音，失败不阻断流程

export interface VoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  isNatural: boolean;
}

let cachedVoices: SpeechSynthesisVoice[] = [];

function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// 加载语音列表（异步，部分浏览器需等待 onvoiceschanged）
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isSpeechSupported()) {
      resolve([]);
      return;
    }
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
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeaking(): boolean {
  return isSpeechSupported() && window.speechSynthesis.speaking;
}

export function speechSupported(): boolean {
  return isSpeechSupported();
}
