// マンション購入 AI相談シート v0.6 — 画面
// 回答はこの端末のブラウザ（localStorage）にだけ保存する。外に出るのは、結果の画面で本人がAIのボタンを押すか相談文をコピーして貼ったときだけ。
// v0.4：最初の8問（第1段）→ 目安の画面 → くわしく入れる（第2段・任意）→ 気になること → 結果、の2段構え
(function () {
  'use strict';

  var STORE_KEY = 'mansion-sheet-v0.1';
  var VERSION = 4;

  // stage 1：最初の8問（目安の計算に使う）／2：くわしく入れる（任意）／3：最後の自由記述
  // count:false の項目（自動で入る借入額・返済期間）は数えない
  var STEPS = [
    {
      stage: 1,
      title: 'あなたの世帯と収入',
      lead: '最初は選ぶだけの質問です。答えが必要なのは、年齢・年収・物件価格・金利の4つです（金利は「分からない」でも進めます）。',
      fields: [
        { id: 'spouse', label: '配偶者・パートナー', type: 'chips', options: [['none', 'なし'], ['yes', 'あり']] },
        { id: 'kids', label: '子どもの人数', type: 'chips', options: [['0', '0人'], ['1', '1人'], ['2', '2人'], ['3', '3人以上']] },
        { id: 'age', label: 'あなたの年齢', type: 'number', unit: '歳', required: true, hint: '完済するときの年齢の計算に使います' },
        { id: 'grossIncome', label: '世帯の年収（額面・税込）', type: 'number', unit: '万円', required: true, hint: '返済の負担率の計算に使います。共働きなら2人の合計。源泉徴収票の「支払金額」' },
        { id: 'otherDebtHas', label: '住宅以外の借入', type: 'chips', hint: '返済の負担率に含めます。車のローン・奨学金など。「ある」を選ぶと、毎月の返済額を1問だけ聞きます',
          options: [['none', 'ない'], ['yes', 'ある']] },
        { id: 'otherDebtMonthly', label: '住宅以外の借入の毎月の返済額（合計）', type: 'number', unit: '円', parent: 'otherDebtHas', when: function (a) { return a.otherDebtHas === 'yes'; } }
      ]
    },
    {
      stage: 1,
      title: '検討中の物件',
      lead: '販売図面や物件ページに書いてあります。',
      fields: [
        { id: 'price', label: '物件価格', type: 'number', unit: '万円', required: true }
      ]
    },
    {
      stage: 1,
      title: 'お金の計画',
      lead: '借入額と返済期間は、シートが入れてあります。銀行の見積もりなどがあれば、その数字に直してください。',
      fields: [
        { id: 'ownFunds', label: '自己資金として出す額', type: 'number', unit: '万円', hint: '借入額の目安の計算に使います。頭金と諸費用のうち、現金で払う額。空欄なら0円で計算します' },
        { id: 'loan', label: '借入額', type: 'number', unit: '万円', required: true, suggest: true, count: false },
        { id: 'years', label: '返済期間', type: 'number', unit: '年', required: true, count: false, hint: '35年を最初から入れてあります。違えば直してください' },
        { id: 'rate', label: '金利', type: 'number', unit: '%', required: true, step: '0.001', unknown: true,
          unknownLabel: '分からない（例の金利3通りで計算します）', hint: '見積もりや銀行サイトに書かれた、今検討している金利' }
      ]
    },
    {
      stage: 2,
      title: '今の家計',
      lead: 'ざっくりで構いません。',
      gain: '自己資金を出した後に残るお金と、生活費6か月分を計算します。',
      fields: [
        { id: 'living', label: '毎月の生活費（住居費を除く）', type: 'number', unit: '万円', unknown: true, hint: '食費・光熱費・通信・保険・教育など' },
        { id: 'assets', label: '預貯金と投資の合計', type: 'number', unit: '万円', unknown: true }
      ]
    },
    {
      stage: 2,
      title: '物件の詳細',
      lead: '販売図面や物件ページの「物件概要」に書いてあります。',
      gain: '管理費・修繕積立金を含めた月の住居費と、修繕積立金の㎡単価を出します。',
      fields: [
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
        { id: 'renoHas', label: 'リノベーション', type: 'chips', hint: '「する」を選ぶと、費用を1問だけ聞きます。費用は借入額の目安に入ります',
          options: [['none', 'しない'], ['yes', 'する']] },
        { id: 'renoCost', label: 'リノベーション費用', type: 'number', unit: '万円', hint: '見積もり前なら想定額', parent: 'renoHas', when: function (a) { return a.renoHas === 'yes'; } }
      ]
    },
    {
      stage: 2,
      title: '収入・家族・ローンの詳細',
      lead: '分からないものは「分からない」「未定」で大丈夫です。',
      gain: '手取りに対する負担率と退職時のローン残高を、仮定ではなくあなたの数字で計算します。',
      fields: [
        { id: 'netIncome', label: '世帯の手取り年収', type: 'number', unit: '万円', unknown: true, hint: 'ボーナス込みで1年に口座へ入る額。分からなければ額面の75%と仮定します' },
        { id: 'retirePick', label: '退職する予定の年齢', type: 'chips', hint: '未定なら65歳と仮定します',
          options: [['60', '60歳'], ['65', '65歳'], ['70', '70歳'], ['other', 'その他'], ['undecided', '未定']] },
        { id: 'retireAge', label: '退職する予定の年齢（その他）', type: 'number', unit: '歳', parent: 'retirePick', when: function (a) { return a.retirePick === 'other'; } },
        { id: 'spouseAge', label: '配偶者・パートナーの年齢', type: 'number', unit: '歳', parent: 'spouse', when: function (a) { return a.spouse === 'yes'; } },
        { id: 'youngestAge', label: '末っ子の年齢', type: 'number', unit: '歳', hint: '生まれる予定なら 0', parent: 'kids', when: function (a) { return Number(a.kids) > 0; } },
        { id: 'rateType', label: '金利のタイプ', type: 'chips', options: [['variable', '変動'], ['fixedTerm', '固定期間選択'], ['fixed', '全期間固定'], ['mixed', 'ミックス'], ['undecided', '未定']] }
      ]
    },
    {
      stage: 3,
      title: 'いちばん気になっていること',
      lead: 'AIが最初に答える質問になります。空欄でも大丈夫です。',
      fields: [
        { id: 'worry', label: '気になっていること・迷っていること', type: 'textarea',
          placeholder: '例：金利が上がったら払えるか不安／繰上返済と投資のどちらを優先すべきか' }
      ]
    }
  ];
  var FIRST_DETAIL = 3;           // くわしく入れるの最初の画面
  var WORRY = STEPS.length - 1;   // 気になること
  var CARD = 'card';              // 最初の8問の後の、目安の画面

  // チェックリストに出す短い名前
  var SHORT = {
    age: '年齢', spouse: '配偶者', spouseAge: '配偶者の年齢', kids: '子ども', youngestAge: '末っ子の年齢',
    grossIncome: '額面年収', netIncome: '手取り年収', otherDebtHas: '他の借入', otherDebtMonthly: '他の借入の額', retirePick: '退職年齢', retireAge: '退職年齢',
    living: '生活費', assets: '預貯金・投資', price: '物件価格', area: '専有面積', builtYear: '建築年',
    scale: '建物の規模', mgmtFee: '管理費', repairFee: '修繕積立金', renoHas: 'リノベ', renoCost: 'リノベ費用',
    ownFunds: '自己資金', loan: '借入額', years: '返済期間', rate: '金利', rateType: '金利タイプ', worry: '気になること'
  };

  var TESTER_URL = /[?&]tester=1(&|$)/.test(location.search);
  var state = load();
  if (TESTER_URL) state.testerOn = true;
  var app = document.getElementById('app');
  var barIn = document.getElementById('barIn');
  var side = document.getElementById('side');

  function fresh() {
    return { v: VERSION, step: -1, answers: { years: '35' }, unknown: {}, loanManual: false };
  }

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && s.answers) {
        var a = s.answers;
        // v0.3.2 までの「年間返済額（万円）」を、毎月の額（円）に移す
        if (a.otherDebt !== undefined && a.otherDebtMonthly === undefined) {
          var od = Number(a.otherDebt);
          if (a.otherDebt !== '' && isFinite(od)) a.otherDebtMonthly = String(Math.round(od * 10000 / 12));
          delete a.otherDebt;
        }
        // 借入額を自分で入れていた人は、自動入力で上書きしない。v0.3.3 までは自動のときも印を保存していなかったので、
        // 目安の式と同じ額なら自動とみなす
        if (s.loanManual === undefined) s.loanManual = a.loan !== undefined && a.loan !== '' && String(a.loan) !== String(loanFormula(a));
        if (s.v !== VERSION) migrate(s);
        return s;
      }
    } catch (e) { /* 保存できない環境でも動かす */ }
    return fresh();
  }

  // v0.3.3 までの保存データを、v0.4 の選択式の項目と画面の並びに合わせる
  function migrate(s) {
    var a = s.answers, u = s.unknown || (s.unknown = {});
    function has(k) { return a[k] !== undefined && String(a[k]).trim() !== ''; }
    if (a.otherDebtHas === undefined && has('otherDebtMonthly')) a.otherDebtHas = Number(a.otherDebtMonthly) > 0 ? 'yes' : 'none';
    if (a.renoHas === undefined && has('renoCost')) a.renoHas = Number(a.renoCost) > 0 ? 'yes' : 'none';
    if (a.retirePick === undefined) {
      if (u.retireAge) { a.retirePick = 'undecided'; delete u.retireAge; }
      else if (has('retireAge')) a.retirePick = ['60', '65', '70'].indexOf(String(Number(a.retireAge))) >= 0 ? String(Number(a.retireAge)) : 'other';
    }
    if (s.yearsTouched === undefined) s.yearsTouched = has('years') && String(a.years) !== '35';
    var started = Object.keys(a).some(function (k) { return k !== 'years' && has(k); });
    s.step = -1;
    if (started) s.lastStep = 0; else delete s.lastStep;
    s.v = VERSION;
  }

  // 借入額は、自分で直すまで目安の額を自動で入れる
  function autoLoan() {
    if (state.loanManual) return;
    var s = suggestLoan();
    if (s !== null) state.answers.loan = String(s);
  }
  function save() {
    autoLoan();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 無視 */ }
  }
  function clearAll() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* 無視 */ }
    var tester = state.testerOn, seen = state.prologueSeen;
    state = fresh();
    if (tester) state.testerOn = true;
    if (seen) state.prologueSeen = true;
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

  function findField(id) {
    for (var i = 0; i < STEPS.length; i++) {
      for (var j = 0; j < STEPS[i].fields.length; j++) if (STEPS[i].fields[j].id === id) return STEPS[i].fields[j];
    }
    return null;
  }

  // 欄の横の ✓ は、件数と同じ数え方にする（同じ画面の条件付きの欄が空なら、親にも ✓ を付けない）
  function stepOf(f) {
    for (var i = 0; i < STEPS.length; i++) if (STEPS[i].fields.indexOf(f) >= 0) return i;
    return -1;
  }
  function boxStatus(f) {
    var si = stepOf(f);
    return si >= 0 && !f.when && f.count !== false ? slotStatus(f, si) : fieldStatus(f);
  }
  // 条件付きの欄を埋めたら、親の ✓ も付け直す（+1 は子の欄の横に1回だけ出す）
  function refreshParentBox(f) {
    if (!f.parent) return;
    var pf = findField(f.parent), b = document.getElementById('qb-' + f.parent);
    if (!pf || !b) return;
    var st = boxStatus(pf);
    b.className = 'qbox ' + st;
    b.textContent = st === 'done' ? '✓' : st === 'unknown' ? '?' : '';
  }

  // 入力欄のその場で ✓ を付ける（入力欄を離れたときに値が正しければ）
  function markField(f, ok) {
    var b = document.getElementById('qb-' + f.id);
    var st = ok ? boxStatus(f) : 'todo';
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
    refreshParentBox(f);
    renderChecklist();
  }

  function bar(buttons) {
    barIn.innerHTML = '';
    buttons.forEach(function (b) { barIn.appendChild(b); });
  }

  // 計算に渡す回答。「分からない」は空として扱い、選択式の項目を計算用の値に直す。自動・初期値の印も付ける
  function answers() {
    var a = {};
    Object.keys(state.answers).forEach(function (k) {
      a[k] = state.unknown[k] ? '' : state.answers[k];
    });
    if (a.kids === undefined) a.kids = '';
    if (a.retirePick === 'other') { /* 数字の欄の値をそのまま使う */ }
    else if (a.retirePick === 'undecided') a.retireAge = '';
    else if (a.retirePick) a.retireAge = a.retirePick;
    a.loanAuto = !state.loanManual;
    a.yearsDefault = !state.yearsTouched && String(a.years) === '35';
    a.rateUnknown = !!state.unknown.rate;
    return a;
  }

  // 全角数字・カンマ・全角ピリオドを半角の数字に直す（スマホの日本語入力対策）
  function normalizeNum(v) {
    return String(v)
      .replace(/[０-９．]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[,，、\s]/g, '');
  }

  function suggestLoan() { return loanFormula(state.answers); }
  function loanFormula(a) {
    var price = Number(a.price), reno = a.renoHas === 'none' ? 0 : Number(a.renoCost) || 0, own = Number(a.ownFunds) || 0;
    if (!price) return null;
    return Math.max(0, Math.round(price + reno + price * 0.085 - own));
  }

  // ---- チェックリスト（答えると埋まっていく） ----

  function fieldStatus(f) {
    if (state.unknown[f.id]) return 'unknown';
    var v = state.answers[f.id];
    return v !== undefined && String(v).trim() !== '' ? 'done' : 'todo';
  }

  // 数える単位。条件付きの項目（他の借入の額など）は親の項目に含め、選び方で分母が増えないようにする
  function slots(si) {
    return STEPS[si].fields.filter(function (f) { return !f.when && f.count !== false; });
  }
  // 同じ画面にある条件付きの項目だけを親に含める（配偶者の年齢などは、くわしく入れるの画面で任意に聞く）
  function children(f, si) {
    return STEPS[si].fields.filter(function (c) { return c.parent === f.id && c.when(state.answers); });
  }
  function slotStatus(f, si) {
    var st = fieldStatus(f);
    if (st === 'todo') return 'todo';
    var kidTodo = children(f, si).some(function (c) { return fieldStatus(c) === 'todo'; });
    return kidTodo ? 'todo' : st;
  }
  function tally() {
    var t = { total: 0, filled: 0, reqLeft: 0, per: [], stage: { 1: { total: 0, filled: 0 }, 2: { total: 0, filled: 0 }, 3: { total: 0, filled: 0 } } };
    STEPS.forEach(function (s, si) {
      var p = { total: 0, filled: 0 };
      var g = t.stage[s.stage];
      slots(si).forEach(function (f) {
        var st = slotStatus(f, si);
        p.total++; t.total++; g.total++;
        if (st !== 'todo') { p.filled++; t.filled++; g.filled++; }
        else if (f.required) t.reqLeft++;
      });
      t.per.push(p);
    });
    return t;
  }

  function isStep(i) { return typeof i === 'number' && i >= 0 && i < STEPS.length; }
  // 今いる段（目安の画面は、くわしく入れるの入口として2段目に数える）
  function curStage() {
    if (state.step === CARD) return 2;
    return isStep(state.step) ? STEPS[state.step].stage : 1;
  }

  var lastFilled = null;
  function renderChecklist() {
    var t = tally();
    renderProgress(t);
    if (!side) return;
    side.innerHTML = '';
    if (!isStep(state.step) && state.step !== CARD) { side.hidden = true; document.body.classList.remove('has-side'); return; }
    side.hidden = false;
    document.body.classList.add('has-side');
    var groups = [];
    STEPS.forEach(function (s, si) {
      if (si === 0) groups.push(el('div', { class: 'stagehead', text: '最初の8問　' + t.stage[1].filled + ' / ' + t.stage[1].total }));
      if (si === FIRST_DETAIL) groups.push(el('div', { class: 'stagehead', text: 'くわしく入れる（任意）　' + t.stage[2].filled + ' / ' + t.stage[2].total }));
      if (si === WORRY) groups.push(el('div', { class: 'stagehead', text: '最後に' }));
      var items = slots(si).map(function (f) {
        var st = slotStatus(f, si);
        var mark = st === 'done' ? '✓' : st === 'unknown' ? '?' : '';
        return el('li', {}, [el('button', { type: 'button', class: 'ck ' + st + (f.required ? ' req' : ''),
          onclick: function () { jumpTo(si, f.id); } }, [
          el('span', { class: 'box', 'aria-hidden': 'true', text: mark }),
          el('span', { text: SHORT[f.id] || f.label }),
          f.required && st === 'todo' ? el('span', { class: 'need', text: '必須' }) : null
        ])]);
      });
      groups.push(el('div', { class: 'grp' + (si === state.step ? ' cur' : '') }, [
        el('div', { class: 'gt', text: (si + 1) + '. ' + s.title + '　' + t.per[si].filled + ' / ' + t.per[si].total }),
        el('ul', {}, items)
      ]));
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
      el('div', { class: 'list' }, groups.concat([el('p', { class: 'sub legend', text: '✓ 入力済み　? 分からない（AIが聞き返します）　項目をタップするとそこへ移動します。借入額と返済期間は自動で入るので数えていません' })]))]));
  }

  function toggleSheet() {
    state.sideOpen = !state.sideOpen;
    save();
    renderChecklist();
  }

  // 画面上部に固定する進み具合。キーボードや指で隠れない位置に置く。タップでチェックリストを開く
  // 最初の8問と、くわしく入れる（任意）を分けて数える
  var justDone = null;
  function renderProgress(t) {
    var p = document.getElementById('top');
    if (!p) return;
    if (!isStep(state.step) && state.step !== CARD) { p.hidden = true; return; }
    p.hidden = false;
    p.innerHTML = '';
    var stage = curStage();
    var g = stage === 1 ? t.stage[1] : t.stage[2];
    var gained = lastFilled !== null && t.filled > lastFilled ? t.filled - lastFilled : 0;
    lastFilled = t.filled;
    var segs = STEPS.map(function (s, si) {
      var q = t.per[si];
      var cls = 'seg' + (si === state.step ? ' cur' : '') + (q.filled === q.total ? ' full' : '') + (si === FIRST_DETAIL ? ' gap' : '') + (s.stage > 1 ? ' opt' : '');
      return el('span', { class: cls, title: s.title }, [el('i', { style: 'width:' + Math.round(q.filled / q.total * 100) + '%' })]);
    });
    p.appendChild(el('button', { type: 'button', class: 'topbtn', 'aria-expanded': String(!!state.sideOpen), onclick: toggleSheet }, [
      el('span', { class: 'segs', 'aria-hidden': 'true' }, segs),
      el('span', { class: 'toprow' }, [
        el('span', { class: 'count' + (gained ? ' bump' : '') }, [
          document.createTextNode(stage === 1 ? '最初の8問 ' : 'くわしく（任意） '),
          el('b', { text: String(g.filled) }), document.createTextNode(' / ' + g.total)]),
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

  // ---- 物件ページから読み込んだ値の印（v0.6 で読み込みはやめた。古い保存データの印だけ扱う） ----

  var IMPORT_LABEL = { price: ['物件価格', '万円'], area: ['専有面積', '㎡'], builtYear: ['建築年', '年'],
    mgmtFee: ['管理費', '円'], repairFee: ['修繕積立金', '円'], scale: ['建物の規模', ''] };

  function isImported(id) {
    var v = state.importedVals;
    return !!v && v[id] !== undefined && String(state.answers[id]) === String(v[id]) && !state.unknown[id];
  }

  function refreshImported() {
    Object.keys(IMPORT_LABEL).forEach(function (k) {
      var q = document.querySelector('#f-' + k + ' label.q');
      if (!q) return;
      var tag = q.querySelector('.tag.imp');
      if (isImported(k) && !tag) q.insertBefore(el('span', { class: 'tag imp', text: '物件ページから' }), q.querySelector('.tag:not(.imp)'));
      else if (!isImported(k) && tag) tag.remove();
    });
  }

  // ---- テスター用メモ（?tester=1 で開いたときだけ。入力した数字・選んだ内容は入れない。送信もしない） ----

  var screenStart = Date.now();
  function screenKey(i) { return i === CARD ? 'card' : isStep(i) ? 's' + i : i < 0 ? 'start' : 'result'; }
  function screenName(k) {
    if (k === 'start') return '最初の画面';
    if (k === 'card') return '目安の画面';
    if (k === 'result') return '結果の画面';
    var i = Number(k.slice(1));
    return (i + 1) + '. ' + STEPS[i].title;
  }
  function logLeave() {
    if (!state.testerOn) return;
    var log = state.tlog || (state.tlog = { sec: {}, order: [] });
    var k = screenKey(state.step);
    log.sec[k] = (log.sec[k] || 0) + Math.round((Date.now() - screenStart) / 1000);
    screenStart = Date.now();
  }
  function logEnter(i) {
    if (!state.testerOn) return;
    var log = state.tlog || (state.tlog = { sec: {}, order: [] });
    var k = screenKey(i);
    if (log.order.indexOf(k) < 0) log.order.push(k);
    log.last = k;
    if (i === CARD) log.card = true;
    if (isStep(i) && STEPS[i].stage === 2) log.detail = true;
    screenStart = Date.now();
  }
  // ← → キーでプロローグを前後に送る
  document.addEventListener('keydown', function (e) {
    if (!pro || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); proGo(pro.i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); proGo(pro.i - 1); }
  });
  document.addEventListener('visibilitychange', function () {
    // 別のアプリに切り替えている間は、プロローグを止める
    if (document.hidden && pro && !pro.paused) proPause(true);
    if (!state.testerOn) return;
    if (document.hidden) { logLeave(); save(); } else screenStart = Date.now();
  });

  function testerMemo() {
    var log = state.tlog || { sec: {}, order: [] };
    var blank = [], unk = [];
    STEPS.forEach(function (s, si) {
      slots(si).forEach(function (f) {
        if (state.unknown[f.id]) unk.push(SHORT[f.id]);
        else if (slotStatus(f, si) === 'todo') blank.push(SHORT[f.id]);
      });
    });
    var L = ['テスター用メモ（入力した数字や選んだ内容は入っていません）'];
    L.push('最後に開いた画面：' + (log.last ? screenName(log.last) : '―'));
    L.push('目安の画面まで進んだ：' + (log.card ? 'はい' : 'いいえ'));
    L.push('プロローグ：' + (log.prologue || '―'));
    L.push('「くわしく入れる」の画面を開いた：' + (log.detail ? 'はい' : 'いいえ'));
    L.push('画面ごとの時間：' + (log.order.length ? log.order.map(function (k) { return screenName(k) + ' ' + (log.sec[k] || 0) + '秒'; }).join('、') : '―'));
    L.push('空欄の項目：' + (blank.length ? blank.join('、') : 'なし'));
    L.push('「分からない」にした項目：' + (unk.length ? unk.join('、') : 'なし'));
    return L.join('\n');
  }

  function appendTesterMemo() {
    if (!state.testerOn) return;
    var box = el('div', { class: 'card tester', hidden: 'hidden' });
    var btn = el('button', { type: 'button', class: 'link', text: 'テスター用メモを見る', onclick: function () {
      logLeave(); save();
      var text = testerMemo();
      box.innerHTML = '';
      var pre = el('pre', { class: 'ai', text: text });
      box.appendChild(el('p', { class: 'sub', text: '中身はこれだけです。コピーして、DM に貼ってください（このシートからは送信しません）。' }));
      box.appendChild(pre);
      box.appendChild(el('button', { type: 'button', class: 'btn', style: 'margin-top:8px', text: 'メモをコピー', onclick: function () { copy(text, pre); } }));
      box.hidden = false;
      box.scrollIntoView({ block: 'nearest' });
    } });
    app.appendChild(btn);
    app.appendChild(box);
  }

  // ---- 画面 ----

  // 最初の画面の「全部の項目を見る」に出す一覧
  function renderOverview() {
    var t = tally();
    var rows = [];
    STEPS.forEach(function (s, si) {
      if (si === 0) rows.push(el('p', { class: 'ovstage', text: '最初の8問（目安が出ます）' }));
      if (si === FIRST_DETAIL) rows.push(el('p', { class: 'ovstage', text: 'くわしく入れる（任意。目安を見たあとで）' }));
      if (si === WORRY) rows.push(el('p', { class: 'ovstage', text: '最後に（任意）' }));
      var p = t.per[si];
      var st = p.filled === p.total ? 'done' : p.filled ? 'some' : 'todo';
      rows.push(el('button', { type: 'button', class: 'ovrow ' + st, onclick: function () { go(si); } }, [
        el('span', { class: 'box', 'aria-hidden': 'true', text: st === 'done' ? '✓' : '' }),
        el('span', { class: 'ovt' }, [
          el('b', { text: (si + 1) + '. ' + s.title }),
          el('span', { class: 'ovs', text: slots(si).map(function (f) { return SHORT[f.id]; }).join('・') })
        ]),
        el('span', { class: 'ovn', text: p.filled ? p.filled + ' / ' + p.total : p.total + '項目' })
      ]));
    });
    var det = el('details', { class: 'card all' }, [el('summary', { text: '全部の項目を見る' })].concat(rows).concat([
      el('p', { class: 'sub', style: 'margin:10px 0 0', text: '手元にあると早いもの：源泉徴収票、物件ページ（SUUMOなどの物件概要）、銀行の事前審査や見積もり。' })
    ]));
    if (state.overviewOpen) det.open = true;
    det.addEventListener('toggle', function () { state.overviewOpen = det.open; save(); });
    return det;
  }

  // ---- プロローグ（初めて開いた人にだけ、短い文を1つずつ浮かべては消す） ----
  // 設計：research/2026-10-27_プロローグ_スタート画面設計案.md。表示時間は「字数÷4秒＋1秒」（字幕の上限4字/秒より長く）。\n は改行の位置で、字数には数えない
  var PROLOGUE = [
    'マンションを買う前に、\nお金のことを整理しませんか。',
    '気になるのは、\n毎月いくら返すことになるか。',
    '8つの質問に答えると、\nその目安が出ます。',
    '細かい数字は、\n目安を見たあとで大丈夫です。',
    '入力はこの端末に保存。\nAIに渡すかは、あなたが決めます。'
  ];
  var FADE_OUT_MS = 400;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var pro = null; // 再生中のプロローグの状態（保存しない）
  var landingFade = false;

  function showPrologue() { return !state.prologueSeen && state.lastStep === undefined; }

  function renderPrologue() {
    document.body.classList.add('pro-on');
    pro = { i: 0, paused: false, timer: null, started: Date.now() };
    var line = el('p', { class: 'pline', id: 'pline', 'aria-live': 'polite' });
    var dots = el('div', { class: 'pdots', 'aria-hidden': 'true' }, PROLOGUE.map(function () { return el('i'); }));
    var paused = el('p', { class: 'ppaused', id: 'ppaused', hidden: 'hidden', text: '一時停止中' });
    // タップの位置だけでなく、ボタンと ← → キーでも前後に送れるようにする（キーボード・読み上げの人のため）
    var nav = el('div', { class: 'pnav' }, [
      el('button', { type: 'button', class: 'link', text: '‹ 前へ', onclick: function (e) { e.stopPropagation(); proGo(pro.i - 1); } }),
      el('button', { type: 'button', class: 'link', text: '次へ ›', onclick: function (e) { e.stopPropagation(); proGo(pro.i + 1); } })
    ]);
    var stage = el('div', { class: 'prologue', role: 'region', 'aria-label': 'はじめに', tabindex: '-1' }, [dots, paused, line, nav]);
    // 右の3分の2で次の文、左の3分の1で前の文
    stage.addEventListener('click', function (e) {
      var r = stage.getBoundingClientRect();
      if (e.clientX - r.left < r.width / 3) proGo(pro.i - 1); else proGo(pro.i + 1);
    });
    app.setAttribute('aria-live', 'off'); // 文の欄だけを読み上げさせる（入れ子の読み上げを避ける）
    app.appendChild(stage);
    var pauseBtn = el('button', { class: 'btn pbtn', id: 'ppause', text: '一時停止', onclick: function () { proPause(!pro.paused); } });
    var skipBtn = el('button', { class: 'btn pskip', text: 'とばす', onclick: function () { proFinish(false); } });
    // フォーカスの順は、前へ・次へ（文の下）→ 一時停止 → とばす。見た目は「とばす」を左にする
    // 動きを減らす設定では自動で送らないので、一時停止は出さない
    bar(reduceMotion ? [skipBtn] : [pauseBtn, skipBtn]);
    proShow(0);
    stage.focus({ preventScroll: true });
  }

  function proShow(i) {
    var line = document.getElementById('pline');
    if (!line) return;
    clearTimeout(pro.timer);
    pro.i = i;
    line.classList.remove('in', 'out');
    line.textContent = PROLOGUE[i];
    var dots = document.querySelectorAll('.pdots i');
    for (var k = 0; k < dots.length; k++) dots[k].className = k <= i ? 'on' : '';
    void line.offsetWidth; // 出る動きをやり直す
    line.classList.add('in');
    proSchedule();
  }

  function proSchedule() {
    clearTimeout(pro.timer);
    if (reduceMotion || pro.paused) return;
    var ms = Math.ceil(PROLOGUE[pro.i].replace(/\n/g, '').length / 4 + 1) * 1000;
    pro.timer = setTimeout(function () { proGo(pro.i + 1); }, ms);
  }

  function proGo(i) {
    if (!pro || i < 0) return;
    clearTimeout(pro.timer);
    var line = document.getElementById('pline');
    var after = function () { if (i >= PROLOGUE.length) proFinish(true); else proShow(i); };
    if (reduceMotion || !line) { after(); return; }
    line.classList.remove('in');
    line.classList.add('out');
    pro.timer = setTimeout(after, FADE_OUT_MS);
  }

  function proPause(on) {
    pro.paused = on;
    var b = document.getElementById('ppause');
    if (b) b.textContent = on ? '再開' : '一時停止';
    var m = document.getElementById('ppaused');
    if (m) m.hidden = !on;
    if (on) clearTimeout(pro.timer); else proSchedule();
  }

  // 最後まで見た（done）か、とばしたか。どちらでも次から出さない
  function proFinish(done) {
    if (!pro) return;
    clearTimeout(pro.timer);
    var sec = Math.round((Date.now() - pro.started) / 1000);
    var at = pro.i + 1;
    pro = null;
    state.prologueSeen = true;
    if (state.testerOn) {
      var log = state.tlog || (state.tlog = { sec: {}, order: [] });
      // 初回の記録を残す（「はじめての方へ」で見直しても上書きしない）
      if (!log.prologue) log.prologue = done ? '最後まで見た・' + sec + '秒' : at + '文目でとばした・' + sec + '秒';
    }
    screenStart = Date.now();
    save();
    document.body.classList.remove('pro-on');
    app.setAttribute('aria-live', 'polite');
    landingFade = true;
    app.innerHTML = '';
    renderIntro();
    window.scrollTo(0, 0);
    var h = document.querySelector('.landing h1');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  // スタート画面（プロローグの着地先）。最初に見える文字を見出し・見本・補足・ボタンに絞る
  function renderIntro() {
    if (showPrologue() || pro) { renderPrologue(); return; }
    var wrap = el('div', { class: 'landing' + (landingFade ? ' fadein' : '') });
    landingFade = false;
    wrap.appendChild(el('p', { class: 'appname' }, [el('b', { text: 'マンション購入 AI相談シート' }), el('span', { text: 'v0.6（試作版）' })]));
    wrap.appendChild(el('div', { class: 'card hero' }, [
      el('h1', { text: '8つの質問で、毎月の返済の目安が出ます' }),
      el('div', { class: 'kpi preview', 'aria-label': '目安の見本（あなたの数字で埋まります）' }, [
        el('div', {}, [el('span', { text: '毎月の返済' }), el('b', { text: '― 円' })]),
        el('div', {}, [el('span', { text: '完済するときの年齢' }), el('b', { text: '― 歳' })]),
        el('div', {}, [el('span', { text: '借入額' }), el('b', { text: '― 万円' })]),
        el('div', {}, [el('span', { text: '年収に対する返済' }), el('b', { text: '― %' })])
      ]),
      el('p', { class: 'sub', style: 'margin:6px 0 0', text: '↑ あなたの数字で、ここが埋まります' })
    ]));
    wrap.appendChild(el('p', { class: 'sub', text: '必須は4つ。借入額と返済期間は自動で入ります。' }));
    wrap.appendChild(renderOverview());
    var about = el('details', { class: 'card all' }, [el('summary', { text: '保存と送信について' }),
      el('p', { class: 'sub', text: '登録はいりません。入力した内容はこの端末のブラウザの中に保存されます。最後にAIのボタンを押すか、相談用の文章をコピーして貼るまでは、どこにも送られません。' }),
      el('p', { class: 'sub', text: '最後に、ChatGPT・Claude・Gemini にそのまま渡せる「相談用の文章」を作ります。AIに渡すと、その内容は選んだAIサービスに送られます（送られ方は結果の画面で説明します）。' }),
      el('p', { class: 'sub', style: 'margin:0', text: 'このシートは計算と一般的な目安との比較をするもので、購入の可否や金融商品の選択を助言するものではありません。' })
    ]);
    if (state.aboutOpen) about.open = true;
    about.addEventListener('toggle', function () { state.aboutOpen = about.open; save(); });
    wrap.appendChild(about);
    wrap.appendChild(el('button', { type: 'button', class: 'link', text: 'はじめての方へ（もう一度見る）', onclick: function () {
      app.innerHTML = '';
      renderPrologue();
    } }));
    app.appendChild(wrap);
    var started = state.lastStep !== undefined;
    bar([el('button', { class: 'btn primary', text: started ? '続きから' : '自分の数字で試す', onclick: function () { go(started ? state.lastStep : 0); } })]);
    if (started) app.appendChild(el('button', { class: 'link', text: '入力内容を消して最初から', onclick: confirmClear }));
    appendTesterMemo();
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
    var st0 = boxStatus(f);
    var tag = f.required ? '必須' : f.when || f.type === 'chips' || f.type === 'textarea' || !f.unknown ? '任意' : '任意・分からなくても進めます';
    wrap.appendChild(el('label', { class: 'q', for: inputId }, [
      el('span', { class: 'qbox ' + st0, id: 'qb-' + f.id, 'aria-hidden': 'true', text: st0 === 'done' ? '✓' : st0 === 'unknown' ? '?' : '' }),
      el('span', { text: f.label }),
      isImported(f.id) ? el('span', { class: 'tag imp', text: '物件ページから' }) : null,
      f.count === false ? el('span', { class: 'tag', text: '自動' }) : el('span', { class: 'tag' + (f.required ? ' need' : ''), text: tag })
    ]));
    if (f.hint) wrap.appendChild(el('div', { class: 'hint', text: f.hint }));
    if (f.where) wrap.appendChild(el('details', { class: 'where' }, [el('summary', { text: 'どこに書いてある？' })]
      .concat(f.where.map(function (t) { return el('p', { text: t }); }))));

    if (f.type === 'chips') {
      var chips = el('div', { class: 'chips', role: 'group', 'aria-label': f.label });
      f.options.forEach(function (o) {
        var c = el('button', { type: 'button', class: 'chip', 'aria-pressed': String(a[f.id] === o[0]), text: o[1] });
        c.addEventListener('click', function () {
          var before = boxStatus(f);
          a[f.id] = o[0];
          save();
          renderStep(state.step, true);
          var b = document.getElementById('qb-' + f.id);
          if (b && before === 'todo' && boxStatus(f) !== 'todo') {
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
      if (f.id === 'loan') state.loanManual = true;
      if (f.id === 'years') state.yearsTouched = true;
      save();
      var e = document.getElementById('err-' + f.id);
      if (e) e.remove();
      if (f.id === 'ownFunds' || f.id === 'price' || f.id === 'renoCost' || f.id === 'loan') updateSuggest();
    });
    input.addEventListener('blur', function () {
      if (f.id === 'loan') {
        if (a.loan === undefined || a.loan === '') { state.loanManual = false; save(); }
        updateSuggest();
      }
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
        var e = document.getElementById('err-' + f.id);
        if (e && cb.checked) e.remove();
        refreshImported();
        markField(f, true);
        renderChecklist();
      });
      wrap.appendChild(el('label', { class: 'unknown', for: 'unk-' + f.id }, [cb, el('span', { text: f.unknownLabel || '分からない' })]));
    }
    return wrap;
  }

  function updateSuggest() {
    var box = document.getElementById('suggest');
    if (!box) return;
    var s = suggestLoan();
    var key = s === null ? '' : (state.loanManual ? 'm' : 'a') + s;
    if (box.dataset.key === key) return;
    box.dataset.key = key;
    box.innerHTML = '';
    if (s === null) return;
    var calcText = '物件＋リノベ＋諸費用（物件の約8.5%）−自己資金 ＝ ' + s.toLocaleString('ja-JP') + '万円';
    var loanField = findField('loan');
    var inLoan = document.getElementById('in-loan');
    if (!state.loanManual) {
      box.appendChild(document.createTextNode('自動で入れています：' + calcText + '。銀行の見積もりなどで額が決まっていれば、直してください。'));
      if (inLoan && document.activeElement !== inLoan && inLoan.value !== state.answers.loan) {
        inLoan.value = state.answers.loan;
        markField(loanField, true);
      }
      return;
    }
    box.appendChild(document.createTextNode('目安：' + calcText + ' '));
    box.appendChild(el('button', { type: 'button', class: 'link', text: 'この額を入れる', onmousedown: function (e) { e.preventDefault(); }, onclick: function () {
      state.loanManual = false;
      save();
      if (inLoan) inLoan.value = state.answers.loan;
      var e = document.getElementById('err-loan');
      if (e) e.remove();
      markField(loanField, true);
      updateSuggest();
    } }));
  }

  function doneBanner() {
    if (!justDone) return;
    app.appendChild(el('div', { class: 'donebanner', role: 'status' }, [
      el('span', { class: 'qbox done pop', 'aria-hidden': 'true', text: '✓' }),
      el('span', { text: justDone.title + '：' + justDone.total + '項目中 ' + justDone.filled + '項目を記入しました' })
    ]));
    justDone = null;
  }

  function prevOf(i) { return i === FIRST_DETAIL || (i === WORRY && state.skipDetail) ? CARD : i - 1; }

  function renderStep(i, keepScroll) {
    var y = window.scrollY;
    app.innerHTML = '';
    var s = STEPS[i];
    var a = state.answers;
    doneBanner();
    var where = s.stage === 1 ? '最初の8問　画面 ' + (i + 1) + ' / ' + FIRST_DETAIL
      : s.stage === 2 ? 'くわしく入れる（任意）　画面 ' + (i - FIRST_DETAIL + 1) + ' / ' + (WORRY - FIRST_DETAIL) : '最後に';
    app.appendChild(el('p', { class: 'sub', text: where }));
    app.appendChild(el('h2', { text: s.title }));
    app.appendChild(el('p', { class: 'sub', text: s.lead }));
    if (s.gain) app.appendChild(el('p', { class: 'gain', text: '入れると：' + s.gain }));
    var card = el('div', { class: 'card' });
    s.fields.forEach(function (f) {
      if (f.when && !f.when(a)) return;
      card.appendChild(renderField(f));
    });
    app.appendChild(card);
    if (s.stage === 2) app.appendChild(el('button', { type: 'button', class: 'link', text: '残りは入れずに、相談文へ進む', onclick: function () { state.skipDetail = false; forward(WORRY); } }));
    updateSuggest();
    renderChecklist();
    appendTesterMemo();
    bar([
      el('button', { class: 'btn', text: '戻る', onclick: function () { go(prevOf(i)); } }),
      el('button', { class: 'btn primary', text: i === WORRY ? '結果を見る' : i === FIRST_DETAIL - 1 ? '目安を見る' : '次へ', onclick: function () { next(i); } })
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
      if (v === undefined || v === '') { if (f.required) bad = f.unknown ? '計算に必要です。入力するか「分からない」を選んでください' : '計算に必要です。入力してください'; }
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
    forward(i === FIRST_DETAIL - 1 ? CARD : i + 1);
  }

  // 次の画面に進む前に、中央に短い案内を出す（「次へ」で進むときだけ。戻る・一覧から飛ぶときは出さない）
  var INTERLUDE = {
    1: '次は、検討中の物件について\n教えてください。',
    2: '次は、お金の計画です。\n借入額と返済期間は入っています。',
    card: 'ここまでの数字で、\n毎月の返済の目安を出しました。',
    3: 'ここからは任意です。\nまずは、今の家計について。',
    4: '次は、物件の詳細について\n教えてください。',
    5: '次は、収入や家族、\nローンの詳細について。',
    6: '最後に、気になっていることを\n教えてください。'
  };
  var interlude = null;
  function forward(t) {
    var msg = INTERLUDE[t];
    if (!msg) { go(t); return; }
    clearTimeout(interlude && interlude.timer);
    logLeave();
    interlude = { t: t };
    document.body.classList.add('pro-on');
    app.innerHTML = '';
    var line = el('p', { class: 'pline', 'aria-live': 'polite', text: msg });
    var stage = el('div', { class: 'prologue interlude', role: 'region', 'aria-label': '次の画面の案内', tabindex: '-1', onclick: function () { endInterlude(); } }, [line]);
    app.setAttribute('aria-live', 'off');
    app.appendChild(stage);
    var top = document.getElementById('top'); if (top) top.hidden = true;
    bar([el('button', { class: 'btn primary', text: '次へ', onclick: function () { endInterlude(); } })]);
    window.scrollTo(0, 0);
    void line.offsetWidth;
    line.classList.add('in');
    stage.focus({ preventScroll: true });
    // 表示は「字数÷6秒」、短くても2秒。タップか「次へ」ですぐ進める
    var ms = Math.max(2000, Math.ceil(msg.replace(/\n/g, '').length / 6 * 1000));
    interlude.timer = setTimeout(endInterlude, ms);
  }
  function endInterlude() {
    if (!interlude) return;
    var t = interlude.t;
    clearTimeout(interlude.timer);
    interlude = null;
    var line = document.querySelector('.interlude .pline');
    var from = state.step;
    var done = function () {
      document.body.classList.remove('pro-on');
      app.setAttribute('aria-live', 'polite');
      if (state.step !== from) return;
      screenStart = Date.now();
      go(t);
      focusHeading();
    };
    if (reduceMotion || !line) { done(); return; }
    line.classList.remove('in');
    line.classList.add('out');
    setTimeout(done, FADE_OUT_MS);
  }

  // 案内のあとは、新しい画面の見出しにフォーカスを移す（読み上げの人が場所を見失わないように）
  function focusHeading() {
    var h = app.querySelector('h2');
    if (!h) return;
    h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
  }

  function go(i) {
    if (interlude) { clearTimeout(interlude.timer); interlude = null; document.body.classList.remove('pro-on'); app.setAttribute('aria-live', 'polite'); }
    logLeave();
    state.step = i;
    if (isStep(i) && STEPS[i].stage === 2) state.skipDetail = false;
    if (isStep(i) || i === CARD) state.lastStep = i;
    logEnter(i);
    save();
    render();
    window.scrollTo(0, 0);
    app.classList.remove('enter');
    void app.offsetWidth;
    app.classList.add('enter');
  }

  function row(label, value) {
    return el('tr', {}, [el('td', { text: label }), el('td', { class: 'n', text: value })]);
  }

  // 必須の項目が欠けていたら、その画面に戻す（金利は「分からない」でもよい）
  function missingStep(a) {
    for (var si = 0; si < STEPS.length; si++) {
      var missing = STEPS[si].fields.some(function (f) {
        return f.required && !(f.id === 'rate' && a.rateUnknown) && (a[f.id] === undefined || a[f.id] === '');
      });
      if (missing) return si;
    }
    return -1;
  }

  // 計算。金利が分からないときは例の3通り（ex）も返す。r は例1の結果で、金利によらない値（完済時の年齢など）に使う
  function compute(a) {
    if (a.rateUnknown) {
      var ex = Calc.analyzeExamples(a);
      return { r: ex[0].r, ex: ex };
    }
    return { r: Calc.analyze(a), ex: null };
  }

  // 目安に置いた前提（自動・初期値・未回答）。目安の画面と結果の画面で同じものを出す
  function premises(a) {
    var L = [];
    if (a.loanAuto) L.push('借入額は、物件価格＋リノベ費用＋諸費用の目安（物件の8.5%）−自己資金 で自動計算しています。');
    if (a.yearsDefault) L.push('返済期間は、最初から入れてある35年のままです。');
    if (a.ownFunds === undefined || a.ownFunds === '') L.push('自己資金は未入力のため、0円で計算しています。');
    if (!a.otherDebtHas) L.push('住宅以外の借入は未回答のため、0円で計算しています。');
    else if (a.otherDebtHas === 'yes' && (a.otherDebtMonthly === undefined || a.otherDebtMonthly === '')) L.push('住宅以外の借入の毎月の額が未入力のため、0円で計算しています。');
    if (a.rateUnknown) L.push('金利が分からないため、例として年' + Calc.RATE_EXAMPLES.map(function (x) { return x.toFixed(1) + '%'; }).join('・年') + 'の3通りで計算しています。どれかを勧めるものではありません。');
    return L;
  }

  function exampleTable(ex, cols) {
    var t = el('table', { class: 'ex' }, [el('tr', {}, [el('th', { text: '金利（例）' })].concat(cols.map(function (c) { return el('th', { class: 'n', text: c[0] }); })))]);
    ex.forEach(function (e) {
      t.appendChild(el('tr', {}, [el('td', { text: e.label + '　年' + e.rate.toFixed(1) + '%' })].concat(cols.map(function (c) { return el('td', { class: 'n', text: c[1](e.r) }); }))));
    });
    return t;
  }

  function rateSourceNote() {
    return el('p', { class: 'sub', text: '例の金利の出どころ：' + Calc.RATE_SOURCE + '。' });
  }

  // 最初の8問の後に出す目安（途中の見返り）。数字だけを出し、良い・悪いは書かない
  function renderCard() {
    var a = answers();
    var ms = missingStep(a);
    if (ms >= 0 && ms < FIRST_DETAIL) { go(ms); return; }
    var c = compute(a), r = c.r, YE = Calc.yenExact, P = Calc.pct;
    state.cardLoan = a.loan;
    save();
    doneBanner();
    app.appendChild(el('p', { class: 'sub', text: '最初の8問の結果' }));
    app.appendChild(el('h2', { text: '毎月の返済の目安' }));
    var body = [];
    if (c.ex) {
      body.push(el('div', { class: 'kpi' }, [
        el('div', {}, [el('span', { text: '借入額' + (a.loanAuto ? '（自動）' : '') }), el('b', { text: Number(a.loan).toLocaleString('ja-JP') + '万円' })]),
        el('div', {}, [el('span', { text: '完済するときの年齢' }), el('b', { text: r.payoffAge + '歳' })])
      ]));
      body.push(el('p', { class: 'sub', style: 'margin:12px 0 4px', text: '金利が分からないので、3通りで計算しました。' }));
      body.push(exampleTable(c.ex, [['毎月の返済', function (x) { return YE(x.monthly); }], ['額面年収に対して', function (x) { return P(x.burdenGross); }]]));
    } else {
      body.push(el('div', { class: 'kpi' }, [
        el('div', {}, [el('span', { text: '毎月の返済' }), el('b', { text: YE(r.monthly) })]),
        el('div', {}, [el('span', { text: '完済するときの年齢' }), el('b', { text: r.payoffAge + '歳' })]),
        el('div', {}, [el('span', { text: '借入額' + (a.loanAuto ? '（自動）' : '') }), el('b', { text: Number(a.loan).toLocaleString('ja-JP') + '万円' })]),
        el('div', {}, [el('span', { text: '額面年収に対する返済' }), el('b', { text: P(r.burdenGross) })])
      ]));
    }
    body.push(el('p', { class: 'sub', style: 'margin:10px 0 0', text: '入れた数字から計算した目安で、良い・悪いの判定ではありません。返済負担率は額面年収に対する割合です。' }));
    app.appendChild(el('div', { class: 'card' }, body));
    var pr = premises(a);
    if (pr.length) app.appendChild(el('div', { class: 'card' }, [el('h2', { text: 'この目安の前提' })].concat(pr.map(function (x) { return el('p', { class: 'sub pr', text: x }); })).concat(c.ex ? [rateSourceNote()] : [])));
    app.appendChild(el('button', { type: 'button', class: 'link', text: '← 最初の8問を直す', onclick: function () { go(FIRST_DETAIL - 1); } }));
    var t = tally();
    var rows = [];
    for (var si = FIRST_DETAIL; si < WORRY; si++) (function (si) {
      var p = t.per[si];
      var st = p.filled === p.total ? 'done' : p.filled ? 'some' : 'todo';
      rows.push(el('button', { type: 'button', class: 'ovrow ' + st, onclick: function () { go(si); } }, [
        el('span', { class: 'box', 'aria-hidden': 'true', text: st === 'done' ? '✓' : '' }),
        el('span', { class: 'ovt' }, [el('b', { text: STEPS[si].title }), el('span', { class: 'ovs wrap', text: STEPS[si].gain })]),
        el('span', { class: 'ovn', text: p.filled ? p.filled + ' / ' + p.total : p.total + '項目' })
      ]));
    })(si);
    app.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'くわしく入れると分かること（任意）' }),
      el('p', { class: 'sub', text: '入れた分だけ、計算と相談用の文章に反映します。どこから入れても、途中でやめても大丈夫です。' })
    ].concat(rows)));
    appendTesterMemo();
    bar([
      el('button', { class: 'btn', text: 'このまま相談文へ', onclick: function () { state.skipDetail = true; forward(WORRY); } }),
      el('button', { class: 'btn primary', text: 'くわしく入れる', onclick: function () { state.skipDetail = false; forward(FIRST_DETAIL); } })
    ]);
  }

  function renderResult() {
    var a = answers();
    var ms = missingStep(a);
    if (ms >= 0) { go(ms); return; }
    var c = compute(a), r = c.r, ex = c.ex;
    var today = new Date();
    var ds = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    var text = Calc.buildAiText(a, r, ds, ex);
    var Y = Calc.yen, YE = Calc.yenExact, P = Calc.pct;

    app.appendChild(el('h2', { text: '計算結果' }));
    app.appendChild(el('p', { class: 'sub', text: '元利均等返済で計算しています。' }));
    if (state.cardLoan !== undefined && String(state.cardLoan) !== String(a.loan)) {
      app.appendChild(el('div', { class: 'note', text: '目安の画面のときから、借入額が ' + Number(state.cardLoan).toLocaleString('ja-JP') + '万円 → ' + Number(a.loan).toLocaleString('ja-JP') + '万円 に変わりました（後から入れた内容を反映しています）。毎月の返済なども変わっています。' }));
    }

    if (ex) {
      app.appendChild(el('div', { class: 'card' }, [
        el('p', { class: 'sub', text: '金利が分からないので、例の3通りで計算しています（どれかを勧めるものではありません）。' }),
        exampleTable(ex, [['毎月の返済', function (x) { return YE(x.monthly); }], [r.runningMonthly ? '管理費等込み' : '管理費等込み（未入力）', function (x) { return YE(x.housingMonthly); }], ['手取りに対して', function (x) { return P(x.burdenNet); }]]),
        el('div', { class: 'kpi', style: 'margin-top:10px' }, [
          el('div', {}, [el('span', { text: '完済時の年齢' }), el('b', { text: r.payoffAge + '歳' })]),
          el('div', {}, [el('span', { text: '借入額' }), el('b', { text: Number(a.loan).toLocaleString('ja-JP') + '万円' })])
        ])
      ]));
    } else {
      app.appendChild(el('div', { class: 'card' }, [
        el('div', { class: 'kpi' }, [
          el('div', {}, [el('span', { text: '毎月の返済額' }), el('b', { text: YE(r.monthly) })]),
          el('div', {}, [el('span', { text: '管理費・修繕積立金込み' + (r.runningMonthly ? '' : '（未入力）') }), el('b', { text: YE(r.housingMonthly) })]),
          el('div', {}, [el('span', { text: '手取り年収に対する返済' }), el('b', { text: P(r.burdenNet) })]),
          el('div', {}, [el('span', { text: '完済時の年齢' }), el('b', { text: r.payoffAge + '歳' })])
        ])
      ]));
    }

    var t1 = el('table', {}, ex ? [] : [
      row('総返済額', Y(r.total)),
      row('うち利息', Y(r.interest)),
      row('額面年収に対する返済', P(r.burdenGross)),
      row('同・他の借入込み', P(r.burdenGrossAll)),
      row(r.retireAge + '歳時点の残高', r.retireBalance === null ? '―' : Y(r.retireBalance))
    ]);
    if (ex) {
      ex.forEach(function (e) {
        t1.appendChild(row(e.label + '（年' + e.rate.toFixed(1) + '%）の総返済額', Y(e.r.total)));
      });
    }
    t1.appendChild(row('諸費用の目安（物件の7〜10%）', Y(r.closingLo) + '〜' + Y(r.closingHi)));
    t1.appendChild(row('資金の過不足（概算）', r.fundingGap === null ? '計算していません' : Y(r.fundingGap)));
    if (r.cashLeft !== undefined) t1.appendChild(row('自己資金を出した後に残るお金', Y(r.cashLeft)));
    if (r.emergency) t1.appendChild(row('生活費6か月分', Y(r.emergency)));
    var sumCard = [el('h2', { text: '数字のまとめ' }), t1];
    if (r.fundingGap === null) sumCard.push(el('p', { class: 'sub', style: 'margin:8px 0 0', text: '資金の過不足：借入額をシートが自動で「必要な額−自己資金」に合わせているため、計算していません。銀行の見積もりなどで借入額を直すと計算します。' }));
    app.appendChild(el('div', { class: 'card' }, sumCard));

    if (!ex) {
      var t2 = el('table', {}, [el('tr', {}, [el('th', { text: '金利' }), el('th', { text: '毎月' }), el('th', { text: '手取りに対して' })])]);
      t2.appendChild(el('tr', {}, [el('td', { text: '今（' + a.rate + '%）' }), el('td', { class: 'n', text: YE(r.monthly) }), el('td', { class: 'n', text: P(r.burdenNet) })]));
      r.scenarios.forEach(function (s) {
        t2.appendChild(el('tr', {}, [el('td', { text: '+' + s.delta + '%' }), el('td', { class: 'n', text: YE(s.monthly) }), el('td', { class: 'n', text: P(s.burdenNet) })]));
      });
      app.appendChild(el('div', { class: 'card' }, [
        el('h2', { text: '金利が上がったら' }), t2,
        el('p', { class: 'sub', text: '参考の試算（判定ではありません）：手取りの25%（よく使われる目安）以内に、今の金利+2%でも収まる借入額は ' + Y(r.refLoan) + '。' })
      ]));
    }

    if (r.repairUnit) {
      var g = r.repairGuide;
      var msg = '今の月額は㎡あたり ' + Math.round(r.repairUnit) + '円。';
      if (g) msg += '国交省ガイドライン（' + g.label + '）の目安は、平均' + g.avg + '円、事例の3分の2が' + g.lo + '〜' + g.hi + '円です。';
      else msg += '建物の規模が分かると、国のガイドラインの目安を表示します。';
      app.appendChild(el('div', { class: 'card' }, [el('h2', { text: '修繕積立金' }), el('p', { text: msg }),
        el('p', { class: 'sub', text: 'ガイドラインの目安は、長期修繕計画の期間全体で見た平均額です。今後値上げする計画（段階増額積立方式）なら、今の月額は低く出ます。機械式駐車場がある場合は目安が上がります。幅に入っていないからといって、直ちに不適切とは限りません（ガイドラインより）。長期修繕計画と積立方式を確認してください。' })]));
    }

    var extras = premises(a).map(function (x) { return '前提：' + x; })
      .concat(r.notes).concat(r.assumptions.map(function (x) { return '仮定：' + x; }));
    if (extras.length) {
      app.appendChild(el('div', { class: 'card' }, [el('h2', { text: '確認したほうがよさそうな点' })].concat(
        extras.map(function (n) { return el('div', { class: 'note', text: n }); }))));
    }

    var pre = el('pre', { class: 'ai', text: text });
    app.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'AIに相談する' }),
      el('ol', { class: 'steps' }, [
        el('li', { text: '下の「相談用の文章をコピー」を押す' }),
        el('li', { text: 'ChatGPT・Claude・Gemini を開いて、新しい会話に貼り付けて送る' }),
        el('li', { text: '続けて質問すれば、あなたの条件をふまえて答えてくれます' })
      ]),
      pre,
      el('div', { class: 'note', text: 'AIに渡すと、年収や借入額などの内容はそのAIサービスに送られます。下の ChatGPT・Claude のボタンは、文章を入れた状態で開くため、押した時点でそのサービスに送られ、ブラウザの履歴にも残ります（ChatGPT はそのまま送信まで進むことがあります）。数字を丸めたい場合は、ボタンを使わずに下の「相談用の文章をコピー」でコピーし、AIに貼ってから直して送ってください。各サービスの設定（会話を学習に使うかどうか等）も確認してから使ってください。' }),
      el('p', { class: 'sub', text: 'ボタンを押すと、相談用の文章をコピーしてからAIを開きます。入力欄に文章が入っていなければ、貼り付けてください（Gemini は貼り付けが必要です）。' }),
      el('div', { class: 'apps' }, AI_APPS.map(function (x) {
        return el('a', { href: x.url(text), target: '_blank', rel: 'noopener', text: x.name + ' で相談', onclick: function () { copy(text, pre, true); } });
      })),
      el('p', { class: 'sub', style: 'margin-top:10px', text: 'ヒント：ChatGPT や Claude の「プロジェクト」、Gemini の「Gem」の指示欄に貼っておくと、次からは説明しなくても前提をふまえて答えてくれます。' })
    ]));

    var t = tally();
    if (t.stage[2].filled < t.stage[2].total) {
      app.appendChild(el('button', { type: 'button', class: 'link', text: 'くわしく入れる（任意）に戻る：あと' + (t.stage[2].total - t.stage[2].filled) + '項目', onclick: function () { go(CARD); } }));
    }

    app.appendChild(el('footer', {}, [
      el('p', {}, [document.createTextNode('出典：修繕積立金の目安は国土交通省「'),
        el('a', { href: 'https://www.mlit.go.jp/jutakukentiku/house/content/001747009.pdf', target: '_blank', rel: 'noopener', text: 'マンションの修繕積立金に関するガイドライン' }),
        document.createTextNode('」（令和6年6月改定）。返済負担率25%、生活費6か月分、諸費用7〜10%は一般によく使われる目安で、公的な基準ではありません。')]),
      ex ? el('p', {}, [document.createTextNode('例の金利：住宅金融支援機構「'),
        el('a', { href: 'https://www.jhf.go.jp/files/topics/4955_ext_99_2.pdf', target: '_blank', rel: 'noopener', text: '住宅ローン利用者の実態調査（2026年1月調査）' }),
        document.createTextNode('」の借入金利の水準（p.4）の区切りの値。どれかを勧めるものではありません。')]) : null,
      el('p', { text: '計算の前提：元利均等返済、借入期間中の金利は一定（金利上昇の試算を除く）、ボーナス払いなし。実際の返済額・審査・金利・税制は金融機関や制度によって異なります。' }),
      el('p', { text: 'このシートは入力された数字にもとづく試算と一般的な情報の提供で、購入や借入の可否の判断、金融機関・商品の推奨、税務の個別相談を行うものではありません。最終的な判断は、金融機関や専門家にも確認してください。' }),
      el('p', { text: '内容の更新日：2026年10月26日' }),
      el('button', { class: 'link', text: '入力内容を消して最初から', onclick: confirmClear })
    ]));
    appendTesterMemo();

    bar([
      el('button', { class: 'btn', text: '修正', onclick: function () { go(0); } }),
      el('button', { class: 'btn primary', text: '相談用の文章をコピー', onclick: function () { copy(text, pre); } })
    ]);
  }

  // ChatGPT と Claude は、URL の q に文章を入れると入力欄に入った状態で開くことがある（公式の説明はない。入らなくてもコピー済みなので貼れる）
  var AI_APPS = [
    { name: 'ChatGPT', url: function (t) { return 'https://chatgpt.com/?q=' + encodeURIComponent(t); } },
    { name: 'Claude', url: function (t) { return 'https://claude.ai/new?q=' + encodeURIComponent(t); } },
    { name: 'Gemini', url: function () { return 'https://gemini.google.com/app'; } }
  ];

  function copy(text, pre, quiet) {
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
      navigator.clipboard.writeText(text).then(function () { toast('コピーしました'); }, quiet ? function () { toast('コピーできませんでした。「相談用の文章をコピー」を使ってください', 4000); } : fallback);
    } else {
      fallback();
    }
  }

  function render() {
    app.innerHTML = '';
    renderChecklist();
    if (state.step === CARD) renderCard();
    else if (typeof state.step !== 'number' || state.step < 0) renderIntro();
    else if (state.step < STEPS.length) renderStep(state.step);
    else renderResult();
  }

  logEnter(state.step);
  autoLoan();
  save();
  render();
})();
