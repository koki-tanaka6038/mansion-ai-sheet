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
console.log(`\n${pass} passed`);
console.log('\n--- 出力例 ---\n' + C.buildAiText(a, r, '2026-10-20'));
