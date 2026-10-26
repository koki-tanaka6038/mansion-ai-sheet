// node test/calc.test.js で実行。計算式を、月次で残高を回す別の方法と突き合わせる。
const assert = require('assert');
const C = require('../calc.js');

function simulate(P, ratePct, years, m, months) {
  const r = ratePct / 100 / 12;
  let b = P;
  for (let i = 0; i < months; i++) b = b * (1 + r) - m;
  return b;
}

let pass = 0;
function ok(name, fn) { fn(); pass++; console.log('ok -', name); }

ok('3000万・1%・35年 の毎月返済は 84,686円（広く出回っている早見表の値）', () => {
  assert.strictEqual(Math.round(C.monthlyPayment(30000000, 1, 35)), 84686);
});
ok('月次で残高を回すと最終残高が0円になる（複数条件）', () => {
  for (const [P, r, y] of [[30000000, 1, 35], [77000000, 0.9, 35], [45000000, 2.5, 30], [20000000, 0, 20]]) {
    const m = C.monthlyPayment(P, r, y);
    assert.ok(Math.abs(simulate(P, r, y, m, y * 12)) < 1, `${P} ${r} ${y}`);
  }
});
ok('途中残高の式が月次シミュレーションと一致する', () => {
  const P = 50000000, r = 1.2, y = 35;
  const m = C.monthlyPayment(P, r, y);
  for (const k of [12, 120, 300]) {
    assert.ok(Math.abs(C.balanceAfter(P, r, y, k) - simulate(P, r, y, m, k)) < 1);
  }
});
ok('払える月額から逆算した借入額で、毎月返済額が元に戻る', () => {
  const P = C.principalFor(100000, 2.8, 35);
  assert.ok(Math.abs(C.monthlyPayment(P, 2.8, 35) - 100000) < 0.01);
});

const a = { age: 38, spouse: 'yes', spouseAge: 36, kids: 1, youngestAge: 2, grossIncome: 900, netIncome: '', otherDebt: 0,
  living: 30, assets: 1500, retireAge: '', price: 6000, area: 70, builtYear: 1980, scale: 's4', mgmtFee: 15000, repairFee: 14000,
  renoCost: 800, ownFunds: 1000, loan: 6300, years: 35, rate: 0.8, rateType: 'variable', worry: '金利上昇が不安' };
const r = C.analyze(a);
ok('手取り不明なら額面の75%で仮定し、仮定一覧に載る', () => {
  assert.strictEqual(r.netIncome, 9000000 * 0.75);
  assert.ok(r.assumptions.some(s => s.includes('手取り')));
  assert.ok(r.assumptions.some(s => s.includes('65歳')));
});
ok('負担率の定義', () => {
  assert.ok(Math.abs(r.burdenGross - r.annual / 9000000) < 1e-12);
  assert.ok(Math.abs(r.burdenNet - r.annual / 6750000) < 1e-12);
});
ok('65歳時点残高 = 27年返済後の残高', () => {
  assert.ok(Math.abs(r.retireBalance - C.balanceAfter(63000000, 0.8, 35, 27 * 12)) < 1e-6);
  assert.strictEqual(r.payoffAge, 73);
});
ok('修繕積立金の単価と位置（200円/㎡ は 20,000㎡以上の幅190〜325円の内側）', () => {
  assert.strictEqual(r.repairUnit, 200);
  assert.strictEqual(r.repairPos, 'within');
});
ok('資金の過不足 = 6300+1000 − (6000+800+510) = −10万円', () => {
  assert.ok(Math.abs(r.fundingGap - (-100000)) < 1e-6);
});
ok('1981年以前と変動金利の注意が出る', () => {
  assert.strictEqual(r.notes.length, 2);
});
ok('AIに渡す文章に、主要な数字と気になっていることが入る', () => {
  const t = C.buildAiText(a, r, '2026-10-20');
  assert.ok(t.includes(Math.round(r.monthly).toLocaleString('ja-JP') + '円'));
  assert.ok(t.includes('金利上昇が不安'));
  assert.ok(!t.includes('undefined') && !t.includes('NaN'));
});
ok('住宅以外の借入は毎月の額（円）で受け取り、年額にして負担率に足す', () => {
  const b = Object.assign({}, a, { otherDebt: undefined, otherDebtMonthly: 30000 });
  const rb = C.analyze(b);
  assert.ok(Math.abs(rb.burdenGrossAll - (rb.annual + 360000) / 9000000) < 1e-12);
  const t = C.buildAiText(b, rb, '2026-10-25');
  assert.ok(t.includes('住宅以外の借入の毎月の返済額：30,000円'));
});
ok('AIに渡す文章に版の名前を入れない（作成日だけ）', () => {
  const t = C.buildAiText(a, r, '2026-10-25');
  assert.ok(!/v0\.|AI相談シート/.test(t));
  assert.ok(t.includes('（作成日：2026-10-25）'));
});

// ---- v0.4：自動・初期値・未回答の出所を相談文に出す ----
const v4 = { age: 35, spouse: 'none', kids: '0', grossIncome: 800, price: 5000, ownFunds: '', loan: 5425, years: 35, rate: 0.9,
  otherDebtHas: 'none', loanAuto: true, yearsDefault: true };
const r4 = C.analyze(v4);
const t4 = C.buildAiText(v4, r4, '2026-10-26');
ok('借入額が自動のときは過不足を出さず、相談文に自動・未修正と書く', () => {
  assert.strictEqual(r4.fundingGap, null);
  assert.ok(t4.includes('資金の過不足：借入額をシートが自動で合わせた'));
  assert.ok(t4.includes('借入額：5,425万円（シートの自動計算'));
  assert.ok(!t4.includes('NaN') && !t4.includes('undefined'));
});
ok('返済期間が初期値のままなら、そう書く', () => {
  assert.ok(t4.includes('返済期間：35年（シートの初期値のまま'));
  const t = C.buildAiText(Object.assign({}, v4, { yearsDefault: false }), r4, '2026-10-26');
  assert.ok(t.includes('返済期間：35年\n'));
});
ok('「なし」は本人回答、空欄は未回答と分けて書く', () => {
  assert.ok(t4.includes('住宅以外の借入：なし（本人回答）'));
  assert.ok(t4.includes('リノベーション費用：未回答。計算では0円とした'));
  assert.ok(t4.includes('自己資金として出す額：未入力（計算では0円とした）'));
  const t = C.buildAiText(Object.assign({}, v4, { otherDebtHas: undefined, renoHas: 'none' }), r4, '2026-10-26');
  assert.ok(t.includes('住宅以外の借入：未回答。計算では0円とした'));
  assert.ok(t.includes('リノベーション：しない（本人回答）'));
});
ok('「なし」を選んだら、残っている金額は負担率に足さない', () => {
  const b = Object.assign({}, v4, { otherDebtMonthly: 30000 });
  assert.strictEqual(C.analyze(b).burdenGrossAll, C.analyze(v4).burdenGross);
  const c = Object.assign({}, b, { otherDebtHas: 'yes' });
  assert.ok(Math.abs(C.analyze(c).burdenGrossAll - (C.analyze(c).annual + 360000) / 8000000) < 1e-12);
});
ok('金利が分からないときは、例の3通りで計算し、出典と「勧めるものではない」を書く', () => {
  const a = Object.assign({}, v4, { rate: '' });
  const ex = C.analyzeExamples(a);
  assert.deepStrictEqual(ex.map(e => e.rate), [1.0, 1.5, 2.0]);
  assert.strictEqual(Math.round(ex[0].r.monthly), Math.round(C.monthlyPayment(54250000, 1.0, 35)));
  const t = C.buildAiText(a, ex[0].r, '2026-10-26', ex);
  assert.ok(t.includes('金利：本人は未入力（分からない）'));
  assert.ok(t.includes('どれかを勧めるものではない'));
  assert.ok(t.includes('住宅金融支援機構'));
  assert.ok(t.includes('例3（金利 年2.0%）：毎月の返済額 ' + Math.round(ex[2].r.monthly).toLocaleString('ja-JP') + '円'));
  assert.ok(!t.includes('金利が1%上がった場合') && !t.includes('NaN') && !t.includes('undefined'));
});
ok('退職年齢が未定なら、65歳と仮定したと書く', () => {
  const t = C.buildAiText(Object.assign({}, v4, { retirePick: 'undecided' }), r4, '2026-10-26');
  assert.ok(t.includes('退職予定年齢：未定（計算では65歳と仮定）'));
});
ok('管理費・修繕積立金が未入力なら、0円としたことを仮定に書く', () => {
  assert.ok(r4.assumptions.some(s => s.includes('管理費・修繕積立金は未入力（または分からない）のため0円')));
  assert.ok(t4.includes('管理費・修繕積立金は未入力（または分からない）のため0円'));
  const one = C.analyze(Object.assign({}, v4, { mgmtFee: 12000 }));
  assert.ok(one.assumptions.some(s => s.startsWith('修繕積立金は未入力')));
  assert.ok(!r.assumptions.some(s => s.includes('管理費')));
});
ok('子ども「3人以上」は、相談文でも3人以上と書く', () => {
  assert.ok(C.buildAiText(Object.assign({}, v4, { kids: '3' }), r4, '2026-10-26').includes('子ども：3人以上'));
});
console.log(`\n${pass} passed`);
console.log('\n--- 出力例 ---\n' + C.buildAiText(a, r, '2026-10-20'));
