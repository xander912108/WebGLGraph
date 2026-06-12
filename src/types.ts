export type UserStage = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface User {
  id: string;
  name: string;
  avatar: string;
  stage: UserStage;
  vklad: number;
  role: string | null;
  isOnline: boolean;
  isLeader: boolean;
  bondCount: number;
  isOrphan: boolean;
  isOverloaded: boolean;
}

export type BondType = 'help' | 'review' | 'ritual' | 'intro' | 'support' | 'insight';

export interface Bond {
  id: string;
  sourceId: string;
  targetId: string;
  type: BondType;
  strength: number;
  lastReinforced: number;
  isFaded: boolean;
}

export const STAGE_NAMES: Record<UserStage, string> = {
  1: 'Новичок',
  2: 'Свой',
  3: 'В движении',
  4: 'Поддержанный',
  5: 'Помогающий',
  6: 'Признанный',
  7: 'Столп',
};

export const STAGE_COLORS: Record<UserStage, string> = {
  1: '#6b7280',
  2: '#60a5fa',
  3: '#22d3ee',
  4: '#34d399',
  5: '#a3e635',
  6: '#fbbf24',
  7: '#f59e0b',
};

export const BOND_COLORS: Record<BondType, string> = {
  help: '#f59e0b',
  review: '#8b5cf6',
  ritual: '#10b981',
  intro: '#3b82f6',
  support: '#ec4899',
  insight: '#06b6d4',
};

export const BOND_LABELS: Record<BondType, string> = {
  help: 'Помощь',
  review: 'Разбор',
  ritual: 'Ритуал',
  intro: 'Знакомство',
  support: 'Поддержка',
  insight: 'Инсайт',
};
