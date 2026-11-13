// 온압보정 검산 검사: 체적식·차압식 식(파이썬으로 따로 계산한 값과 비교), 압력 단위, DCS 비교, 원인 추정, 저장
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : ' → ' + JSON.stringify(x))); };
const near = (a, b, t) => a != null && Math.abs(a - b) <= t;
const open = store => {
  const errs = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(e.message));
  const dom = new JSDOM(html, { runScripts: 'dangerously', virtualConsole: vc, url: 'http://localhost:8084/', pretendToBeVisual: true,
    beforeParse(w) { if (store) for (const k in store) w.localStorage.setItem(k, store[k]); } });
  const w = dom.window, d = w.document;
  return { w, d, errs, $: id => d.getElementById(id), out: () => d.getElementById('out').textContent };
};
const type = (w, el, v) => { el.value = v; el.dispatchEvent(new w.Event('input')); };
const btn = (d, sel, t) => [...d.querySelectorAll(sel + ' button')].find(b => b.textContent === t);

// 1) 계산 함수 (기대값: 파이썬으로 따로 계산, 2026-11-13)
const A = open(), { w, d, $, out, errs } = A;
let r = w.vol(1000, 40, 5, 'kPa', 101.325, 0);
ok('체적식 1000 m3/hr, 40℃, 5 kPa g → 915.309 Nm3/hr', near(r.q, 915.309, 0.001) && near(r.k, 0.915309, 0.000001), r);
ok('체적식 0.5 kgf/cm² g, 25℃ → 1359.493', near(w.vol(1000, 25, 0.5, 'kgf/cm²', 101.325, 0).q, 1359.493, 0.001));
ok('체적식 0℃, 0 kPa g → 그대로 1000', near(w.vol(1000, 0, 0, 'kPa', 101.325, 0).q, 1000, 1e-9));
ok('mmAq 1000 = 9.80665 kPa', near(w.eval("absP")(1000, 'mmAq', 0), 9.80665, 1e-9));
r = w.dp(1000, 40, 5, 20, 10, 'kPa', 101.325);
ok('차압식 1000, 40℃·5 kPa (설계 20℃·10 kPa) → 945.562', near(r.q, 945.562, 0.001), r);
ok('차압식 설계 조건과 같으면 그대로', near(w.dp(500, 20, 10, 20, 10, 'kPa', 101.325).q, 500, 1e-9));
ok('절대압 0 이하 → null', w.vol(1000, 20, -200, 'kPa', 101.325, 0) === null);

// 2) 화면: 체적식
ok('처음: 체적식, 설계 칸 숨김, 안내', btn(d, '#typeSeg', '체적식').className === 'on' && $('dsgBox').className.includes('hide') && out().includes('넣으면'), out());
type(w, $('q'), '1000'); type(w, $('t'), '40'); type(w, $('p'), '5');
ok('1000/40℃/5 kPa → 915.3 Nm3/hr, 보정계수', out().includes('915.3') && out().includes('×0.9153'), out());
type(w, $('dcs'), '918');
ok('DCS 918 → +0.29% 거의 같음', out().includes('+0.29%') && out().includes('거의 같음'), out());
type(w, $('dcs'), '982.3');
ok('DCS 982.3 → 차이 큼 + 기준온도 20℃로 추정', out().includes('차이 큼') && out().includes('기준온도 20℃'), out());
type(w, $('dcs'), '872.2');   // 1000 × 273.15/313.15 = 872.27 → 압력 보정 누락
ok('DCS 872.2 → 압력 보정 없음으로 추정', out().includes('압력 보정 없음'), out());
type(w, $('dcs'), '700');
ok('DCS 700 → 흔한 원인으로 설명 안 됨', out().includes('설명이 안 돼요'), out());
btn(d, '#unitSeg', 'kgf/cm²').click();
type(w, $('p'), '0.5'); type(w, $('t'), '25'); type(w, $('dcs'), '');
ok('kgf/cm² 0.5, 25℃ → 1,359.5', out().includes('1,359.5') && $('pLbl').textContent.includes('kgf/cm²'), out());

// 3) 차압식
btn(d, '#unitSeg', 'kPa').click();
btn(d, '#typeSeg', '차압식').click();
ok('차압식: 설계 칸 보임, 라벨 Nm3/hr', !$('dsgBox').className.includes('hide') && $('qLbl').textContent.includes('Nm3/hr'));
type(w, $('td'), '20'); type(w, $('pd'), '10');
type(w, $('t'), '40'); type(w, $('p'), '5');
ok('차압식 1000, 40℃·5 kPa (설계 20℃·10 kPa) → 945.6', out().includes('945.6') && out().includes('설계'), out());
type(w, $('dcs'), '894.1');
ok('DCS 894.1 → √ 없이 선형 보정으로 추정', out().includes('√ 없이'), out());
type(w, $('pd'), '');
ok('설계 압력 비우면 안내', out().includes('설계 온도·압력이 필요'), out());
type(w, $('pd'), '10');
ok('에러 없음', errs.length === 0, errs);

// 4) 다시 열기
const saved = w.localStorage.getItem('flow-calc-v1');
let B = open({ 'flow-calc-v1': saved });
ok('다시 열면 차압식·설계 조건·입력 그대로', btn(B.d, '#typeSeg', '차압식').className === 'on' && B.$('td').value === '20' && B.$('pd').value === '10' && B.out().includes('945.6'), B.out());
B.$('patm').value = '100'; B.$('patm').dispatchEvent(new B.w.Event('input'));
ok('대기압 바꾸면 결과 바뀜', !B.out().includes('945.6'), B.out());
[...B.d.querySelectorAll('button')].find(b => b.textContent === '설정 전부 기본값으로').click();
ok('설정 기본값: 대기압 101.325, kPa', B.$('patm').value === '101.325' && btn(B.d, '#unitSeg', 'kPa').className === 'on');
B = open({ 'flow-calc-v1': '{깨짐' });
ok('저장소가 깨져 있어도 기본값으로 열림', B.errs.length === 0 && btn(B.d, '#typeSeg', '체적식').className === 'on');

console.log('합계 OK ' + pass + ' / FAIL ' + fail);
process.exit(fail ? 1 : 0);
