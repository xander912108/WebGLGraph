import type { User, Bond } from '@/types';

const now = Date.now();
const m = (n: number) => now - n * 60 * 1000;
const d = (n: number) => now - n * 86400000;
const a = (seed: string) => `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}`;

export const users: User[] = [
  { id: 'leader', name: 'Александр', avatar: a('leader'), stage: 7, vklad: 2400, role: 'Держатель круга', isOnline: true, isLeader: true, bondCount: 12, isOrphan: false, isOverloaded: false },
  { id: 'u1', name: 'Петр', avatar: a('petya'), stage: 7, vklad: 340, role: 'Наставник по практике', isOnline: true, isLeader: false, bondCount: 8, isOrphan: false, isOverloaded: false },
  { id: 'u2', name: 'Мария', avatar: a('masha'), stage: 6, vklad: 156, role: 'Связующий', isOnline: true, isLeader: false, bondCount: 10, isOrphan: false, isOverloaded: true },
  { id: 'u3', name: 'Иван', avatar: a('vanya'), stage: 6, vklad: 189, role: 'Наставник на старт', isOnline: false, isLeader: false, bondCount: 7, isOrphan: false, isOverloaded: false },
  { id: 'u4', name: 'Анна', avatar: a('anya'), stage: 5, vklad: 78, role: null, isOnline: true, isLeader: false, bondCount: 10, isOrphan: false, isOverloaded: false },
  { id: 'u5', name: 'Дмитрий', avatar: a('dima'), stage: 5, vklad: 65, role: null, isOnline: false, isLeader: false, bondCount: 4, isOrphan: false, isOverloaded: false },
  { id: 'u6', name: 'Елена', avatar: a('lena'), stage: 5, vklad: 92, role: null, isOnline: true, isLeader: false, bondCount: 6, isOrphan: false, isOverloaded: false },
  { id: 'u7', name: 'Сергей', avatar: a('sergey'), stage: 4, vklad: 45, role: null, isOnline: false, isLeader: false, bondCount: 3, isOrphan: false, isOverloaded: false },
  { id: 'u8', name: 'Ольга', avatar: a('olga'), stage: 4, vklad: 38, role: null, isOnline: true, isLeader: false, bondCount: 2, isOrphan: false, isOverloaded: false },
  { id: 'u9', name: 'Николай', avatar: a('kolya'), stage: 3, vklad: 22, role: null, isOnline: false, isLeader: false, bondCount: 2, isOrphan: false, isOverloaded: false },
  { id: 'u10', name: 'Татьяна', avatar: a('tanya'), stage: 3, vklad: 18, role: null, isOnline: true, isLeader: false, bondCount: 1, isOrphan: false, isOverloaded: false },
  { id: 'u11', name: 'Алексей', avatar: a('lesha'), stage: 3, vklad: 28, role: null, isOnline: false, isLeader: false, bondCount: 3, isOrphan: false, isOverloaded: false },
  { id: 'u12', name: 'Виктория', avatar: a('vika'), stage: 2, vklad: 12, role: null, isOnline: true, isLeader: false, bondCount: 1, isOrphan: false, isOverloaded: false },
  { id: 'u13', name: 'Кирилл', avatar: a('kirill'), stage: 1, vklad: 3, role: null, isOnline: false, isLeader: false, bondCount: 0, isOrphan: true, isOverloaded: false },
  { id: 'u14', name: 'София', avatar: a('sofia'), stage: 1, vklad: 0, role: null, isOnline: false, isLeader: false, bondCount: 0, isOrphan: true, isOverloaded: false },
  { id: 'u15', name: 'Максим', avatar: a('maxim'), stage: 1, vklad: 1, role: null, isOnline: true, isLeader: false, bondCount: 0, isOrphan: true, isOverloaded: false },
  { id: 'u16', name: 'Алиса', avatar: a('alisa'), stage: 2, vklad: 8, role: null, isOnline: false, isLeader: false, bondCount: 1, isOrphan: false, isOverloaded: false },
  { id: 'u17', name: 'Глеб', avatar: a('gleb'), stage: 1, vklad: 0, role: null, isOnline: false, isLeader: false, bondCount: 0, isOrphan: true, isOverloaded: false },
  { id: 'u18', name: 'Полина', avatar: a('polina'), stage: 2, vklad: 6, role: null, isOnline: true, isLeader: false, bondCount: 1, isOrphan: false, isOverloaded: false },
];

export const bonds: Bond[] = [
  // June (recent)
  { id: 'b1', sourceId: 'leader', targetId: 'u1', type: 'help', strength: 4, lastReinforced: d(2), isFaded: false },
  { id: 'b2', sourceId: 'leader', targetId: 'u2', type: 'review', strength: 3, lastReinforced: d(5), isFaded: false },
  { id: 'b3', sourceId: 'leader', targetId: 'u3', type: 'ritual', strength: 5, lastReinforced: d(1), isFaded: false },
  { id: 'b4', sourceId: 'u1', targetId: 'u4', type: 'help', strength: 3, lastReinforced: d(3), isFaded: false },
  { id: 'b28', sourceId: 'u4', targetId: 'u6', type: 'support', strength: 2, lastReinforced: d(4), isFaded: false },
  { id: 'b29', sourceId: 'u4', targetId: 'u1', type: 'help', strength: 3, lastReinforced: d(6), isFaded: false },
  { id: 'b33', sourceId: 'leader', targetId: 'u4', type: 'ritual', strength: 4, lastReinforced: d(1), isFaded: false },
  // May (30-60 days)
  { id: 'b8', sourceId: 'u2', targetId: 'u6', type: 'intro', strength: 3, lastReinforced: d(35), isFaded: false },
  { id: 'b10', sourceId: 'u6', targetId: 'u10', type: 'support', strength: 2, lastReinforced: d(40), isFaded: false },
  { id: 'b14', sourceId: 'u1', targetId: 'u6', type: 'insight', strength: 2, lastReinforced: d(32), isFaded: false },
  { id: 'b18', sourceId: 'u6', targetId: 'u7', type: 'help', strength: 2, lastReinforced: d(45), isFaded: false },
  { id: 'b19', sourceId: 'u2', targetId: 'u1', type: 'intro', strength: 2, lastReinforced: d(38), isFaded: false },
  { id: 'b23', sourceId: 'u3', targetId: 'u4', type: 'review', strength: 2, lastReinforced: d(50), isFaded: false },
  { id: 'b24', sourceId: 'leader', targetId: 'u6', type: 'help', strength: 3, lastReinforced: d(42), isFaded: false },
  { id: 'b26', sourceId: 'u6', targetId: 'u2', type: 'support', strength: 2, lastReinforced: d(55), isFaded: false },
  { id: 'b30', sourceId: 'u2', targetId: 'u4', type: 'intro', strength: 2, lastReinforced: d(48), isFaded: false },
  { id: 'b32', sourceId: 'u4', targetId: 'u8', type: 'insight', strength: 2, lastReinforced: d(33), isFaded: false },
  // April (60-90 days)
  { id: 'b6', sourceId: 'u3', targetId: 'u9', type: 'ritual', strength: 3, lastReinforced: d(65), isFaded: false },
  { id: 'b7', sourceId: 'u2', targetId: 'u5', type: 'intro', strength: 2, lastReinforced: d(72), isFaded: false },
  { id: 'b15', sourceId: 'leader', targetId: 'u4', type: 'help', strength: 2, lastReinforced: d(68), isFaded: false },
  { id: 'b25', sourceId: 'u1', targetId: 'u11', type: 'help', strength: 2, lastReinforced: d(80), isFaded: false },
  { id: 'b27', sourceId: 'u5', targetId: 'u8', type: 'intro', strength: 1, lastReinforced: d(75), isFaded: false },
  { id: 'b31', sourceId: 'u4', targetId: 'u7', type: 'review', strength: 1, lastReinforced: d(85), isFaded: false },
  // March (90-120 days)
  { id: 'b5', sourceId: 'u1', targetId: 'u8', type: 'review', strength: 2, lastReinforced: d(95), isFaded: false },
  { id: 'b11', sourceId: 'u5', targetId: 'u11', type: 'help', strength: 2, lastReinforced: d(100), isFaded: false },
  { id: 'b16', sourceId: 'u8', targetId: 'u18', type: 'intro', strength: 1, lastReinforced: d(105), isFaded: false },
  { id: 'b22', sourceId: 'u10', targetId: 'u12', type: 'support', strength: 1, lastReinforced: d(110), isFaded: false },
  // February (120-150 days, faded)
  { id: 'b9', sourceId: 'u4', targetId: 'u13', type: 'help', strength: 1, lastReinforced: d(130), isFaded: true },
  { id: 'b20', sourceId: 'u4', targetId: 'u5', type: 'insight', strength: 1, lastReinforced: d(140), isFaded: true },
  { id: 'b12', sourceId: 'u7', targetId: 'u12', type: 'review', strength: 1, lastReinforced: d(135), isFaded: true },
  // January (150-180 days, faded)
  { id: 'b13', sourceId: 'u3', targetId: 'u16', type: 'ritual', strength: 1, lastReinforced: d(160), isFaded: true },
  { id: 'b17', sourceId: 'u11', targetId: 'u14', type: 'support', strength: 1, lastReinforced: d(175), isFaded: true },
  { id: 'b21', sourceId: 'u9', targetId: 'u15', type: 'help', strength: 1, lastReinforced: d(180), isFaded: true },
];
