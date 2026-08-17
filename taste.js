// ===== 品味相似度 =====
// 把品味測驗的答案兩兩比對，回傳 0~1 的分數與逐題明細。
// 設計重點：
//   1. 複選題用 Jaccard（交集 / 聯集），這才是使用者說的「重疊比對」
//   2. 逐題算完再加權平均，分數自然落在 0~1，不會像舊版那樣全部擠在滿分
//   3. 回傳 breakdown，UI 才能說出「你們在香氣、場合上特別接近」

// 題目規格必須與 quiz.js 的 QUESTIONS 對齊
const SPEC = [
  { id: 'taste',       type: 'single', weight: 1.4, label: '風味' },
  { id: 'aroma',       type: 'multi',  weight: 1.4, label: '香氣' },
  { id: 'texture',     type: 'single', weight: 1.0, label: '口感' },
  { id: 'strength',    type: 'scale',  weight: 1.0, label: '酒精強度', min: 1, max: 5 },
  { id: 'sourness',    type: 'scale',  weight: 0.8, label: '酸度',     min: 1, max: 5 },
  { id: 'base',        type: 'multi',  weight: 1.3, label: '基酒' },
  { id: 'mood',        type: 'single', weight: 1.0, label: '氛圍' },
  { id: 'occasion',    type: 'single', weight: 0.9, label: '場合' },
  { id: 'timing',      type: 'single', weight: 0.7, label: '時段' },
  { id: 'adventure',   type: 'scale',  weight: 0.8, label: '冒險程度', min: 1, max: 5 },
  { id: 'personality', type: 'single', weight: 0.9, label: '個性' },
  { id: 'avoid',       type: 'single', weight: 0.7, label: '地雷' },
];

const asArray = v => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);

// 交集 / 聯集。兩邊都沒選時視為無資訊，回傳 null 由呼叫端跳過
function jaccard(a, b) {
  const A = new Set(asArray(a));
  const B = new Set(asArray(b));
  if (A.size === 0 && B.size === 0) return null;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? null : inter / union;
}

function scaleSim(a, b, min, max) {
  if (typeof a !== 'number' || typeof b !== 'number') return null;
  const span = max - min;
  if (span <= 0) return null;
  return 1 - Math.min(1, Math.abs(a - b) / span);
}

/**
 * @returns {{score:number, percent:number, breakdown:Array, shared:Array, answered:number}}
 *   score 0~1；percent 四捨五入後的百分比；breakdown 逐題分數；
 *   shared 兩人一致度最高的幾個面向，供介面說明用
 */
function tasteSimilarity(a, b) {
  if (!a || !b) return { score: 0, percent: 0, breakdown: [], shared: [], answered: 0 };

  let weighted = 0;
  let totalWeight = 0;
  const breakdown = [];

  for (const q of SPEC) {
    const av = a[q.id];
    const bv = b[q.id];
    let s = null;

    if (q.type === 'multi') {
      s = jaccard(av, bv);
    } else if (q.type === 'scale') {
      s = scaleSim(av, bv, q.min, q.max);
    } else {
      // 單選：任一方沒作答就視為無資訊，不要當成「不一致」而扣分
      if (av == null || bv == null || av === '' || bv === '') s = null;
      else s = av === bv ? 1 : 0;
    }

    if (s === null) continue;
    weighted += s * q.weight;
    totalWeight += q.weight;
    breakdown.push({ id: q.id, label: q.label, score: Number(s.toFixed(3)) });
  }

  if (totalWeight === 0) return { score: 0, percent: 0, breakdown: [], shared: [], answered: 0 };

  const score = weighted / totalWeight;
  const shared = breakdown
    .filter(d => d.score >= 0.6)
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    .map(d => d.label);

  return {
    score: Number(score.toFixed(4)),
    percent: Math.round(score * 100),
    breakdown,
    shared,
    answered: breakdown.length,
  };
}

module.exports = { tasteSimilarity, SPEC };
