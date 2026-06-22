// 测验引擎：从场景内容生成多题型题目
import type { SceneContent, VocabItem, SentenceItem, Difficulty } from './types';

// 通用高频词过滤表（这些词不作为考题，太简单）
const COMMON_WORDS = new Set([
  'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'a', 'an', 'the', 'this', 'that', 'these', 'those',
  'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'have', 'has', 'had',
  'and', 'or', 'but', 'so', 'because', 'if', 'then',
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'from',
  'my', 'your', 'his', 'her', 'our', 'their',
  'me', 'him', 'us', 'them',
  'yes', 'no', 'not',
  'go', 'goes', 'going', 'went',
  'get', 'got',
  'let', 'lets',
  'can', 'will', 'would', 'should', 'could',
  'what', 'where', 'when', 'how', 'why', 'who',
  'here', 'there',
  'now', 'just', 'very', 'too',
  'up', 'down', 'out', 'in',
  'like', 'want', 'need',
  'good', 'bad', 'big', 'small',
  'one', 'two', 'three',
  'time', 'day', 'today',
]);

export type QuizType =
  | 'listen_word'
  | 'listen_sentence'
  | 'zh_to_en_word'
  | 'zh_to_en_sentence'
  | 'fill_blank'      // 短语填空：听句填缺词
  | 'word_order'      // 单词排序：点击排序成句
  | 'listen_pick'     // 听音选词：听发音选正确单词
  | 'spell_word';     // 字母拼写：补全单词缺失字母

export interface QuizQuestion {
  id: string;
  type: QuizType;
  // 题目内容
  prompt: string;        // 题目提示语
  audioText: string;     // 需要播放的英文（听题类型）
  displayText: string;   // 需要显示的文本（看题类型）
  displayZh: string;     // 看题类型的中文
  // 选项
  options: QuizOption[];
  correctId: string;
  // 填空/排序/拼写题型专用字段
  blankAnswer?: string;        // fill_blank: 正确答案（单词）
  blankSentence?: string;      // fill_blank: 带下划线的句子（显示用）
  blankHint?: string;          // fill_blank: 提示（首字母等）
  wordOrderWords?: string[];   // word_order: 打乱顺序的单词
  wordOrderAnswer?: string;    // word_order: 正确句子
  spellFullWord?: string;      // spell_word: 完整单词
  spellBlanks?: number[];      // spell_word: 缺失字母的索引位置
  spellHint?: string;          // spell_word: 带下划线的单词（显示用）
}

export interface QuizOption {
  id: string;
  text: string;          // 选项显示文本
  isCorrect: boolean;
}

// 通用干扰词池（中文释义），用于选项不足时补充
const DISTRACTORS_ZH = [
  '苹果', '小狗', '红色', '跑步', '高兴', '学校',
  '太阳', '月亮', '水', '吃饭', '睡觉', '看书',
  '蓝色', '大树', '小鸟', '衣服', '鞋子', '帽子',
];

const DISTRACTORS_EN_WORDS = [
  'apple', 'dog', 'red', 'run', 'happy', 'school',
  'sun', 'moon', 'water', 'eat', 'sleep', 'book',
  'blue', 'tree', 'bird', 'clothes', 'shoe', 'hat',
];

const DISTRACTORS_EN_SENTENCES = [
  'I like apples.', 'The dog is running.', 'It is a red car.',
  'She is happy.', 'He goes to school.', 'The sun is bright.',
  'I want to sleep.', 'Let us read a book.', 'The bird is flying.',
  'Put on your shoes.',
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 判断是否为通用高频词（需要过滤掉，不作为考题）
function isCommonWord(word: string): boolean {
  const w = word.toLowerCase().trim();
  return COMMON_WORDS.has(w) || w.length <= 1;
}

// 生成听词选义题目
function makeListenWordQuestion(
  target: VocabItem,
  allVocab: VocabItem[],
  index: number,
): QuizQuestion | null {
  if (!target || !target.word || isCommonWord(target.word)) return null;

  const opts: QuizOption[] = [
    { id: 'correct', text: target.meaningZh, isCorrect: true },
  ];

  // 从其他词汇取干扰项
  const others = shuffle(allVocab.filter((v) => v.word !== target.word && v.meaningZh !== target.meaningZh));
  for (const v of others) {
    if (opts.length >= 3) break;
    if (!opts.some((o) => o.text === v.meaningZh)) {
      opts.push({ id: `v${opts.length}`, text: v.meaningZh, isCorrect: false });
    }
  }
  // 通用干扰项补齐
  let di = 0;
  while (opts.length < 3 && di < DISTRACTORS_ZH.length) {
    const d = DISTRACTORS_ZH[di++];
    if (!opts.some((o) => o.text === d)) {
      opts.push({ id: `d${opts.length}`, text: d, isCorrect: false });
    }
  }

  return {
    id: `lw_${index}`,
    type: 'listen_word',
    prompt: '听单词，选对意思',
    audioText: target.word,
    displayText: target.word,
    displayZh: '',
    options: shuffle(opts),
    correctId: 'correct',
  };
}

// 生成听句选义题目
function makeListenSentenceQuestion(
  sentence: SentenceItem,
  allSentences: SentenceItem[],
  index: number,
): QuizQuestion | null {
  if (!sentence || !sentence.en) return null;

  const opts: QuizOption[] = [
    { id: 'correct', text: sentence.zh, isCorrect: true },
  ];

  const others = shuffle(allSentences.filter((s) => s.en !== sentence.en && s.zh !== sentence.zh));
  for (const s of others) {
    if (opts.length >= 3) break;
    if (!opts.some((o) => o.text === s.zh)) {
      opts.push({ id: `s${opts.length}`, text: s.zh, isCorrect: false });
    }
  }
  let di = 0;
  while (opts.length < 3 && di < DISTRACTORS_ZH.length) {
    const d = DISTRACTORS_ZH[di++];
    if (!opts.some((o) => o.text === d)) {
      opts.push({ id: `d${opts.length}`, text: d, isCorrect: false });
    }
  }

  return {
    id: `ls_${index}`,
    type: 'listen_sentence',
    prompt: '听句子，选对意思',
    audioText: sentence.en,
    displayText: sentence.en,
    displayZh: '',
    options: shuffle(opts),
    correctId: 'correct',
  };
}

// 生成看中文选英文单词题目
function makeZhToEnWordQuestion(
  target: VocabItem,
  allVocab: VocabItem[],
  index: number,
): QuizQuestion | null {
  if (!target || !target.word || isCommonWord(target.word)) return null;

  const opts: QuizOption[] = [
    { id: 'correct', text: target.word, isCorrect: true },
  ];

  const others = shuffle(allVocab.filter((v) => v.word !== target.word));
  for (const v of others) {
    if (opts.length >= 3) break;
    if (!opts.some((o) => o.text === v.word)) {
      opts.push({ id: `v${opts.length}`, text: v.word, isCorrect: false });
    }
  }
  let di = 0;
  while (opts.length < 3 && di < DISTRACTORS_EN_WORDS.length) {
    const d = DISTRACTORS_EN_WORDS[di++];
    if (!opts.some((o) => o.text === d)) {
      opts.push({ id: `d${opts.length}`, text: d, isCorrect: false });
    }
  }

  return {
    id: `zw_${index}`,
    type: 'zh_to_en_word',
    prompt: '看中文，选对英文单词',
    audioText: '',
    displayText: '',
    displayZh: target.meaningZh,
    options: shuffle(opts),
    correctId: 'correct',
  };
}

// 生成看中文选英文句子题目
function makeZhToEnSentenceQuestion(
  sentence: SentenceItem,
  allSentences: SentenceItem[],
  index: number,
): QuizQuestion | null {
  if (!sentence || !sentence.en) return null;

  const opts: QuizOption[] = [
    { id: 'correct', text: sentence.en, isCorrect: true },
  ];

  const others = shuffle(allSentences.filter((s) => s.en !== sentence.en));
  for (const s of others) {
    if (opts.length >= 3) break;
    if (!opts.some((o) => o.text === s.en)) {
      opts.push({ id: `s${opts.length}`, text: s.en, isCorrect: false });
    }
  }
  let di = 0;
  while (opts.length < 3 && di < DISTRACTORS_EN_SENTENCES.length) {
    const d = DISTRACTORS_EN_SENTENCES[di++];
    if (!opts.some((o) => o.text === d)) {
      opts.push({ id: `d${opts.length}`, text: d, isCorrect: false });
    }
  }

  return {
    id: `zs_${index}`,
    type: 'zh_to_en_sentence',
    prompt: '看中文，选对英文句子',
    audioText: '',
    displayText: '',
    displayZh: sentence.zh,
    options: shuffle(opts),
    correctId: 'correct',
  };
}

// 难度对应的测验题数上限
// 简单 10 题 / 难度 14 题 / 复杂 18 题
const DIFFICULTY_QUIZ_LIMIT: Record<Difficulty, number> = {
  easy: 10,
  medium: 14,
  hard: 18,
};

// 难度对应的句子题数（听句+看中选英句各取多少句）
// 简单 2 句 / 难度 3 句 / 复杂 4 句
const DIFFICULTY_SENTENCE_QUIZ: Record<Difficulty, number> = {
  easy: 2,
  medium: 3,
  hard: 4,
};

// 生成短语填空题：听句子，填入缺失的单词
function makeFillBlankQuestion(
  sentence: SentenceItem,
  allVocab: VocabItem[],
  index: number,
): QuizQuestion | null {
  if (!sentence || !sentence.en) return null;
  const words = sentence.en.split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return null;

  // 选一个非高频词作为答案
  const candidates = words.filter((w) => !isCommonWord(w.replace(/[.,!?;:'"()]/g, '')));
  if (candidates.length === 0) return null;
  const answerWord = candidates[Math.floor(Math.random() * candidates.length)].replace(/[.,!?;:'"()]/g, '');
  if (!answerWord || answerWord.length < 2) return null;

  // 构造带下划线的句子
  const blanked = sentence.en.replace(answerWord, '____');

  // 选项：正确答案 + 3 个干扰词
  const opts: QuizOption[] = [
    { id: 'correct', text: answerWord, isCorrect: true },
  ];
  const others = shuffle(allVocab.filter((v) => v.word !== answerWord && !isCommonWord(v.word)));
  for (const v of others) {
    if (opts.length >= 4) break;
    if (!opts.some((o) => o.text === v.word)) {
      opts.push({ id: `v${opts.length}`, text: v.word, isCorrect: false });
    }
  }
  let di = 0;
  while (opts.length < 4 && di < DISTRACTORS_EN_WORDS.length) {
    const d = DISTRACTORS_EN_WORDS[di++];
    if (!opts.some((o) => o.text === d)) {
      opts.push({ id: `d${opts.length}`, text: d, isCorrect: false });
    }
  }

  return {
    id: `fb_${index}`,
    type: 'fill_blank',
    prompt: '听句子，选出缺失的单词',
    audioText: sentence.en,
    displayText: '',
    displayZh: sentence.zh,
    options: shuffle(opts),
    correctId: 'correct',
    blankAnswer: answerWord,
    blankSentence: blanked,
    blankHint: `首字母：${answerWord[0]}`,
  };
}

// 生成单词排序题：打乱单词顺序，用户点击排序成句
function makeWordOrderQuestion(
  sentence: SentenceItem,
  index: number,
): QuizQuestion | null {
  if (!sentence || !sentence.en) return null;
  const words = sentence.en.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 3) return null;

  // 打乱单词顺序（确保和原顺序不同）
  let shuffled = shuffle(words);
  let attempts = 0;
  while (shuffled.join(' ') === sentence.en && attempts < 5) {
    shuffled = shuffle(words);
    attempts++;
  }

  return {
    id: `wo_${index}`,
    type: 'word_order',
    prompt: '把单词排成正确的句子',
    audioText: '',
    displayText: '',
    displayZh: sentence.zh,
    options: [],
    correctId: 'correct',
    wordOrderWords: shuffled,
    wordOrderAnswer: sentence.en,
  };
}

// 生成听音选词题：听发音，从4个单词中选正确的
function makeListenPickQuestion(
  target: VocabItem,
  allVocab: VocabItem[],
  index: number,
): QuizQuestion | null {
  if (!target || !target.word || isCommonWord(target.word)) return null;

  const opts: QuizOption[] = [
    { id: 'correct', text: target.word, isCorrect: true },
  ];
  const others = shuffle(allVocab.filter((v) => v.word !== target.word && !isCommonWord(v.word)));
  for (const v of others) {
    if (opts.length >= 4) break;
    if (!opts.some((o) => o.text === v.word)) {
      opts.push({ id: `v${opts.length}`, text: v.word, isCorrect: false });
    }
  }
  let di = 0;
  while (opts.length < 4 && di < DISTRACTORS_EN_WORDS.length) {
    const d = DISTRACTORS_EN_WORDS[di++];
    if (!opts.some((o) => o.text === d)) {
      opts.push({ id: `d${opts.length}`, text: d, isCorrect: false });
    }
  }

  return {
    id: `lp_${index}`,
    type: 'listen_pick',
    prompt: '听发音，选对单词',
    audioText: target.word,
    displayText: '',
    displayZh: target.meaningZh,
    options: shuffle(opts),
    correctId: 'correct',
  };
}

// 生成字母拼写题：长单词随机缺几个字母，用户输入
function makeSpellWordQuestion(
  target: VocabItem,
  index: number,
): QuizQuestion | null {
  if (!target || !target.word || isCommonWord(target.word)) return null;
  const word = target.word.toLowerCase();
  // 单词至少 4 个字母才适合拼写题
  if (word.length < 4) return null;

  // 随机缺 1-2 个字母（不超过单词长度的一半）
  const maxBlanks = Math.max(1, Math.floor(word.length / 3));
  const blankCount = Math.min(maxBlanks, 2);
  const positions: number[] = [];
  // 优先缺中间的字母（不缺首字母，降低难度）
  const candidates: number[] = [];
  for (let i = 1; i < word.length - 1; i++) candidates.push(i);
  const shuffledCandidates = shuffle(candidates);
  for (let i = 0; i < blankCount && i < shuffledCandidates.length; i++) {
    positions.push(shuffledCandidates[i]);
  }
  positions.sort((a, b) => a - b);

  // 构造带下划线的提示
  const hint = word.split('').map((c, i) => (positions.includes(i) ? '_' : c)).join('');

  return {
    id: `sw_${index}`,
    type: 'spell_word',
    prompt: '补全单词中缺失的字母',
    audioText: word,
    displayText: '',
    displayZh: target.meaningZh,
    options: [],
    correctId: 'correct',
    spellFullWord: word,
    spellBlanks: positions,
    spellHint: hint,
  };
}

// 从场景内容生成全部测验题目
// 8 种题型均匀分布，每个词/句只考一次
export function generateQuiz(content: SceneContent, difficulty: Difficulty = 'easy'): QuizQuestion[] {
  const vocab = Array.isArray(content.vocab) ? content.vocab : [];
  const sentences = Array.isArray(content.coreSentences) ? content.coreSentences : [];
  const questions: QuizQuestion[] = [];
  const sentenceQuizCount = DIFFICULTY_SENTENCE_QUIZ[difficulty];

  // 1. 词汇题：每个非通用词只考一次，随机分配到 4 种词汇题型之一
  //    - listen_word（听词选义）
  //    - zh_to_en_word（看中文选英文词）
  //    - listen_pick（听音选词）
  //    - spell_word（字母拼写，仅长单词）
  const validVocab = vocab.filter((v) => v.word && !isCommonWord(v.word));
  const shuffledVocab = shuffle(validVocab);
  const vocabTypes: Array<'listen_word' | 'zh_to_en_word' | 'listen_pick' | 'spell_word'> = [
    'listen_word', 'zh_to_en_word', 'listen_pick', 'spell_word',
  ];
  shuffledVocab.forEach((v, i) => {
    // 轮流分配题型，保证题型分布均匀
    let type = vocabTypes[i % vocabTypes.length];
    // spell_word 仅对长单词（≥4字母）生效，否则降级为 listen_word
    if (type === 'spell_word' && v.word.length < 4) {
      type = 'listen_word';
    }
    let q: QuizQuestion | null = null;
    switch (type) {
      case 'listen_word': q = makeListenWordQuestion(v, vocab, i); break;
      case 'zh_to_en_word': q = makeZhToEnWordQuestion(v, vocab, i); break;
      case 'listen_pick': q = makeListenPickQuestion(v, vocab, i); break;
      case 'spell_word': q = makeSpellWordQuestion(v, i); break;
    }
    if (q) questions.push(q);
  });

  // 2. 句子题：每个被选中的句子只考一次，随机分配到 4 种句子题型之一
  //    - listen_sentence（听句选义）
  //    - zh_to_en_sentence（看中文选英文句）
  //    - fill_blank（短语填空）
  //    - word_order（单词排序）
  const quizSentences = sentences.slice(0, sentenceQuizCount);
  const shuffledSentences = shuffle(quizSentences);
  const sentenceTypes: Array<'listen_sentence' | 'zh_to_en_sentence' | 'fill_blank' | 'word_order'> = [
    'listen_sentence', 'zh_to_en_sentence', 'fill_blank', 'word_order',
  ];
  shuffledSentences.forEach((s, i) => {
    const type = sentenceTypes[i % sentenceTypes.length];
    let q: QuizQuestion | null = null;
    switch (type) {
      case 'listen_sentence': q = makeListenSentenceQuestion(s, sentences, i); break;
      case 'zh_to_en_sentence': q = makeZhToEnSentenceQuestion(s, sentences, i); break;
      case 'fill_blank': q = makeFillBlankQuestion(s, vocab, i); break;
      case 'word_order': q = makeWordOrderQuestion(s, i); break;
    }
    if (q) questions.push(q);
  });

  // 打乱题目顺序，按难度截断题数
  return shuffle(questions).slice(0, DIFFICULTY_QUIZ_LIMIT[difficulty]);
}

export const QUIZ_TYPE_LABELS: Record<QuizType, string> = {
  listen_word: '听词选义',
  listen_sentence: '听句选义',
  zh_to_en_word: '中选英词',
  zh_to_en_sentence: '中选英句',
  fill_blank: '短语填空',
  word_order: '单词排序',
  listen_pick: '听音选词',
  spell_word: '字母拼写',
};
