/* ── 港鐵大富翁 · 遊戲資料 ───────────────────────────────────── */

export const START_CASH = 15000;
export const GO_SALARY = 2000;
export const JAIL_FINE = 800;
export const MAX_LEVEL = 3;
export const MAX_ROUNDS = 20;
export const RENT_MULT = [0.1, 0.18, 0.3, 0.45];
export const BUILD_RATIO = 0.5;

export const RUSH_ROUND = 8;
export const RUSH_MULT = 1.5;

/* 四位港鐵角色：各有被動專長 */
export const ROLES = [
  { id: 'captain', name: '車長', glyph: '駕', color: '#ff5d73', ability: '駛經香港站額外 +HK$400', goBonus: 400 },
  { id: 'master', name: '站長', glyph: '站', color: '#45c8f5', ability: '買入車站 9 折', buyDiscount: 0.1 },
  { id: 'engineer', name: '工程師', glyph: '工', color: '#ffd166', ability: '上蓋升級 75 折', buildDiscount: 0.25 },
  { id: 'rider', name: '乘客', glyph: '客', color: '#5ee6a8', ability: '每次抽卡 +HK$200 津貼', cardBonus: 200 },
];

export const PLAYER_COLORS = ROLES.map((r) => r.color);
export const PLAYER_NAMES = ROLES.map((r) => r.name);

export const LINES = {
  tsuen: { name: '荃灣綫', color: '#e2231a' },
  kwun: { name: '觀塘綫', color: '#00ab4e' },
  island: { name: '港島綫', color: '#007dc5' },
  tung: { name: '東涌綫', color: '#f7943e' },
  tuenma: { name: '屯馬綫', color: '#9a3b26' },
  tko: { name: '將軍澳綫', color: '#7d499d' },
  east: { name: '東鐵綫', color: '#53b7e8' },
  south: { name: '南港島綫', color: '#b5bd00' },
};

/* 40 格：4 角落 + 23 車站 + 2 車費 + 2 商場 + 6 消息 + 3 搭車 */
export const BOARD = [
  { type: 'go', name: '香港站', sub: '經過領取 HK$2,000', accent: '#5ee6a8' },
  { type: 'property', name: '荃灣', line: 'tsuen', price: 600 },
  { type: 'card', name: '乘客消息', accent: '#f5cd7c' },
  { type: 'property', name: '葵芳', line: 'tsuen', price: 650 },
  { type: 'tax', name: '票價調整', sub: '繳付 10% 現金', accent: '#ff8a5c' },
  { type: 'ride', name: '機場快綫', mode: 'express', fee: 800, accent: '#6fe3ff', sub: 'HK$800 飛往任何車站' },
  { type: 'property', name: '深水埗', line: 'tsuen', price: 700 },
  { type: 'utility', name: '八達通增值站', price: 1500, accent: '#7fd7ff' },
  { type: 'property', name: '觀塘', line: 'kwun', price: 800 },
  { type: 'property', name: '九龍灣', line: 'kwun', price: 850 },
  { type: 'jail', name: '服務延誤', sub: '暫停 2 回合', accent: '#ffb45c' },
  { type: 'property', name: '彩虹', line: 'kwun', price: 900 },
  { type: 'utility', name: '車站商場', price: 1500, accent: '#c9a7ff' },
  { type: 'property', name: '東涌', line: 'tung', price: 1300 },
  { type: 'property', name: '青衣', line: 'tung', price: 1350 },
  { type: 'card', name: '乘客消息', accent: '#f5cd7c' },
  { type: 'property', name: '九龍', line: 'tung', price: 1400 },
  { type: 'ride', name: '轉綫站', mode: 'transfer', fee: 0, accent: '#6fe3ff', sub: '免費轉乘任何路綫' },
  { type: 'property', name: '銅鑼灣', line: 'island', price: 1100 },
  { type: 'property', name: '灣仔', line: 'island', price: 1150 },
  { type: 'parking', name: '車廠', sub: '領取車費池', accent: '#5ee6a8' },
  { type: 'property', name: '中環', line: 'island', price: 1200 },
  { type: 'card', name: '乘客消息', accent: '#f5cd7c' },
  { type: 'property', name: '元朗', line: 'tuenma', price: 1500 },
  { type: 'property', name: '鑽石山', line: 'tuenma', price: 1550 },
  { type: 'card', name: '乘客消息', accent: '#f5cd7c' },
  { type: 'property', name: '紅磡', line: 'tuenma', price: 1600 },
  { type: 'tax', name: '票價調整', sub: '繳付 10% 現金', accent: '#ff8a5c' },
  { type: 'property', name: '寶琳', line: 'tko', price: 1800 },
  { type: 'property', name: '將軍澳', line: 'tko', price: 1850 },
  { type: 'gotojail', name: '事故', sub: '前往服務延誤', accent: '#ff6b6b' },
  { type: 'property', name: '北角', line: 'tko', price: 1900 },
  { type: 'card', name: '乘客消息', accent: '#f5cd7c' },
  { type: 'property', name: '沙田', line: 'east', price: 2000 },
  { type: 'property', name: '大圍', line: 'east', price: 2050 },
  { type: 'ride', name: '轉綫站', mode: 'transfer', fee: 0, accent: '#6fe3ff', sub: '免費轉乘任何路綫' },
  { type: 'property', name: '九龍塘', line: 'east', price: 2100 },
  { type: 'card', name: '乘客消息', accent: '#f5cd7c' },
  { type: 'property', name: '海怡半島', line: 'south', price: 2200 },
  { type: 'property', name: '海洋公園', line: 'south', price: 2300 },
];

export const GROUP_TILES = Object.fromEntries(
  Object.keys(LINES).map((key) => [
    key,
    BOARD.reduce((acc, t, i) => (t.line === key ? [...acc, i] : acc), []),
  ]),
);

export function tilePosition(i) {
  if (i <= 10) return { x: 5 - i, z: 5, side: 'bottom', inner: 'top' };
  if (i <= 20) return { x: -5, z: 5 - (i - 10), side: 'left', inner: 'right' };
  if (i <= 30) return { x: -5 + (i - 20), z: -5, side: 'top', inner: 'bottom' };
  return { x: 5, z: -5 + (i - 30), side: 'right', inner: 'left' };
}

export function buildCost(idx) {
  const price = BOARD[idx].price || 0;
  return Math.round((price * BUILD_RATIO) / 50) * 50;
}

/* 站長買地折扣 */
export function buyPrice(idx, player) {
  const base = BOARD[idx].price || 0;
  const discount = player?.buyDiscount || 0;
  return Math.round((base * (1 - discount)) / 10) * 10;
}

/* 工程師升級折扣 */
export function upgradeCost(idx, player) {
  const discount = player?.buildDiscount || 0;
  return Math.round((buildCost(idx) * (1 - discount)) / 10) * 10;
}

/* 車費：等級 0 = 月台，1 = 商舖，2 = 上蓋，3 = 摩天塔 */
export function rentFor(idx, level = 0, monopoly = false) {
  const t = BOARD[idx];
  if (t.type === 'utility') return null;
  if (t.type !== 'property') return 0;
  const base = Math.round((t.price * RENT_MULT[level]) / 10) * 10;
  return monopoly ? base * 2 : base;
}

export function utilityRent(dice, ownedBoth) {
  return dice * (ownedBoth ? 250 : 100);
}

export function levelName(level) {
  return ['月台', '商舖', '上蓋物業', '摩天塔'][level] ?? '';
}

export function money(n) {
  return 'HK$' + Math.round(n).toLocaleString('en-US');
}

export function tileLineName(idx) {
  const t = BOARD[idx];
  return t.line ? LINES[t.line].name : '';
}
