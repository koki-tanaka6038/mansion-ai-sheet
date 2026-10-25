// マンション購入 AI相談シート v0.1 — 画面
// 回答はこの端末のブラウザ（localStorage）にだけ保存する。外部への送信はしない。
(function () {
  'use strict';

  var STORE_KEY = 'mansion-sheet-v0.1';

  var STEPS = [
    {
      title: 'あなたの世帯',
      lead: '分からないものは「分からない」にチェックで大丈夫です。',
      fields: [
        { id: 'age', label: 'あなたの年齢', type: 'number', unit: '歳', required: true },
        { id: 'spouse', label: '配偶者・パートナー', type: 'chips', options: [['none', 'なし'], ['yes', 'あり']] },
        { id: 'spouseAge', label: '配偶者・パートナーの年齢', type: 'number', unit: '歳', parent: 'spouse', when: function (a) { return a.spouse === 'yes'; } },
        { id: 'kids', label: '子どもの人数', type: 'chips', options: [['0', '0人'], ['1', '1人'], ['2', '2人'], ['3', '3人以上']] },
        { id: 'youngestAge', label: '末っ子の年齢', type: 'number', unit: '歳', hint: '生まれる予定なら 0', parent: 'kids', when: function (a) { return Number(a.kids) > 0; } },
        { id: 'grossIncome', label: '世帯の年収（額面・税込）', type: 'number', unit: '万円', required: true, hint: '共働きなら2人の合計。源泉徴収票の「支払金額」' },
        { id: 'netIncome', label: '世帯の手取り年収', type: 'number', unit: '万円', unknown: true, hint: 'ボーナス込みで1年に口座へ入る額' },
        { id: 'otherDebt', label: '住宅以外の借入の年間返済額', type: 'number', unit: '万円', hint: '車のローン・奨学金など。なければ 0' },
        { id: 'retireAge', label: '退職する予定の年齢', type: 'number', unit: '歳', unknown: true }
      ]
    },
    {
      title: '今の家計',
      lead: 'ざっくりで構いません。',
      fields: [
        { id: 'living', label: '毎月の生活費（住居費を除く）', type: 'number', unit: '万円', unknown: true, hint: '食費・光熱費・通信・保険・教育など' },
        { id: 'assets', label: '預貯金と投資の合計', type: 'number', unit: '万円', unknown: true }
      ]
    },
    {
      title: '検討中の物件',
      lead: '販売図面や物件ページに書いてあります。物件ページの文章を貼り付けると、まとめて入力できます。',
      importable: true,
      fields: [
        { id: 'price', label: '物件価格', type: 'number', unit: '万円', required: true },
        { id: 'area', label: '専有面積', type: 'number', unit: '㎡', unknown: true, step: '0.01', hint: '例：70.12',
          where: ['物件ページの「物件概要」や販売図面に、「専有面積　70.12㎡（壁芯）」のように書いてあります。', '「壁芯」「内法」のどちらでも、書いてある数字をそのまま入れてください。バルコニー面積や間取り図の各部屋の広さは足しません。'] },
        { id: 'builtYear', label: '建築年（西暦）', type: 'number', unit: '年', unknown: true, hint: '例：1998' },
        { id: 'scale', label: '建物の規模', type: 'chips', hint: '修繕積立金を国のガイドラインと比べるのに使います',
          where: ['階数は物件概要の「構造・階建て」の行に書いてあります。例：「RC14階建」なら20階未満です。', '延床面積は「延床面積」「建物延べ面積」などの行に書かれていることがあります。見つからなければ「分からない」を選んでください。修繕積立金を国の目安と比べる表示が出ないだけで、ほかの計算には使いません。'],
          options: [['s1', '20階未満・延床5,000㎡未満'], ['s2', '20階未満・延床5,000〜1万㎡'], ['s3', '20階未満・延床1万〜2万㎡'], ['s4', '20階未満・延床2万㎡以上'], ['tower', '20階以上'], ['unknown', '分からない']] },
        { id: 'mgmtFee', label: '管理費（月額）', type: 'number', unit: '円', unknown: true,
          where: ['物件概要の「管理費」の行です（「管理費等」と書かれていることもあります）。', '例：「管理費　1万2000円／月」なら 12000 と入れます。'] },
        { id: 'repairFee', label: '修繕積立金（月額）', type: 'number', unit: '円', unknown: true,
          where: ['物件概要の「修繕積立金」の行です。例：「修繕積立金　1万5600円／月」なら 15600 と入れます。', '入居時に一度だけ払う「修繕積立基金」「修繕一時金」とは別のお金です。毎月の額を入れてください。'] },
        { id: 'renoCost', label: 'リノベーション費用', type: 'number', unit: '万円', hint: 'しないなら 0。見積もり前なら想定額' }
      ]
    },
    {
      title: 'お金の計画',
      lead: '銀行の事前審査や見積もりの数字があれば、それを入れてください。',
      fields: [
        { id: 'ownFunds', label: '自己資金として出す額', type: 'number', unit: '万円', hint: '頭金と諸費用のうち、現金で払う額' },
        { id: 'loan', label: '借入額', type: 'number', unit: '万円', required: true, suggest: true },
        { id: 'years', label: '返済期間', type: 'number', unit: '年', required: true, hint: 'よく選ばれる35年を最初から入れてあります。違えば直してください' },
        { id: 'rate', label: '金利', type: 'number', unit: '%', required: true, step: '0.001', hint: '見積もりや銀行サイトに書かれた、今検討している金利' },
        { id: 'rateType', label: '金利のタイプ', type: 'chips', options: [['variable', '変動'], ['fixedTerm', '固定期間選択'], ['fixed', '全期間固定'], ['mixed', 'ミックス'], ['undecided', '未定']] }
      ]
    },
    {
      title: 'いちばん気になっていること',
      lead: 'AIが最初に答える質問になります。空欄でも大丈夫です。',
      fields: [
        { id: 'worry', label: '気になっていること・迷っていること', type: 'textarea',
          placeholder: '例：金利が上がったら払えるか不安／繰上返済と投資のどちらを優先すべきか' }
      ]
    }
  ];

  // チェックリストに出す短い名前
  var SHORT = {
    age: '年齢', spouse: '配偶者', spouseAge: '配偶者の年齢', kids: '子ども', youngestAge: '末っ子の年齢',
    grossIncome: '額面年収', netIncome: '手取り年収', otherDebt: '他の借入', retireAge: '退職年齢',
    living: '生活費', assets: '預貯金・投資', price: '物件価格', area: '専有面積', builtYear: '建築年',
    scale: '建物の規模', mgmtFee: '管理費', repairFee: '修繕積立金', renoCost: 'リノベ費用',
    ownFunds: '自己資金', loan: '借入額', years: '返済期間', rate: '金利', rateType: '金利タイプ', worry: '気になること'
  };

  var state = load();
  var app = document.getElementById('app');
  var barIn = document.getElementById('barIn');
  var side = document.getElementById('side');

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && s.answers) return s;
    } catch (e) { /* 保存できない環境でも動かす */ }
    return { step: -1, answers: { years: '35' }, unknown: {} };
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 無視 */ }
  }
  function clearAll() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* 無視 */ }
    state = { step: -1, answers: { years: '35' }, unknown: {} };
    render();
  }

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  var toastTimer;
  function toast(msg, ms) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 1800);
  }

  // 入力欄のその場で ✓ を付ける（入力欄を離れたときに値が正しければ）
  function markField(f, ok) {
    var b = document.getElementById('qb-' + f.id);
    var st = ok ? fieldStatus(f) : 'todo';
    if (b) {
      var was = b.className;
      b.className = 'qbox ' + st;
      b.textContent = st === 'done' ? '✓' : st === 'unknown' ? '?' : '';
      if (st !== 'todo' && was.indexOf(st) < 0) {
        b.classList.add('pop');
        var plus = el('span', { class: 'fplus', 'aria-hidden': 'true', text: st === 'done' ? '+1' : '?' });
        b.parentNode.insertBefore(plus, b.nextSibling);
        setTimeout(function () { plus.remove(); }, 1000);
      }
    }
    renderChecklist();
  }

  function bar(buttons) {
    barIn.innerHTML = '';
    buttons.forEach(function (b) { barIn.appendChild(b); });
  }

  // 回答の取り出し（「分からない」は空として扱う）
  function answers() {
    var a = {};
    Object.keys(state.answers).forEach(function (k) {
      a[k] = state.unknown[k] ? '' : state.answers[k];
    });
    if (a.kids === undefined) a.kids = '';
    return a;
  }

  // 全角数字・カンマ・全角ピリオドを半角の数字に直す（スマホの日本語入力対策）
  function normalizeNum(v) {
    return String(v)
      .replace(/[０-９．]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[,，、\s]/g, '');
  }

  function suggestLoan() {
    var a = state.answers;
    var price = Number(a.price), reno = Number(a.renoCost) || 0, own = Number(a.ownFunds) || 0;
    if (!price) return null;
    return Math.max(0, Math.round(price + reno + price * 0.085 - own));
  }

  // ---- チェックリスト（答えると埋まっていく） ----

  function fieldStatus(f) {
    if (state.unknown[f.id]) return 'unknown';
    var v = state.answers[f.id];
    return v !== undefined && String(v).trim() !== '' ? 'done' : 'todo';
  }

  function visibleFields(si) {
    return STEPS[si].fields.filter(function (f) { return !f.when || f.when(state.answers); });
  }

  // 数える単位。条件付きの項目（配偶者の年齢など）は親の項目に含め、選び方で分母が増えないようにする
  function slots(si) {
    return STEPS[si].fields.filter(function (f) { return !f.when; });
  }
  function children(f) {
    return STEPS.reduce(function (acc, s) {
      return acc.concat(s.fields.filter(function (c) { return c.parent === f.id && c.when(state.answers); }));
    }, []);
  }
  function slotStatus(f) {
    var st = fieldStatus(f);
    if (st === 'todo') return 'todo';
    var kidTodo = children(f).some(function (c) { return fieldStatus(c) === 'todo'; });
    return kidTodo ? 'todo' : st;
  }
  function tally() {
    var t = { total: 0, filled: 0, reqLeft: 0, per: [] };
    STEPS.forEach(function (s, si) {
      var p = { total: 0, filled: 0 };
      slots(si).forEach(function (f) {
        var st = slotStatus(f);
        p.total++; t.total++;
        if (st !== 'todo') { p.filled++; t.filled++; }
        else if (f.required) t.reqLeft++;
      });
      t.per.push(p);
    });
    return t;
  }

  var lastFilled = null;
  function renderChecklist() {
    var t = tally();
    renderProgress(t);
    if (!side) return;
    side.innerHTML = '';
    if (state.step < 0) { side.hidden = true; document.body.classList.remove('has-side'); return; }
    side.hidden = false;
    document.body.classList.add('has-side');
    var groups = STEPS.map(function (s, si) {
      var items = slots(si).map(function (f) {
        var st = slotStatus(f);
        var mark = st === 'done' ? '✓' : st === 'unknown' ? '?' : '';
        return el('li', {}, [el('button', { type: 'button', class: 'ck ' + st + (f.required ? ' req' : ''),
          onclick: function () { jumpTo(si, f.id); } }, [
          el('span', { class: 'box', 'aria-hidden': 'true', text: mark }),
          el('span', { text: SHORT[f.id] || f.label }),
          f.required && st === 'todo' ? el('span', { class: 'need', text: '必須' }) : null
        ])]);
      });
      return el('div', { class: 'grp' + (si === state.step ? ' cur' : '') }, [
        el('div', { class: 'gt', text: (si + 1) + '. ' + s.title + '　' + t.per[si].filled + ' / ' + t.per[si].total }),
        el('ul', {}, items)
      ]);
    });
    var open = !!state.sideOpen;
    side.classList.toggle('open', open);
    var head = el('div', { class: 'sidehead' }, [
      el('span', { text: 'チェックリスト' }),
      el('b', { text: t.filled + ' / ' + t.total + ' 入力済み' }),
      el('button', { type: 'button', class: 'close', 'aria-label': '閉じる', text: '閉じる', onclick: toggleSheet })
    ]);
    var meter = el('div', { class: 'progress' }, [el('i', { style: 'width:' + Math.round(t.filled / t.total * 100) + '%' })]);
    side.appendChild(el('div', { class: 'sidein' }, [head, meter,
      el('div', { class: 'list' }, groups.concat([el('p', { class: 'sub legend', text: '✓ 入力済み　? 分からない（AIが聞き返します）　項目をタップするとそこへ移動します' })]))]));
  }

  function toggleSheet() {
    state.sideOpen = !state.sideOpen;
    save();
    renderChecklist();
  }

  // 画面上部に固定する進み具合。キーボードや指で隠れない位置に置く。タップでチェックリストを開く
  var justDone = null;
  function renderProgress(t) {
    var p = document.getElementById('top');
    if (!p) return;
    if (state.step < 0 || state.step >= STEPS.length) { p.hidden = true; return; }
    p.hidden = false;
    p.innerHTML = '';
    var gained = lastFilled !== null && t.filled > lastFilled ? t.filled - lastFilled : 0;
    lastFilled = t.filled;
    var segs = STEPS.map(function (s, si) {
      var q = t.per[si];
      var cls = 'seg' + (si === state.step ? ' cur' : '') + (q.filled === q.total ? ' full' : '');
      return el('span', { class: cls, title: s.title }, [el('i', { style: 'width:' + Math.round(q.filled / q.total * 100) + '%' })]);
    });
    p.appendChild(el('button', { type: 'button', class: 'topbtn', 'aria-expanded': String(!!state.sideOpen), onclick: toggleSheet }, [
      el('span', { class: 'segs', 'aria-hidden': 'true' }, segs),
      el('span', { class: 'toprow' }, [
        el('span', { class: 'count' + (gained ? ' bump' : '') }, [el('b', { text: String(t.filled) }), document.createTextNode(' / ' + t.total + ' 入力済み')]),
        gained ? el('span', { class: 'plus', 'aria-hidden': 'true', text: '+' + gained }) : null,
        el('span', { class: 'left', text: t.reqLeft ? '必須あと' + t.reqLeft : '必須はそろいました' }),
        el('span', { class: 'open', text: '一覧 ▾' })
      ])
    ]));
  }

  function jumpTo(si, id) {
    state.sideOpen = false;
    save();
    if (state.step !== si) go(si); else renderChecklist();
    var box = document.getElementById('f-' + id);
    if (!box) return;
    box.scrollIntoView({ block: 'center' });
    var input = document.getElementById('in-' + id);
    if (input && !input.disabled) input.focus({ preventScroll: true });
    box.classList.add('flash');
    setTimeout(function () { box.classList.remove('flash'); }, 1200);
  }

  // ---- 物件ページの文章から読み込む ----

  var IMPORT_LABEL = { price: ['物件価格', '万円'], area: ['専有面積', '㎡'], builtYear: ['建築年', '年'],
    mgmtFee: ['管理費', '円'], repairFee: ['修繕積立金', '円'], scale: ['建物の規模', ''] };

  function isImported(id) {
    var v = state.importedVals;
    return !!v && v[id] !== undefined && String(state.answers[id]) === String(v[id]) && !state.unknown[id];
  }

  // onIntro：最初の画面の「検討中の物件」の行の下に出す。読み込んだ結果はその場（行のすぐ下）に出す
  function renderImport(onIntro) {
    var ta = el('textarea', { id: 'importText', placeholder: '例：\n価格　5980万円\n専有面積　70.12m2（壁芯）\n完成時期（築年月）　1998年3月\n管理費　1万2000円／月\n修繕積立金　1万5600円／月' });
    var msg = el('div', { class: 'hint', id: 'importMsg', role: 'status' });
    var det = el('details', { class: 'card import' + (onIntro ? ' intro' : '') }, [
      el('summary', { text: onIntro ? '物件ページを貼ってまとめて入力（任意）' : '物件ページの文章から読み込む（任意）' }),
      el('p', { class: 'sub', text: 'SUUMO などの物件ページの「物件概要」の部分をコピーして、下に貼り付けてください。価格・専有面積・築年・管理費・修繕積立金を読み取って入力します。' }),
      el('p', { class: 'sub', text: 'URL だけでは読み込めません（このシートは物件サイトに接続しないため）。コピーは、物件概要の文字を長押し →「すべてを選択」または範囲を広げて「コピー」。' }),
      ta,
      el('div', { class: 'row', style: 'margin-top:8px' }, [
        el('button', { type: 'button', class: 'btn', text: '読み込む', onclick: function () { ta.blur(); doImport(ta.value, onIntro); } })
      ]),
      msg
    ]);
    var key = onIntro ? 'importOpenIntro' : 'importOpen';
    if (state[key]) det.open = true;
    det.addEventListener('toggle', function () { state[key] = det.open; save(); });
    return det;
  }

  function importedParts(keys) {
    return keys.map(function (k) {
      var L = IMPORT_LABEL[k], v = state.answers[k];
      if (k === 'scale') return L[0] + '：20階以上';
      return L[0] + ' ' + (k === 'builtYear' ? String(v) : Number(v).toLocaleString('ja-JP')) + L[1];
    });
  }

  function importedNoteText() {
    var still = Object.keys(IMPORT_LABEL).filter(isImported);
    return still.length ? '物件ページから読み込んだ値：' + importedParts(still).join('、') + '。違っていたら直してください。' : '';
  }
  function refreshImported() {
    var note = document.getElementById('importedNote');
    if (note) { note.textContent = importedNoteText(); note.hidden = !note.textContent; }
    Object.keys(IMPORT_LABEL).forEach(function (k) {
      var q = document.querySelector('#f-' + k + ' label.q');
      if (!q) return;
      var tag = q.querySelector('.tag.imp');
      if (isImported(k) && !tag) q.insertBefore(el('span', { class: 'tag imp', text: '物件ページから' }), q.querySelector('.tag:not(.imp)'));
      else if (!isImported(k) && tag) tag.remove();
    });
  }

  var introImport = null; // 最初の画面で読み込んだ直後に、行の下に出す結果
  function doImport(text, onIntro) {
    var r = Parse.parseListing(text);
    var keys = Object.keys(r);
    if (!keys.length) {
      setImportMsg('読み取れる項目が見つかりませんでした。「価格」「専有面積」などの見出しを含めてコピーしてください。');
      return;
    }
    state.importedVals = state.importedVals || {};
    keys.forEach(function (k) {
      state.answers[k] = String(r[k]);
      state.unknown[k] = false;
      state.importedVals[k] = String(r[k]);
    });
    state.imported = keys;
    state.importOpen = false;
    state.importOpenIntro = false;
    save();
    if (onIntro) {
      var missed = ['price', 'area', 'builtYear', 'mgmtFee', 'repairFee'].filter(function (k) { return keys.indexOf(k) < 0; });
      introImport = { keys: keys, missed: missed };
      app.innerHTML = '';
      renderIntro();
      var res = document.getElementById('introImportMsg');
      if (res) res.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    renderStep(state.step, true);
    keys.forEach(function (k) { var b = document.getElementById('f-' + k); if (b) b.classList.add('flash'); });
    toast(keys.length + '項目を読み込みました');
    var first = document.getElementById('f-' + keys[0]);
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function setImportMsg(t) { var m = document.getElementById('importMsg'); if (m) m.textContent = t; }

  // ---- 画面 ----

  // 最初の画面で、これから聞く項目の全体像を見せる（入力済みなら ✓ が付いた状態で）
  // 最初の画面で全体像を見せる。項目を全部並べると多く見えるので、区分ごとの行にして中身は1行で示す
  function renderOverview() {
    var t = tally();
    var reqTotal = 0;
    STEPS.forEach(function (s) { s.fields.forEach(function (f) { if (f.required) reqTotal++; }); });
    var rows = [];
    STEPS.forEach(function (s, si) {
      var p = t.per[si];
      var st = p.filled === p.total ? 'done' : p.filled ? 'some' : 'todo';
      var row = el('button', { type: 'button', class: 'ovrow ' + st, onclick: function () { go(si); } }, [
        el('span', { class: 'box', 'aria-hidden': 'true', text: st === 'done' ? '✓' : '' }),
        el('span', { class: 'ovt' }, [
          el('b', { text: (si + 1) + '. ' + s.title }),
          el('span', { class: 'ovs', text: slots(si).map(function (f) { return SHORT[f.id]; }).join('・') })
        ]),
        el('span', { class: 'ovn', text: p.filled ? p.filled + ' / ' + p.total : p.total + '項目' })
      ]);
      rows.push(row);
      if (!s.importable) return;
      if (introImport) {
        row.classList.add('flash');
        var lines = [el('p', {}, [el('b', { text: introImport.keys.length + '項目を入力しました' }),
          document.createTextNode('：' + importedParts(introImport.keys).join('、') + '。違っていたら「' + (si + 1) + '. ' + s.title + '」で直してください。')])];
        if (introImport.missed.length) lines.push(el('p', { class: 'sub', text: '読み取れなかった項目：' + introImport.missed.map(function (k) { return IMPORT_LABEL[k][0]; }).join('・') + '（画面で入力するか「分からない」にできます）' }));
        lines.push(el('div', { class: 'row' }, [
          el('button', { type: 'button', class: 'link', text: '物件の画面で確かめる', onclick: function () { go(si); } }),
          el('button', { type: 'button', class: 'link', text: '別の文章を貼り直す', onclick: function () { state.importOpenIntro = true; save(); app.innerHTML = ''; renderIntro(); var t = document.getElementById('importText'); if (t) t.scrollIntoView({ block: 'center' }); } })
        ]));
        rows.push(el('div', { class: 'imported-now', id: 'introImportMsg', role: 'status' }, lines));
        introImport = null;
      } else {
        rows.push(renderImport(true));
      }
    });
    var lead = '全' + t.total + '項目。計算に必要なのは' + reqTotal + '項目だけで、ほかは「分からない」で進めます。';
    if (t.filled) lead += '今 ' + t.filled + '項目が入っています（返済期間35年は最初から入れてあります）。';
    return el('div', { class: 'card overview' }, [
      el('h2', { text: 'これから聞くこと' }),
      el('p', { class: 'sub', text: lead })
    ].concat(rows).concat([
      el('p', { class: 'sub', style: 'margin:10px 0 0', text: '手元にあると早いもの：源泉徴収票、物件ページ（SUUMOなど。上の「物件ページを貼ってまとめて入力」から物件の数字がまとめて入ります）、銀行の事前審査や見積もり。' })
    ]));
  }

  function renderIntro() {
    app.appendChild(el('h1', { text: 'マンション購入 AI相談シート' }));
    app.appendChild(el('p', { class: 'sub', text: 'v0.3.2（試作版）' }));
    app.appendChild(el('p', { text: '5分ほどの質問に答えると、住宅ローンの返済額や負担率を計算し、ChatGPT や Claude にそのまま渡せる「相談用の文章」を作ります。' }));
    app.appendChild(renderOverview());
    app.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: '流れ' }),
      el('ol', { class: 'steps' }, [
        el('li', { text: '上の5つの区分に答える（チェックが埋まっていきます）' }),
        el('li', { text: '計算結果を確認' }),
        el('li', { text: '相談用の文章をコピーして、いつものAIに貼る' })
      ])
    ]));
    app.appendChild(el('div', { class: 'note', text: '入力した内容は、この端末のブラウザの中にだけ保存されます。どこにも送信しません。' }));
    app.appendChild(el('p', { class: 'sub', text: 'このシートは計算と一般的な目安との比較をするもので、購入の可否や金融商品の選択を助言するものではありません。' }));
    var started = state.lastStep !== undefined;
    bar([el('button', { class: 'btn primary', text: started ? '続きから' : 'はじめる', onclick: function () { go(started && state.lastStep !== undefined ? state.lastStep : 0); } })]);
    if (started) app.appendChild(el('button', { class: 'link', text: '入力内容を消して最初から', onclick: confirmClear }));
  }

  function confirmClear() {
    // ブラウザのダイアログは使わず、2回押しで確定する
    var b = this;
    if (b.dataset.armed) { clearAll(); toast('入力内容を消しました'); return; }
    b.dataset.armed = '1';
    b.textContent = 'もう一度押すと消えます';
    setTimeout(function () { if (b.isConnected) { delete b.dataset.armed; b.textContent = '入力内容を消して最初から'; } }, 4000);
  }

  function renderField(f) {
    var a = state.answers;
    var wrap = el('div', { class: 'field', id: 'f-' + f.id });
    var inputId = 'in-' + f.id;
    var st0 = fieldStatus(f);
    wrap.appendChild(el('label', { class: 'q', for: inputId }, [
      el('span', { class: 'qbox ' + st0, id: 'qb-' + f.id, 'aria-hidden': 'true', text: st0 === 'done' ? '✓' : st0 === 'unknown' ? '?' : '' }),
      el('span', { text: f.label }),
      isImported(f.id) ? el('span', { class: 'tag imp', text: '物件ページから' }) : null,
      el('span', { class: 'tag' + (f.required ? ' need' : ''), text: f.required ? '必須' : f.type === 'chips' || f.type === 'textarea' ? '任意' : '任意・分からなくても進めます' })
    ]));
    if (f.hint) wrap.appendChild(el('div', { class: 'hint', text: f.hint }));
    if (f.where) wrap.appendChild(el('details', { class: 'where' }, [el('summary', { text: 'どこに書いてある？' })]
      .concat(f.where.map(function (t) { return el('p', { text: t }); }))));

    if (f.type === 'chips') {
      var chips = el('div', { class: 'chips', role: 'group', 'aria-label': f.label });
      f.options.forEach(function (o) {
        var c = el('button', { type: 'button', class: 'chip', 'aria-pressed': String(a[f.id] === o[0]), text: o[1] });
        c.addEventListener('click', function () {
          var first = a[f.id] === undefined || a[f.id] === '';
          a[f.id] = o[0];
          save();
          renderStep(state.step, true);
          var b = document.getElementById('qb-' + f.id);
          if (b && first) {
            b.classList.add('pop');
            var plus = el('span', { class: 'fplus', 'aria-hidden': 'true', text: '+1' });
            b.parentNode.insertBefore(plus, b.nextSibling);
            setTimeout(function () { plus.remove(); }, 1000);
          }
        });
        chips.appendChild(c);
      });
      wrap.appendChild(chips);
      return wrap;
    }

    if (f.type === 'textarea') {
      var ta = el('textarea', { id: inputId, placeholder: f.placeholder || '' });
      ta.value = a[f.id] || '';
      ta.addEventListener('input', function () { a[f.id] = ta.value; save(); renderChecklist(); });
      ta.addEventListener('blur', function () { markField(f, !!ta.value.trim()); });
      wrap.appendChild(ta);
      return wrap;
    }

    var input = el('input', { id: inputId, type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: f.placeholder || '' });
    input.value = a[f.id] !== undefined ? a[f.id] : '';
    if (state.unknown[f.id]) input.disabled = true;
    input.addEventListener('input', function () {
      a[f.id] = normalizeNum(input.value);
      save();
      var e = document.getElementById('err-' + f.id);
      if (e) e.remove();
      if (f.id === 'ownFunds' || f.id === 'price' || f.id === 'renoCost') updateSuggest();
    });
    input.addEventListener('blur', function () {
      input.value = a[f.id] !== undefined ? a[f.id] : '';
      var v = a[f.id];
      markField(f, v !== undefined && v !== '' && isFinite(Number(v)) && Number(v) >= 0);
      refreshImported();
    });
    wrap.appendChild(el('div', { class: 'row' }, [input, el('span', { class: 'unit', text: f.unit || '' })]));

    if (f.suggest) {
      wrap.appendChild(el('div', { class: 'hint', id: 'suggest' }));
    }
    if (f.unknown) {
      var cb = el('input', { type: 'checkbox', id: 'unk-' + f.id });
      cb.checked = !!state.unknown[f.id];
      cb.addEventListener('change', function () {
        state.unknown[f.id] = cb.checked;
        input.disabled = cb.checked;
        save();
        refreshImported();
        markField(f, true);
        renderChecklist();
      });
      wrap.appendChild(el('label', { class: 'unknown', for: 'unk-' + f.id }, [cb, el('span', { text: '分からない' })]));
    }
    return wrap;
  }

  function updateSuggest() {
    var box = document.getElementById('suggest');
    if (!box) return;
    var s = suggestLoan();
    box.innerHTML = '';
    if (s === null) return;
    box.appendChild(document.createTextNode('目安：物件＋リノベ＋諸費用（物件の約8.5%）−自己資金 ＝ ' + s.toLocaleString('ja-JP') + '万円 '));
    box.appendChild(el('button', { type: 'button', class: 'link', text: 'この額を入れる', onclick: function () {
      state.answers.loan = String(s);
      save();
      renderChecklist();
      document.getElementById('in-loan').value = s;
    } }));
  }

  function renderStep(i, keepScroll) {
    var y = window.scrollY;
    app.innerHTML = '';
    var s = STEPS[i];
    var a = state.answers;
    if (justDone) {
      app.appendChild(el('div', { class: 'donebanner', role: 'status' }, [
        el('span', { class: 'qbox done pop', 'aria-hidden': 'true', text: '✓' }),
        el('span', { text: justDone.title + '：' + justDone.total + '項目中 ' + justDone.filled + '項目を記入しました' })
      ]));
      justDone = null;
    }
    app.appendChild(el('p', { class: 'sub', text: '画面 ' + (i + 1) + ' / ' + STEPS.length }));
    app.appendChild(el('h2', { text: s.title }));
    app.appendChild(el('p', { class: 'sub', text: s.lead }));
    if (s.importable) {
      app.appendChild(renderImport());
      if (state.importedVals) {
        var note = el('div', { class: 'hint', id: 'importedNote', text: importedNoteText() });
        note.hidden = !note.textContent;
        app.appendChild(note);
      }
    }
    var card = el('div', { class: 'card' });
    s.fields.forEach(function (f) {
      if (f.when && !f.when(a)) return;
      card.appendChild(renderField(f));
    });
    app.appendChild(card);
    updateSuggest();
    renderChecklist();
    bar([
      el('button', { class: 'btn', text: '戻る', onclick: function () { go(i - 1); } }),
      el('button', { class: 'btn primary', text: i === STEPS.length - 1 ? '結果を見る' : '次へ', onclick: function () { next(i); } })
    ]);
    if (keepScroll) window.scrollTo(0, y);
  }

  function next(i) {
    var a = state.answers;
    var firstErr = null;
    STEPS[i].fields.forEach(function (f) {
      if (f.when && !f.when(a)) return;
      if (f.type !== 'number') return;
      var v = a[f.id];
      var bad = null;
      if (state.unknown[f.id]) return;
      if (v === undefined || v === '') { if (f.required) bad = '計算に必要です。入力してください'; }
      else if (!isFinite(Number(v)) || Number(v) < 0) bad = '0以上の数字で入力してください';
      else if (f.id === 'years' && (Number(v) < 1 || Number(v) > 50)) bad = '1〜50年で入力してください';
      else if (f.id === 'rate' && Number(v) > 20) bad = '%で入力してください（例：0.8）';
      if (bad) {
        var box = document.getElementById('f-' + f.id);
        if (box && !document.getElementById('err-' + f.id)) box.appendChild(el('div', { class: 'err', id: 'err-' + f.id, text: bad }));
        if (!firstErr) firstErr = box;
      }
    });
    if (firstErr) { firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    var p = tally().per[i];
    justDone = { title: STEPS[i].title, filled: p.filled, total: p.total, si: i };
    go(i + 1);
  }

  function go(i) {
    state.step = i;
    if (i >= 0 && i < STEPS.length) state.lastStep = i;
    save();
    render();
    window.scrollTo(0, 0);
  }

  function row(label, value) {
    return el('tr', {}, [el('td', { text: label }), el('td', { class: 'n', text: value })]);
  }

  function renderResult() {
    var a = answers();
    for (var si = 0; si < STEPS.length; si++) {
      var missing = STEPS[si].fields.some(function (f) { return f.required && (a[f.id] === undefined || a[f.id] === ''); });
      if (missing) { go(si); return; }
    }
    var r = Calc.analyze(a);
    var today = new Date();
    var ds = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    var text = Calc.buildAiText(a, r, ds);
    var Y = Calc.yen, YE = Calc.yenExact, P = Calc.pct;

    app.appendChild(el('h2', { text: '計算結果' }));
    app.appendChild(el('p', { class: 'sub', text: '元利均等返済で計算しています。' }));

    app.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'kpi' }, [
        el('div', {}, [el('span', { text: '毎月の返済額' }), el('b', { text: YE(r.monthly) })]),
        el('div', {}, [el('span', { text: '管理費・修繕積立金込み' }), el('b', { text: YE(r.housingMonthly) })]),
        el('div', {}, [el('span', { text: '手取り年収に対する返済' }), el('b', { text: P(r.burdenNet) })]),
        el('div', {}, [el('span', { text: '完済時の年齢' }), el('b', { text: r.payoffAge + '歳' })])
      ])
    ]));

    var t1 = el('table', {}, [
      row('総返済額', Y(r.total)),
      row('うち利息', Y(r.interest)),
      row('額面年収に対する返済', P(r.burdenGross)),
      row('同・他の借入込み', P(r.burdenGrossAll)),
      row(r.retireAge + '歳時点の残高', r.retireBalance === null ? '―' : Y(r.retireBalance)),
      row('諸費用の目安（物件の7〜10%）', Y(r.closingLo) + '〜' + Y(r.closingHi)),
      row('資金の過不足（概算）', Y(r.fundingGap))
    ]);
    if (r.cashLeft !== undefined) t1.appendChild(row('自己資金を出した後に残るお金', Y(r.cashLeft)));
    if (r.emergency) t1.appendChild(row('生活費6か月分', Y(r.emergency)));
    app.appendChild(el('div', { class: 'card' }, [el('h2', { text: '数字のまとめ' }), t1]));

    var t2 = el('table', {}, [el('tr', {}, [el('th', { text: '金利' }), el('th', { text: '毎月' }), el('th', { text: '手取りに対して' })])]);
    t2.appendChild(el('tr', {}, [el('td', { text: '今（' + a.rate + '%）' }), el('td', { class: 'n', text: YE(r.monthly) }), el('td', { class: 'n', text: P(r.burdenNet) })]));
    r.scenarios.forEach(function (s) {
      t2.appendChild(el('tr', {}, [el('td', { text: '+' + s.delta + '%' }), el('td', { class: 'n', text: YE(s.monthly) }), el('td', { class: 'n', text: P(s.burdenNet) })]));
    });
    app.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: '金利が上がったら' }), t2,
      el('p', { class: 'sub', text: '参考の試算（判定ではありません）：手取りの25%（よく使われる目安）以内に、今の金利+2%でも収まる借入額は ' + Y(r.refLoan) + '。' })
    ]));

    if (r.repairUnit) {
      var g = r.repairGuide;
      var msg = '今の月額は㎡あたり ' + Math.round(r.repairUnit) + '円。';
      if (g) msg += '国交省ガイドライン（' + g.label + '）の目安は、平均' + g.avg + '円、事例の3分の2が' + g.lo + '〜' + g.hi + '円です。';
      else msg += '建物の規模が分かると、国のガイドラインの目安を表示します。';
      app.appendChild(el('div', { class: 'card' }, [el('h2', { text: '修繕積立金' }), el('p', { text: msg }),
        el('p', { class: 'sub', text: 'ガイドラインの目安は、長期修繕計画の期間全体で見た平均額です。今後値上げする計画（段階増額積立方式）なら、今の月額は低く出ます。機械式駐車場がある場合は目安が上がります。幅に入っていないからといって、直ちに不適切とは限りません（ガイドラインより）。長期修繕計画と積立方式を確認してください。' })]));
    }

    var extras = r.notes.concat(r.assumptions.map(function (x) { return '仮定：' + x; }));
    if (extras.length) {
      app.appendChild(el('div', { class: 'card' }, [el('h2', { text: '確認したほうがよさそうな点' })].concat(
        extras.map(function (n) { return el('div', { class: 'note', text: n }); }))));
    }

    var pre = el('pre', { class: 'ai', text: text });
    app.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'AIに相談する' }),
      el('ol', { class: 'steps' }, [
        el('li', { text: '下の「相談用の文章をコピー」を押す' }),
        el('li', { text: 'ChatGPT や Claude を開いて、新しい会話に貼り付けて送る' }),
        el('li', { text: '続けて質問すれば、あなたの条件をふまえて答えてくれます' })
      ]),
      pre,
      el('div', { class: 'note', text: '貼り付けると、年収や借入額などの内容は貼り付け先のAIサービスに送られます。気になる場合は、数字を丸めるか、各サービスの設定（会話を学習に使うかどうか等）を確認してから使ってください。' }),
      el('div', { class: 'apps' }, [
        el('a', { href: 'https://chatgpt.com/', target: '_blank', rel: 'noopener', text: 'ChatGPT を開く' }),
        el('a', { href: 'https://claude.ai/new', target: '_blank', rel: 'noopener', text: 'Claude を開く' })
      ]),
      el('p', { class: 'sub', style: 'margin-top:10px', text: 'ヒント：ChatGPT や Claude の「プロジェクト」の指示欄に貼っておくと、次からは説明しなくても前提をふまえて答えてくれます。' })
    ]));

    app.appendChild(el('footer', {}, [
      el('p', {}, [document.createTextNode('出典：修繕積立金の目安は国土交通省「'),
        el('a', { href: 'https://www.mlit.go.jp/jutakukentiku/house/content/001747009.pdf', target: '_blank', rel: 'noopener', text: 'マンションの修繕積立金に関するガイドライン' }),
        document.createTextNode('」（令和6年6月改定）。返済負担率25%、生活費6か月分、諸費用7〜10%は一般によく使われる目安で、公的な基準ではありません。')]),
      el('p', { text: '計算の前提：元利均等返済、借入期間中の金利は一定（金利上昇の試算を除く）、ボーナス払いなし。実際の返済額・審査・金利・税制は金融機関や制度によって異なります。' }),
      el('p', { text: 'このシートは入力された数字にもとづく試算と一般的な情報の提供で、購入や借入の可否の判断、金融機関・商品の推奨、税務の個別相談を行うものではありません。最終的な判断は、金融機関や専門家にも確認してください。' }),
      el('p', { text: '内容の更新日：2026年10月20日' }),
      el('button', { class: 'link', text: '入力内容を消して最初から', onclick: confirmClear })
    ]));

    bar([
      el('button', { class: 'btn', text: '修正', onclick: function () { go(0); } }),
      el('button', { class: 'btn primary', text: '相談用の文章をコピー', onclick: function () { copy(text, pre); } })
    ]);
  }

  function copy(text, pre) {
    function fallback() {
      var range = document.createRange();
      range.selectNodeContents(pre);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      var done = false;
      try { done = document.execCommand('copy'); } catch (e) { /* 無視 */ }
      toast(done ? 'コピーしました' : '文章を選択しました。長押しでコピーしてください');
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { toast('コピーしました'); }, fallback);
    } else {
      fallback();
    }
  }

  function render() {
    app.innerHTML = '';
    renderChecklist();
    if (state.step < 0) renderIntro();
    else if (state.step < STEPS.length) renderStep(state.step);
    else renderResult();
  }

  render();
})();
