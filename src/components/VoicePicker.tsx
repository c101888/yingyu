import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  loadVoices,
  getEnglishVoiceOptions,
  setVoice,
  getCurrentVoiceURI,
  speechSupported,
  speak,
} from '@/lib/voice';

// 语音音色选择器：自动加载并优先展示自然语音
export function VoicePicker() {
  const [options, setOptions] = useState(getEnglishVoiceOptions());
  const [current, setCurrent] = useState(getCurrentVoiceURI());

  useEffect(() => {
    if (!speechSupported()) return;
    loadVoices().then(() => {
      setOptions(getEnglishVoiceOptions());
      if (!getCurrentVoiceURI()) {
        const opts = getEnglishVoiceOptions();
        if (opts[0]) {
          setVoice(opts[0].voiceURI);
          setCurrent(opts[0].voiceURI);
        }
      }
    });
  }, []);

  if (!speechSupported() || options.length === 0) {
    return (
      <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
        <Volume2 className="h-4 w-4" />
        <span>当前浏览器暂不支持语音播放</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Volume2 className="h-5 w-5 shrink-0 text-primary" />
      <Select
        value={current || undefined}
        onValueChange={(v) => {
          setVoice(v);
          setCurrent(v);
          // 试听
          speak("Hello! Let's learn English together.", { rate: 0.9 });
        }}
      >
        <SelectTrigger className="h-11 w-[150px] text-xs sm:w-[210px]">
          <SelectValue placeholder="选择语音音色" />
        </SelectTrigger>
        <SelectContent>
          {options.map((v) => (
            <SelectItem key={v.voiceURI} value={v.voiceURI}>
              <span className="flex items-center gap-2">
                {v.isNatural && (
                  <span className="rounded-full bg-sage-soft px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    自然
                  </span>
                )}
                <span className="truncate">{v.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
