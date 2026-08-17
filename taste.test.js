// 用 node taste.test.js 執行。目的是確認分數真的有鑑別度，
// 而不是像舊版那樣一堆人並列滿分。
const { tasteSimilarity } = require('./taste');

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
}

const A = {
  taste: 'smoky', aroma: ['wood', 'roast'], texture: 'silky',
  strength: 4, sourness: 2, base: ['whisky'],
  mood: 'deep', occasion: 'bar', timing: 'late',
  adventure: 4, personality: 'mysterious', avoid: 'too_sweet',
};
// 與 A 完全相反
const Z = {
  taste: 'sweet', aroma: ['citrus', 'floral'], texture: 'sparkling',
  strength: 1, sourness: 5, base: ['vodka'],
  mood: 'party', occasion: 'outdoor', timing: 'brunch',
  adventure: 1, personality: 'cozy', avoid: 'too_bitter',
};
// 與 A 接近但不同
const B = {
  taste: 'smoky', aroma: ['wood', 'spice'], texture: 'silky',
  strength: 4, sourness: 3, base: ['whisky', 'rum'],
  mood: 'deep', occasion: 'home', timing: 'late',
  adventure: 3, personality: 'mysterious', avoid: 'too_sweet',
};

console.log('相似度基本性質');
const same = tasteSimilarity(A, A);
check('完全相同 = 100%', same.percent === 100, `實際 ${same.percent}`);

const opposite = tasteSimilarity(A, Z);
check('完全相反應該很低（< 15%）', opposite.percent < 15, `實際 ${opposite.percent}`);

const near = tasteSimilarity(A, B);
check('接近但不同要落在中間（40~90%）',
  near.percent > 40 && near.percent < 90, `實際 ${near.percent}`);

check('對稱性 sim(A,B) = sim(B,A)',
  tasteSimilarity(A, B).score === tasteSimilarity(B, A).score);

console.log('\n舊版的兩個 bug');
// 舊版用 a[k] === b[k] 比陣列，內容相同也永遠不相等
const m1 = { aroma: ['wood', 'roast'] };
const m2 = { aroma: ['roast', 'wood'] };
check('複選題內容相同（順序不同）要滿分',
  tasteSimilarity(m1, m2).percent === 100, `實際 ${tasteSimilarity(m1, m2).percent}`);

const half = tasteSimilarity({ aroma: ['wood', 'roast'] }, { aroma: ['wood', 'citrus'] });
check('複選題部分重疊要落在中間', half.percent > 20 && half.percent < 60, `實際 ${half.percent}`);

// 舊版只要 5 題相同就撞到 100 上限，導致大量並列
const manyTie = [
  { ...A, mood: 'party', occasion: 'home', timing: 'brunch' },
  { ...A, mood: 'chill', occasion: 'restaurant', timing: 'dinner' },
  { ...A, mood: 'romantic', occasion: 'outdoor', timing: 'aperitif' },
];
const scores = manyTie.map(x => tasteSimilarity(A, x).percent);
check('多個高相似對象不應全部並列滿分',
  new Set(scores).size > 1 || scores[0] < 100, `實際 ${scores.join(', ')}`);
check('高相似但有差異者不得為 100%',
  scores.every(s => s < 100), `實際 ${scores.join(', ')}`);

console.log('\n缺漏資料');
check('對方沒作答 = 0', tasteSimilarity(A, null).percent === 0);
check('只有部分題目也能算',
  tasteSimilarity({ taste: 'smoky' }, { taste: 'smoky' }).percent === 100);
check('未作答的題目不列入 breakdown',
  tasteSimilarity({ taste: 'smoky' }, { taste: 'smoky' }).answered === 1);

console.log('\nbreakdown 與 shared');
check('breakdown 涵蓋所有雙方都作答的題目', near.breakdown.length === 12,
  `實際 ${near.breakdown.length}`);
check('shared 只列出高度一致的面向',
  near.shared.length > 0 && near.shared.length <= 3, JSON.stringify(near.shared));

console.log(`\n分數樣本：相同 ${same.percent}% / 接近 ${near.percent}% / 相反 ${opposite.percent}%`);
console.log(`一致面向：${near.shared.join('、')}`);
console.log(`\n通過 ${pass}，失敗 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
