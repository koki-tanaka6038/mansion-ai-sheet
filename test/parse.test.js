// 物件ページの文章の読み取りテスト。node test/parse.test.js
var assert = require('assert');
var P = require('../parse.js');
var n = 0;
function t(name, fn) { fn(); n++; console.log('ok ' + name); }

// SUUMO の中古マンション「物件概要」を想定した架空の文章（タブ区切り・1行）
var tabbed = [
  '価格\t5980万円',
  '管理費\t1万2000円／月（委託(通勤)）',
  '修繕積立金\t1万5600円／月',
  '専有面積\t70.12m2（壁芯）',
  '完成時期（築年月）\t1998年3月',
  '所在階\t5階',
  '構造・階建て\tSRC11階建'
].join('\n');

// スマホでコピーすると見出しと値が別の行になる想定
var split = '価格\n1億2980万円\n専有面積\n85.5㎡\n築年月\n２００５年１０月\n管理費\n18,400円/月\n修繕積立金\n9,800円/月\n構造・階建て\nRC地上32階地下1階建';

t('タブ区切りの物件概要', function () {
  var r = P.parseListing(tabbed);
  assert.deepStrictEqual(r, { price: 5980, area: 70.12, builtYear: 1998, mgmtFee: 12000, repairFee: 15600 });
});
t('見出しと値が別の行・億・全角・20階以上', function () {
  var r = P.parseListing(split);
  assert.strictEqual(r.price, 12980);
  assert.strictEqual(r.area, 85.5);
  assert.strictEqual(r.builtYear, 2005);
  assert.strictEqual(r.mgmtFee, 18400);
  assert.strictEqual(r.repairFee, 9800);
  assert.strictEqual(r.scale, 'tower');
});
t('無関係な文章では何も読み取らない', function () {
  assert.deepStrictEqual(P.parseListing('駅徒歩5分の明るいお部屋です'), {});
  assert.deepStrictEqual(P.parseListing(''), {});
});
t('1万円ちょうど・価格の範囲表記', function () {
  var r = P.parseListing('価格：3980万円～4280万円\n管理費：1万円/月');
  assert.strictEqual(r.price, 3980);
  assert.strictEqual(r.mgmtFee, 10000);
});
console.log(n + ' tests passed');
