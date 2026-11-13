// 온압보정 검산(오리피스) 검사: 보정식(파이썬으로 따로 계산한 값과 비교), 압력 단위, DCS 비교, 원인 추정, 저장
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
let r = w.dp(1000, 40, 5, 20, 10, 'kPa', 101.325);
ok('1000, 40℃·5 kPa (설계 20℃·10 kPa) → 945.562 (×0.945562)', near(r.q, 945.562, 0.001) && near(r.k, 0.945562, 0.000001), r);
ok('kgf/cm² 0.5 (설계 0.4), 20℃ → 1034.298', near(w.dp(1000, 20, 0.5, 20, 0.4, 'kgf/cm²', 101.325).q, 1034.298, 0.001));
ok('대기압 100 kPa → 945.294', near(w.dp(1000, 40, 5, 20, 10, 'kPa', 100).q, 945.294, 0.001));
ok('설계 조건과 같으면 그대로', near(w.dp(500, 20, 10, 20, 10, 'kPa', 101.325).q, 500, 1e-9));
ok('mmAq 1000 = 9.80665 kPa', near(w.eval('absP')(1000, 'mmAq', 0), 9.80665, 1e-9));
ok('절대압 0 이하 → null', w.dp(1000, 20, -200, 20, 0, 'kPa', 101.325) === null);
const g = Object.fromEntries(w.guesses(1000, 40, 5, 20, 10, 'kPa', 101.325));
ok('원인 후보: 압력 보정 없음 967.540, 선형 894.088, 게이지→절대 684.154',
  near(g['압력 보정 없음 (온도만)'], 967.540, 0.001) && near(g['√ 없이 선형으로 보정'], 894.088, 0.001) && near(g['게이지압을 절대압으로 처리'], 684.154, 0.001), g);

// 2) 화면
ok('처음: 설계 기본 20℃·0, 안내', $('td').value === '20' && $('pd').value === '0' && out().includes('넣으면'), out());
type(w, $('pd'), '10');
type(w, $('q'), '1000'); type(w, $('t'), '40'); type(w, $('p'), '5');
ok('→ 945.6 Nm3/hr, 보정계수, 설계 조건', out().includes('945.6') && out().includes('×0.9456') && out().includes('설계 111.33 kPa'), out());
type(w, $('dcs'), '948');
ok('DCS 948 → +0.26% 거의 같음', out().includes('+0.26%') && out().includes('거의 같음'), out());
type(w, $('dcs'), '965');
ok('DCS 965 → +2.06% 조금 차이 + 압력 보정 없음 추정', out().includes('조금 차이') && out().includes('압력 보정 없음'), out());
type(w, $('dcs'), '894.1');
ok('DCS 894.1 → 차이 큼 + √ 없이 선형 보정 추정', out().includes('차이 큼') && out().includes('√ 없이'), out());
type(w, $('dcs'), '684');
ok('DCS 684 → 게이지압을 절대압으로 처리 추정', out().includes('게이지압을 절대압으로'), out());
type(w, $('dcs'), '800');
ok('DCS 800 → 흔한 원인으로 설명 안 됨', out().includes('설명이 안 돼요'), out());
type(w, $('pd'), '');
ok('설계 압력 비우면 안내', out().includes('설계 온도·압력을 넣어'), out());
type(w, $('pd'), '0'); type(w, $('dcs'), '900');
ok('설계 압력 0일 때도 에러 없이 비교', out().includes('DCS 900') && errs.length === 0, [out(), errs]);
btn(d, '#unitSeg', 'kgf/cm²').click();
type(w, $('t'), '20'); type(w, $('td'), '20'); type(w, $('p'), '0.5'); type(w, $('pd'), '0.4'); type(w, $('dcs'), '');
ok('kgf/cm² 0.5 (설계 0.4) → 1,034.3, 라벨 단위', out().includes('1,034.3') && $('pLbl').textContent.includes('kgf/cm²') && $('pdLbl').textContent.includes('kgf/cm²'), out());
ok('에러 없음', errs.length === 0, errs);

// 3) 다시 열기
const saved = w.localStorage.getItem('flow-calc-v1');
let B = open({ 'flow-calc-v1': saved });
ok('다시 열면 단위·설계 조건·입력 그대로', btn(B.d, '#unitSeg', 'kgf/cm²').className === 'on' && B.$('pd').value === '0.4' && B.out().includes('1,034.3'), B.out());
B.$('patm').value = '90'; B.$('patm').dispatchEvent(new B.w.Event('input'));
ok('대기압 바꾸면 결과 바뀜', !B.out().includes('1,034.3'), B.out());
[...B.d.querySelectorAll('button')].find(b => b.textContent === '설정 전부 기본값으로').click();
ok('설정 기본값: 대기압 101.325, kPa, 설계 20℃·0', B.$('patm').value === '101.325' && btn(B.d, '#unitSeg', 'kPa').className === 'on' && B.$('td').value === '20' && B.$('pd').value === '0');
B = open({ 'flow-calc-v1': JSON.stringify({ type: 'vol', q: '1000' }) });
ok('예전(체적식) 저장값이 있어도 에러 없이 열림', B.errs.length === 0 && B.$('q').value === '1000');
B = open({ 'flow-calc-v1': '{깨짐' });
ok('저장소가 깨져 있어도 기본값으로 열림', B.errs.length === 0 && B.$('patm').value === '101.325');

console.log('합계 OK ' + pass + ' / FAIL ' + fail);
process.exit(fail ? 1 : 0);
