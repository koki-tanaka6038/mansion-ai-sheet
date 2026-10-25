// マンション購入 AI相談シート v0.1 — 計算と「AIに渡す文章」の組み立て
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
    var otherDebt = num(a.otherDebtMonthly) !== null ? num(a.otherDebtMonthly) * 12 : (num(a.otherDebt) || 0) * man;

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
    if (num(a.retireAge) === null) assumptions.push('退職予定年齢は不明のため65歳と仮定');
    res.payoffAge = age + years;
    var monthsToRetire = (retire - age) * 12;
    res.retireAge = retire;
    res.retireBalance = monthsToRetire > 0 ? Math.max(0, balanceAfter(loan, rate, years, monthsToRetire)) : null;

    // 住居費（ローン＋管理費＋修繕積立金）
    var mgmt = num(a.mgmtFee) || 0;
    var repair = num(a.repairFee) || 0;
    res.runningMonthly = mgmt + repair;
    res.housingMonthly = m + mgmt + repair;

    // 諸費用の目安（中古マンションは物件価格の7〜10%が一般的な目安）
    var price = num(a.price) * man;
    var reno = (num(a.renoCost) || 0) * man;
    res.closingLo = price * 0.07;
    res.closingHi = price * 0.10;

    // 資金の過不足（諸費用は中央値8.5%で概算）
    var own = (num(a.ownFunds) || 0) * man;
    var need = price + reno + price * 0.085;
    res.fundingGap = loan + own - need; // マイナスなら不足
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
  function buildAiText(a, r, today) {
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
    L.push('- 子ども：' + val(a.kids, '人') + (Number(a.kids) > 0 ? '（末っ子 ' + val(a.youngestAge, '歳') + '）' : ''));
    L.push('- 世帯の額面年収：' + val(a.grossIncome, '万円'));
    L.push('- 世帯の手取り年収：' + val(a.netIncome, '万円'));
    L.push(num(a.otherDebtMonthly) !== null || num(a.otherDebt) === null
      ? '- 住宅以外の借入の毎月の返済額：' + val(a.otherDebtMonthly || 0, '円')
      : '- 住宅以外の借入の年間返済額：' + val(a.otherDebt, '万円'));
    L.push('- 生活費（住居費を除く・月）：' + val(a.living, '万円'));
    L.push('- 預貯金・投資の合計：' + val(a.assets, '万円'));
    L.push('- 退職予定年齢：' + val(a.retireAge, '歳'));
    L.push('');
    L.push('## 物件');
    L.push('- 物件価格：' + val(a.price, '万円'));
    L.push('- 専有面積：' + val(a.area, '㎡'));
    L.push('- 建築年：' + val(a.builtYear, '年'));
    L.push('- 建物の規模：' + (LABELS.scale[a.scale] || '不明'));
    L.push('- 管理費（月）：' + val(a.mgmtFee, '円'));
    L.push('- 修繕積立金（月）：' + val(a.repairFee, '円'));
    L.push('- リノベーション費用：' + val(a.renoCost || 0, '万円'));
    L.push('');
    L.push('## 資金計画');
    L.push('- 自己資金として出す額：' + val(a.ownFunds, '万円'));
    L.push('- 借入額：' + val(a.loan, '万円'));
    L.push('- 返済期間：' + val(a.years, '年'));
    L.push('- 金利：' + val(a.rate, '%') + '（' + (LABELS.rateType[a.rateType] || '不明') + '）');
    L.push('');
    L.push('## シートの計算結果（元利均等返済）');
    L.push('- 毎月の返済額：' + yenExact(r.monthly) + '（年間 ' + yen(r.annual) + '）');
    L.push('- 総返済額：' + yen(r.total) + '（うち利息 ' + yen(r.interest) + '）');
    L.push('- 管理費・修繕積立金を足した月の住居費：' + yenExact(r.housingMonthly));
    L.push('- 返済負担率：額面年収に対して ' + pct(r.burdenGross) + '（他の借入込み ' + pct(r.burdenGrossAll) + '）、手取り年収に対して ' + pct(r.burdenNet));
    r.scenarios.forEach(function (s) {
      L.push('- 金利が' + s.delta + '%上がった場合（' + (Math.round(s.rate * 1000) / 1000) + '%）：毎月 ' + yenExact(s.monthly) + '（+' + yenExact(s.diff) + '）、手取りに対して ' + pct(s.burdenNet));
    });
    L.push('- 完済時の年齢：' + r.payoffAge + '歳');
    if (r.retireBalance !== null) L.push('- ' + r.retireAge + '歳時点の残高：' + yen(r.retireBalance));
    L.push('- 諸費用の目安（物件価格の7〜10%）：' + yen(r.closingLo) + '〜' + yen(r.closingHi));
    L.push('- 資金の過不足（借入＋自己資金 −（物件＋リノベ＋諸費用8.5%））：' + yen(r.fundingGap));
    if (r.cashLeft !== undefined) {
      L.push('- 自己資金を出した後に残るお金：' + yen(r.cashLeft) + (r.emergency !== null ? '（生活費6か月分は ' + yen(r.emergency) + '）' : ''));
    }
    if (r.repairUnit) {
      var g = r.repairGuide;
      L.push('- 修繕積立金の今の月額の㎡単価：' + Math.round(r.repairUnit) + '円/㎡・月' + (g ? '（国交省ガイドライン令和6年6月改定の' + g.label + 'の目安：計画期間全体の平均額で平均' + g.avg + '円、事例の3分の2が' + g.lo + '〜' + g.hi + '円。今の月額とは単純に比べられない）' : ''));
    }
    L.push('- 参考の試算（判定ではない）：手取りの25%・今の金利+2%でも払える借入額：' + yen(r.refLoan));
    if (r.notes.length) {
      L.push('');
      L.push('## 確認したほうがよさそうな点');
      r.notes.forEach(function (n) { L.push('- ' + n); });
    }
    if (r.assumptions.length) {
      L.push('');
      L.push('## 仮定を置いた項目');
      r.assumptions.forEach(function (n) { L.push('- ' + n); });
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
    buildAiText: buildAiText,
    yen: yen,
    yenExact: yenExact,
    pct: pct
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(this);
