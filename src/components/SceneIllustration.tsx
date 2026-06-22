import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { getImage } from '@/lib/imageCache';

interface SceneIllustrationProps {
  sceneNameEn: string;
  sceneNameZh: string;
  emoji?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

// 场景到 emoji 的映射（兜底用，当图片加载失败时显示）
const SCENE_EMOJI: Array<{ keys: string[]; emoji: string }> = [
  { keys: ['cucumber', '黄瓜'], emoji: '🥒' },
  { keys: ['wake', 'waking', '起床'], emoji: '⏰' },
  { keys: ['brush', 'teeth', '刷牙'], emoji: '🪥' },
  { keys: ['breakfast', '早餐'], emoji: '🍳' },
  { keys: ['leaving', 'school', '出门', '上学'], emoji: '🎒' },
  { keys: ['snack', '点心'], emoji: '🍪' },
  { keys: ['dress', 'clothes', '换衣'], emoji: '👕' },
  { keys: ['school', '到校'], emoji: '🏫' },
  { keys: ['eat', '吃'], emoji: '🍽️' },
  { keys: ['play', '玩'], emoji: '🧸' },
  { keys: ['bath', '洗澡'], emoji: '🛁' },
  { keys: ['sleep', 'bed', '睡觉'], emoji: '🛏️' },
];

// 根据场景名匹配 emoji
export function getSceneEmoji(sceneNameEn: string, sceneNameZh: string): string {
  const text = (sceneNameEn + ' ' + sceneNameZh).toLowerCase();
  for (const rule of SCENE_EMOJI) {
    if (rule.keys.some((k) => text.includes(k.toLowerCase()))) {
      return rule.emoji;
    }
  }
  return '🏠';
}

// 用 trae-api 文生图生成温暖手绘风场景插画
function buildImageUrl(sceneNameEn: string, sceneNameZh: string): string {
  const prompt = encodeURIComponent(
    `Warm hand-drawn children's storybook illustration of a cozy family scene: ${sceneNameEn} (${sceneNameZh}). ` +
      'Soft watercolor style, warm cream and sage green palette, gentle and friendly, parent and child together, ' +
      'no text, no words, simple and cute, suitable for kids learning material.',
  );
  return `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${prompt}&image_size=landscape_4_3`;
}

const sizeMap = {
  sm: 'h-32',
  md: 'h-48',
  lg: 'h-48 sm:h-64',
};

export function SceneIllustration({
  sceneNameEn,
  sceneNameZh,
  emoji,
  className,
  size = 'md',
}: SceneIllustrationProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);
  const mountedRef = useRef(true);
  const fallbackEmoji = emoji || getSceneEmoji(sceneNameEn, sceneNameZh);
  const cacheKey = sceneNameEn || sceneNameZh;
  const apiUrl = buildImageUrl(sceneNameEn, sceneNameZh);

  useEffect(() => {
    mountedRef.current = true;
    let revoked = false;
    let createdUrl: string | null = null;
    setErrored(false);
    setBlobUrl(null);

    // 先查 IndexedDB 缓存，未命中则从 API 下载并缓存
    getImage(cacheKey, apiUrl).then(({ blob }) => {
      if (revoked || !mountedRef.current) return;
      if (!blob) {
        setErrored(true);
        return;
      }
      createdUrl = URL.createObjectURL(blob);
      setBlobUrl(createdUrl);
    });

    return () => {
      revoked = true;
      mountedRef.current = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-3xl bg-sage-soft/40',
        sizeMap[size],
        className,
      )}
    >
      {/* 图片层：始终渲染 img，通过 opacity 控制显示，避免 DOM 类型切换导致协调错误 */}
      {blobUrl && (
        <img
          src={blobUrl}
          alt={`${sceneNameZh} 场景插画`}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-300',
            errored ? 'opacity-0' : 'opacity-100',
          )}
          onError={() => { if (mountedRef.current) setErrored(true); }}
        />
      )}
      {/* 兜底/加载层：始终渲染，通过绝对定位叠加 */}
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center transition-opacity duration-300',
          blobUrl && !errored ? 'opacity-0' : 'opacity-100',
          errored
            ? 'bg-gradient-to-br from-sage-soft to-peach-soft'
            : 'bg-gradient-to-br from-sage-soft/60 to-peach-soft/60',
          !blobUrl && !errored && 'animate-pulse',
        )}
      >
        <span className="text-4xl sm:text-5xl">{fallbackEmoji}</span>
      </div>
    </div>
  );
}
