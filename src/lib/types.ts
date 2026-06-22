// 场景学习内容（AI 生成）
export interface VocabItem {
  word: string;
  meaningZh: string;
  ipa: string;
}

export interface SentenceItem {
  en: string;
  zh: string;
}

export interface DialogueRound {
  round: number;
  parent: string;
  child: string;
  parentZh: string;
  childZh: string;
}

export interface SceneContent {
  sceneNameZh: string;
  sceneNameEn: string;
  vocab: VocabItem[];
  coreSentences: SentenceItem[];
  dialogue: DialogueRound[];
}

// 场景来源
export type SceneSource = 'input' | 'example' | 'route';

// 对话难易度：easy 简单 / medium 难度 / hard 复杂
export type Difficulty = 'easy' | 'medium' | 'hard';

// 掌握判断
export type Mastery = 'known' | 'need-learn' | 'unsure' | null;

// 一次完整学习会话
export interface LearnSession {
  id: string;
  sceneInput: string;
  source: SceneSource;
  difficulty: Difficulty;
  content: SceneContent;
  mastery: Mastery;
  learnedDone: boolean;
  practiceRound: number;
  practiceDone: boolean;
  createdAt: number;
}

// 每日路线节点
export interface RouteNode {
  id: string;
  nameZh: string;
  nameEn: string;
  desc: string;
  time: string;
  emoji: string;
}

export interface DailyRoute {
  nodes: RouteNode[];
  updatedAt: number;
}

// 路线定义：支持多路线管理（预置 + 自建）
export interface RouteDefinition {
  id: string;
  name: string;
  icon: string; // emoji
  nodes: RouteNode[];
  isPreset: boolean; // 预置路线不可删除，可编辑
  createdAt: number;
  updatedAt: number;
}

// 示例场景卡片
export interface ExampleScene {
  id: string;
  nameZh: string;
  nameEn: string;
  prompt: string;
  emoji: string;
  hint: string;
}
