// マンション購入 AI相談シート — 物件ページの文章から物件概要を読み取る
// SUUMO などの物件ページで「物件概要」をコピーして貼り付けた文章が対象。
// ページを取りに行くことはしない（ブラウザだけで動かすため）。画面に依存しない純粋関数。
(function (root) {
  'use strict';

  function toHalf(s) {
    return String(s)
      .replace(/[０-９．，：／]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/㎡|m²|ｍ２|m2|平米/g, '㎡')
      .replace(/\r/g, '');
  }

  // 「1億2980万円」「5,980万円」「3980万円～4280万円」→ 万円（範囲は最初の値）
  function manYen(s) {
    var m = s.match(/(?:(\d+)\s*億)?\s*([\d,]+(?:\.\d+)?)?\s*万円/);
    if (!m || (!m[1] && !m[2])) {
      var oku = s.match(/(\d+(?:\.\d+)?)\s*億円/);
      return oku ? Number(oku[1]) * 10000 : null;
    }
    return (m[1] ? Number(m[1]) * 10000 : 0) + (m[2] ? Number(m[2].replace(/,/g, '')) : 0);
  }

  // 「1万2000円」「12,000円」「1万円」→ 円
  function yen(s) {
    var m = s.match(/(?:(\d+)\s*万)?\s*([\d,]+)?\s*円/);
    if (!m || (!m[1] && !m[2])) return null;
    return (m[1] ? Number(m[1]) * 10000 : 0) + (m[2] ? Number(m[2].replace(/,/g, '')) : 0);
  }

  // 見出しの直後（同じ行か次の行）の値を取り出す
  function after(text, labels) {
    for (var i = 0; i < labels.length; i++) {
      var re = new RegExp(labels[i] + '[^\\S\\n]*[:：]?[^\\S\\n]*([^\\n]*)(?:\\n[^\\S\\n]*([^\\n]*))?');
      var m = text.match(re);
      if (m) {
        var v = (m[1] || '').trim();
        if (!v || /^[?？]$/.test(v)) v = (m[2] || '').trim();
        if (v) return v;
      }
    }
    return null;
  }

  function parseListing(raw) {
    var t = toHalf(raw || '');
    var out = {};
    var v;

    v = after(t, ['価格', '販売価格']);
    if (v && /万円|億円/.test(v)) out.price = manYen(v);

    v = after(t, ['専有面積']);
    if (v) { var am = v.match(/(\d+(?:\.\d+)?)\s*㎡/); if (am) out.area = Number(am[1]); }

    v = after(t, ['完成時期\\s*[(（]築年月[)）]', '築年月', '完成時期', '建築年月', '竣工']);
    if (v) { var ym = v.match(/(\d{4})\s*年/); if (ym) out.builtYear = Number(ym[1]); }

    v = after(t, ['管理費(?:等)?']);
    if (v) { var mf = yen(v); if (mf !== null) out.mgmtFee = mf; }

    v = after(t, ['修繕積立金']);
    if (v) { var rf = yen(v); if (rf !== null) out.repairFee = rf; }

    // 階数が20階以上ならタワー区分。20階未満は延床面積が分からないと区分が決まらないので入れない
    v = after(t, ['構造・階建て', '構造・階建', '階建']) || '';
    var src = v + ' ' + t;
    var fl = src.match(/地上\s*(\d+)\s*階/) || src.match(/(\d+)\s*階建/);
    if (fl && Number(fl[1]) >= 20) out.scale = 'tower';

    Object.keys(out).forEach(function (k) {
      if (out[k] === null || (typeof out[k] === 'number' && !isFinite(out[k]))) delete out[k];
    });
    return out;
  }

  var api = { parseListing: parseListing };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Parse = api;
})(this);
