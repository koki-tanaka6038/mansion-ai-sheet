// マンション購入 AI相談シート — 計算と「AIに渡す文章」の組み立て
// 画面に依存しない純粋関数だけを置く（node でテストできるように）。
(function (root) {
  'use strict';

  // 国交省「マンションの修繕積立金に関するガイドライン」令和6年6月改定（機械式駐車場を除く、円/㎡・月）
  var REPAIR_GUIDE = {
    tower: { label: '20階以上', avg: 338, lo: 240, hi: 410 },
    s1: { label: '20階未満・延床5,000㎡未満', avg: 335, lo: 235, hi: 430 },
    s2: { label: '20階未満・延床5,000〜10,000㎡', avg: 252, lo: 170, hi: 320 },
    s3: { label: '20階未満・延床10,000〜20,000㎡', avg: 271, lo: 200, hi: 330 },
    s4: { label: '20階未満・延床20,000㎡以上', avg: 255, lo: 190, hi: 325 }
  };

  var NET_RATIO_ASSUMED = 0.75; // 手取りが分からないときの仮定（額面に対する割合）

  // 金利が分からない人に、例として並べる3通りの金利。どれかを勧めるものではない
  // 出典：住宅金融支援機構「住宅ローン利用者の実態調査（2026年1月調査）」p.4 借入金利の水準、対象の時期は p.2 調査対象（2026-10-26 に原本PDFで確認）
  var RATE_EXAMPLES = [1.0, 1.5, 2.0];
  var RATE_SOURCE = '住宅金融支援機構「住宅ローン利用者の実態調査（2026年1月調査）」では、2025年4〜9月に住宅ローンを借りた人の借入金利は、年1.0%以下が66.5%、年1.5%以下が85.7%、年2.0%以下が94.7%（金利タイプを問わない）。この区切りの値を例にした';

  function monthlyPayment(principal, ratePct, years) {
    var n = years * 12;
    var r = ratePct / 100 / 12;
    if (n <= 0) return 0;
    if (r === 0) return principal / n;
    var f = Math.pow(1 + r, n);
    return principal * r * f / (f - 1);
  }

  // k か月返済した後の残高（元利均等）
  function balanceAfter(principal, ratePct, years, k) {
    var r = ratePct / 100 / 12;
    var m = monthlyPayment(principal, ratePct, years);
    if (k >= years * 12) return 0;
    if (r === 0) return principal - m * k;
    var f = Math.pow(1 + r, k);
    return principal * f - m * (f - 1) / r;
  }

  // 毎月 monthly 円まで払えるときの借入額
  function principalFor(monthly, ratePct, years) {
    var n = years * 12;
    var r = ratePct / 100 / 12;
    if (r === 0) return monthly * n;
    var f = Math.pow(1 + r, n);
    return monthly * (f - 1) / (r * f);
  }

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var x = Number(v);
    return isFinite(x) ? x : null;
  }

  // a: 画面の回答（金額は「万円」、管理費・修繕積立金は「円」）
  function analyze(a) {
    var man = 10000;
    var assumptions = [];
    var notes = [];

    var loan = num(a.loan) * man;
    var rate = num(a.rate);
    var years = num(a.years);
    var gross = num(a.grossIncome) * man;
    var net = num(a.netIncome);
    if (net === null) {
      net = gross * NET_RATIO_ASSUMED;
      assumptions.push('世帯の手取り年収は不明のため、額面の' + Math.round(NET_RATIO_ASSUMED * 100) + '%（' + yen(net) + '）と仮定。年収が高いほど実際の手取りの割合は低くなる');
    } else {
      net = net * man;
    }
    // 住宅以外の借入は、毎月の返済額（円）で受け取る。古い保存データの年間返済額（万円）にも対応する
    var otherDebt = a.otherDebtHas === 'none' ? 0
      : num(a.otherDebtMonthly) !== null ? num(a.otherDebtMonthly) * 12 : (num(a.otherDebt) || 0) * man;

    var m = monthlyPayment(loan, rate, years);
    var annual = m * 12;
    var res = {
      monthly: m,
      annual: annual,
      total: m * years * 12,
      interest: m * years * 12 - loan,
      burdenGross: annual / gross,
      burdenGrossAll: (annual + otherDebt) / gross,
      burdenNet: annual / net,
      netIncome: net,
      scenarios: [1, 2].map(function (d) {
        var ms = monthlyPayment(loan, rate + d, years);
        return { delta: d, rate: rate + d, monthly: ms, burdenNet: ms * 12 / net, diff: ms - m };
      })
    };

    // 年齢
    var age = num(a.age);
    var retire = num(a.retireAge) || 65;
    if (num(a.retireAge) === null) assumptions.push('退職予定年齢は' + (a.retirePick === 'undecided' ? '未定' : '不明') + 'のため65歳と仮定');
    res.payoffAge = age + years;
    var monthsToRetire = (retire - age) * 12;
    res.retireAge = retire;
    res.retireBalance = monthsToRetire > 0 ? Math.max(0, balanceAfter(loan, rate, years, monthsToRetire)) : null;

    // 住居費（ローン＋管理費＋修繕積立金）
    var mgmt = num(a.mgmtFee) || 0;
    var repair = num(a.repairFee) || 0;
    res.runningMonthly = mgmt + repair;
    if (num(a.mgmtFee) === null && num(a.repairFee) === null) assumptions.push('管理費・修繕積立金は未入力（または分からない）のため0円とした。住居費（返済＋管理費・修繕積立金）は返済額だけになっている');
    else if (num(a.mgmtFee) === null || num(a.repairFee) === null) assumptions.push((num(a.mgmtFee) === null ? '管理費' : '修繕積立金') + 'は未入力（または分からない）のため0円として住居費に足した');
    res.housingMonthly = m + mgmt + repair;

    // 諸費用の目安（中古マンションは物件価格の7〜10%が一般的な目安）
    var price = num(a.price) * man;
    var reno = a.renoHas === 'none' ? 0 : (num(a.renoCost) || 0) * man;
    res.closingLo = price * 0.07;
    res.closingHi = price * 0.10;

    // 資金の過不足（諸費用は中央値8.5%で概算）
    var own = (num(a.ownFunds) || 0) * man;
    var need = price + reno + price * 0.085;
    // マイナスなら不足。借入額をシートが自動で合わせたときは、式の作りからほぼ0（自己資金が多ければ自己資金の余り）になるので出さない
    res.fundingGap = a.loanAuto ? null : loan + own - need;
    assumptions.push('諸費用は物件価格の8.5%（一般的な目安7〜10%の中央）で概算');

    // 手元に残るお金と生活費6か月分
    var assets = num(a.assets);
    var living = num(a.living);
    if (assets !== null) {
      res.cashLeft = assets * man - own;
      res.emergency = living !== null ? living * man * 6 : null;
    }

    // 修繕積立金の㎡単価
    var area = num(a.area);
    if (area && repair) {
      res.repairUnit = repair / area;
      var g = REPAIR_GUIDE[a.scale];
      res.repairGuide = g || null;
      if (g) {
        res.repairPos = res.repairUnit < g.lo ? 'below' : res.repairUnit > g.hi ? 'above' : 'within';
      }
    }

    // 参考：手取りの25%・金利+2%でも払える借入額
    res.refLoan = principalFor(net * 0.25 / 12, rate + 2, years);

    // 築年
    var built = num(a.builtYear);
    if (built !== null && built < 1982) {
      notes.push('1981年以前の建築。住宅ローン控除などで、新耐震基準に適合することの証明が別途必要になる場合がある');
    }
    if (a.rateType === 'variable') {
      notes.push('変動金利。一般に「5年ルール・125%ルール」という仕組みがあるが、採用していない商品もある。この仕組みでは返済額が変わらなくても利息が増え、元本の減りが遅くなる場合がある。金融機関・商品ごとに確認が必要');
    }

    res.assumptions = assumptions;
    res.notes = notes;
    return res;
  }

  // 金利が分からないとき：例の金利ごとに計算する
  function analyzeExamples(a) {
    return RATE_EXAMPLES.map(function (rate, i) {
      return { label: '例' + (i + 1), rate: rate, r: analyze(Object.assign({}, a, { rate: rate })) };
    });
  }

  function yen(x) {
    if (x === null || x === undefined || !isFinite(x)) return '―';
    var sign = x < 0 ? '-' : '';
    x = Math.abs(x);
    if (x >= 10000) {
      var m = Math.round(x / 1000) / 10; // 0.1万円単位
      return sign + m.toLocaleString('ja-JP') + '万円';
    }
    return sign + Math.round(x).toLocaleString('ja-JP') + '円';
  }

  function yenExact(x) {
    return Math.round(x).toLocaleString('ja-JP') + '円';
  }

  function pct(x) {
    return (Math.round(x * 1000) / 10).toFixed(1) + '%';
  }

  var LABELS = {
    spouse: { none: 'なし', yes: 'あり' },
    rateType: { variable: '変動', fixed: '全期間固定', fixedTerm: '固定期間選択', mixed: 'ミックス', undecided: '未定' },
    scale: { tower: REPAIR_GUIDE.tower.label, s1: REPAIR_GUIDE.s1.label, s2: REPAIR_GUIDE.s2.label, s3: REPAIR_GUIDE.s3.label, s4: REPAIR_GUIDE.s4.label, unknown: '不明' }
  };

  function val(v, unit) {
    if (v === null || v === undefined || v === '') return '不明';
    var x = Number(v);
    return (isFinite(x) && unit !== '年' ? x.toLocaleString('ja-JP') : v) + (unit || '');
  }

  // 「AIに渡す文章」
  // ex：金利が分からないときの例ごとの計算（analyzeExamples の結果）。なければ本人の金利で書く
  function buildAiText(a, r, today, ex) {
    var L = [];
    L.push('# マンション購入の相談：私の前提情報');
    L.push('（作成日：' + today + '）');
    L.push('');
    L.push('この情報をもとに、私のマンション購入の資金計画について相談に乗ってください。');
    L.push('');
    L.push('## お願い');
    L.push('- 中立の立場で考えてください。特定の金融機関・商品を勧めないでください。');
    L.push('- 株・投資信託・NISA などの投資商品の売買や配分は勧めないでください。');
    L.push('- 「借りられる額」と「無理なく返し続けられる額」を分けて考えてください。');
    L.push('- 下の計算結果は、シートが決まった式で計算したものです。計算をやり直す場合は、式と過程を見せてください。');
    L.push('- 判断に足りない情報があれば、大事なものから3つまで質問してください。');
    L.push('- 税金・法律の個別判断が必要な点は、専門家に確認すべき事項として挙げてください。');
    L.push('- 最初に、下の「いちばん気になっていること」に答えてください。');
    L.push('');
    L.push('## 世帯');
    L.push('- 本人の年齢：' + val(a.age, '歳'));
    L.push('- 配偶者：' + (LABELS.spouse[a.spouse] || '不明') + (a.spouse === 'yes' ? '（' + val(a.spouseAge, '歳') + '）' : ''));
    L.push('- 子ども：' + (String(a.kids) === '3' ? '3人以上' : val(a.kids, '人')) + (Number(a.kids) > 0 ? '（末っ子 ' + val(a.youngestAge, '歳') + '）' : ''));
    L.push('- 世帯の額面年収：' + val(a.grossIncome, '万円'));
    L.push('- 世帯の手取り年収：' + val(a.netIncome, '万円'));
    if (a.otherDebtHas === 'none') L.push('- 住宅以外の借入：なし（本人回答）');
    else if (num(a.otherDebtMonthly) !== null) L.push('- 住宅以外の借入の毎月の返済額：' + val(a.otherDebtMonthly, '円'));
    else if (num(a.otherDebt) !== null) L.push('- 住宅以外の借入の年間返済額：' + val(a.otherDebt, '万円'));
    else L.push('- 住宅以外の借入：' + (a.otherDebtHas === 'yes' ? 'あり（金額は未入力）' : '未回答') + '。計算では0円とした');
    L.push('- 生活費（住居費を除く・月）：' + val(a.living, '万円'));
    L.push('- 預貯金・投資の合計：' + val(a.assets, '万円'));
    L.push('- 退職予定年齢：' + (num(a.retireAge) !== null ? val(a.retireAge, '歳') : (a.retirePick === 'undecided' ? '未定' : '不明') + '（計算では65歳と仮定）'));
    L.push('');
    L.push('## 物件');
    L.push('- 物件価格：' + val(a.price, '万円'));
    L.push('- 専有面積：' + val(a.area, '㎡'));
    L.push('- 建築年：' + val(a.builtYear, '年'));
    L.push('- 建物の規模：' + (LABELS.scale[a.scale] || '不明'));
    L.push('- 管理費（月）：' + val(a.mgmtFee, '円'));
    L.push('- 修繕積立金（月）：' + val(a.repairFee, '円'));
    if (a.renoHas === 'none') L.push('- リノベーション：しない（本人回答）');
    else if (num(a.renoCost) !== null) L.push('- リノベーション費用：' + val(a.renoCost, '万円'));
    else L.push('- リノベーション費用：' + (a.renoHas === 'yes' ? 'する（金額は未入力）' : '未回答') + '。計算では0円とした');
    L.push('');
    L.push('## 資金計画');
    L.push('- 自己資金として出す額：' + (num(a.ownFunds) !== null ? val(a.ownFunds, '万円') : '未入力（計算では0円とした）'));
    L.push('- 借入額：' + val(a.loan, '万円') + (a.loanAuto ? '（シートの自動計算：物件価格＋リノベーション費用＋諸費用の目安8.5%−自己資金。本人は直していない）' : ''));
    L.push('- 返済期間：' + val(a.years, '年') + (a.yearsDefault ? '（シートの初期値のまま。本人は直していない）' : ''));
    var typ = '（' + (LABELS.rateType[a.rateType] || 'タイプは不明') + '）';
    L.push(ex ? '- 金利：本人は未入力（分からない）。金利のタイプは' + (LABELS.rateType[a.rateType] || '不明') + '。下の計算は、例として年' + ex.map(function (e) { return e.rate.toFixed(1) + '%'; }).join('・年') + 'の3通りで行った。どれかを勧めるものではない'
      : '- 金利：' + val(a.rate, '%') + typ);
    L.push('');
    L.push('## シートの計算結果（元利均等返済）');
    if (ex) {
      ex.forEach(function (e) {
        var x = e.r;
        L.push('- ' + e.label + '（金利 年' + e.rate.toFixed(1) + '%）：毎月の返済額 ' + yenExact(x.monthly) + '、総返済額 ' + yen(x.total) + '（うち利息 ' + yen(x.interest) + '）、管理費・修繕積立金を足した月の住居費 ' + yenExact(x.housingMonthly)
          + '、返済負担率 額面年収に対して ' + pct(x.burdenGross) + '（他の借入込み ' + pct(x.burdenGrossAll) + '）・手取り年収に対して ' + pct(x.burdenNet)
          + (x.retireBalance !== null ? '、' + x.retireAge + '歳時点の残高 ' + yen(x.retireBalance) : ''));
      });
    } else {
      L.push('- 毎月の返済額：' + yenExact(r.monthly) + '（年間 ' + yen(r.annual) + '）');
      L.push('- 総返済額：' + yen(r.total) + '（うち利息 ' + yen(r.interest) + '）');
      L.push('- 管理費・修繕積立金を足した月の住居費：' + yenExact(r.housingMonthly));
      L.push('- 返済負担率：額面年収に対して ' + pct(r.burdenGross) + '（他の借入込み ' + pct(r.burdenGrossAll) + '）、手取り年収に対して ' + pct(r.burdenNet));
      r.scenarios.forEach(function (s) {
        L.push('- 金利が' + s.delta + '%上がった場合（' + (Math.round(s.rate * 1000) / 1000) + '%）：毎月 ' + yenExact(s.monthly) + '（+' + yenExact(s.diff) + '）、手取りに対して ' + pct(s.burdenNet));
      });
    }
    L.push('- 完済時の年齢：' + r.payoffAge + '歳');
    if (!ex && r.retireBalance !== null) L.push('- ' + r.retireAge + '歳時点の残高：' + yen(r.retireBalance));
    L.push('- 諸費用の目安（物件価格の7〜10%）：' + yen(r.closingLo) + '〜' + yen(r.closingHi));
    L.push(r.fundingGap === null ? '- 資金の過不足：借入額をシートが自動で合わせた（必要額−自己資金）ため、計算していない'
      : '- 資金の過不足（借入＋自己資金 −（物件＋リノベ＋諸費用8.5%））：' + yen(r.fundingGap));
    if (r.cashLeft !== undefined) {
      L.push('- 自己資金を出した後に残るお金：' + yen(r.cashLeft) + (r.emergency !== null ? '（生活費6か月分は ' + yen(r.emergency) + '）' : ''));
    }
    if (r.repairUnit) {
      var g = r.repairGuide;
      L.push('- 修繕積立金の今の月額の㎡単価：' + Math.round(r.repairUnit) + '円/㎡・月' + (g ? '（国交省ガイドライン令和6年6月改定の' + g.label + 'の目安：計画期間全体の平均額で平均' + g.avg + '円、事例の3分の2が' + g.lo + '〜' + g.hi + '円。今の月額とは単純に比べられない）' : ''));
    }
    if (!ex) L.push('- 参考の試算（判定ではない）：手取りの25%・今の金利+2%でも払える借入額：' + yen(r.refLoan));
    if (r.notes.length) {
      L.push('');
      L.push('## 確認したほうがよさそうな点');
      r.notes.forEach(function (n) { L.push('- ' + n); });
    }
    if (r.assumptions.length || ex) {
      L.push('');
      L.push('## 仮定を置いた項目');
      r.assumptions.forEach(function (n) { L.push('- ' + n); });
      if (ex) L.push('- 金利の例：' + RATE_SOURCE);
    }
    L.push('');
    L.push('## いちばん気になっていること');
    L.push(a.worry && String(a.worry).trim() ? String(a.worry).trim() : '（特になし。全体を見て、気をつけるべき点を教えてください）');
    return L.join('\n');
  }

  var api = {
    REPAIR_GUIDE: REPAIR_GUIDE,
    monthlyPayment: monthlyPayment,
    balanceAfter: balanceAfter,
    principalFor: principalFor,
    analyze: analyze,
    analyzeExamples: analyzeExamples,
    RATE_EXAMPLES: RATE_EXAMPLES,
    RATE_SOURCE: RATE_SOURCE,
    buildAiText: buildAiText,
    yen: yen,
    yenExact: yenExact,
    pct: pct
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(this);
