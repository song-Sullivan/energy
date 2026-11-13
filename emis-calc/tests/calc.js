// NOx·CO 산소 환산 검사: 환산식(파이썬으로 따로 계산한 값과 비교), 과잉공기 가중, 기준보다 낮은 O2 처리, 배출 기준, 저장
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : ' → ' + JSON.stringify(x))); };
const near = (a, b, t) => a != null && Math.abs(a - b) <= t;
const open = store => {
  const errs = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(e.message));
  const dom = new JSDOM(html, { runScripts: 'dangerously', virtualConsole: vc, url: 'http://localhost:8083/', pretendToBeVisual: true,
    beforeParse(w) { if (store) for (const k in store) w.localStorage.setItem(k, store[k]); } });
  const w = dom.window, d = w.document;
  return { w, d, errs, $: id => d.getElementById(id), out: () => d.getElementById('out').textContent };
};
const type = (w, el, v) => { el.value = v; el.dispatchEvent(new w.Event('input')); };
const btn = (d, sel, t) => [...d.querySelectorAll(sel + ' button')].find(b => b.textContent === t);

// 1) 계산 함수 (기대값: 파이썬으로 따로 계산, 2026-11-13)
const A = open(), { w, d, $, out, errs } = A;
let r = w.corr(100, 15, 11, 'keep');
ok('100ppm, O2 15%, 기준 11% → 166.667 (×1.667)', near(r.c, 166.667, 0.001) && near(r.k, 1.6667, 0.0001), r);
ok('mg/Sm3: NOx(NO2 46.01) 166.667ppm → 342.12', near(w.eval("mg")(166.667, 46.01), 342.12, 0.01));
r = w.corr(100, 8, 11, 'keep');
ok('O2 8% < 기준 11%, "그대로" → 100 (보정 안 함)', r.c === 100 && r.keep, r);
r = w.corr(100, 8, 11, 'both');
ok('O2 8% < 기준 11%, "식대로" → 76.923', near(r.c, 76.923, 0.001) && !r.keep, r);
ok('O2 = 기준 → 그대로', w.corr(80, 11, 11, 'keep').c === 80);
ok('O2 21% 이상 → 입력 오류', w.corr(100, 21, 11, 'keep').bad === true);
ok('빈 칸 → null', w.corr(null, 15, 11, 'keep') === null);

// 2) 화면
ok('처음: NOx 선택, 기준 11, 안내 문구', btn(d, '#subSeg', 'NOx').className === 'on' && $('os').value === '11' && out().includes('넣으면'), out());
type(w, $('c'), '100'); type(w, $('oa'), '15');
ok('NOx 100/15% → 166.7 ppm, 342 mg/Sm3, 과잉공기 가중 ×1.67', out().includes('166.7') && out().includes('342 mg/Sm3') && out().includes('과잉공기') && out().includes('×1.67'), out());
type(w, $('lim'), '150');
ok('배출 기준 150 → 111% 초과, 측정값 90.0 ppm 넘으면 초과', out().includes('111%') && out().includes('초과') && out().includes('90.0 ppm을 넘으면'), out());
type(w, $('oa'), '8');
ok('O2 8% → 보정 안 함 100.0 ppm', out().includes('100.0') && out().includes('보정 안 함'), out());
btn(d, '#lowSeg', '식대로 환산').click();
ok('설정 "식대로" → 76.9 ppm (작아짐)', out().includes('76.9') && out().includes('작아짐'), out());
btn(d, '#subSeg', 'CO').click();
ok('CO로 바꾸면 배출 기준 칸은 CO 것(비어 있음)', $('lim').value === '' && $('limLbl').textContent.startsWith('CO'), $('lim').value);
type(w, $('c'), '50'); type(w, $('oa'), '13');
ok('CO 50/13% → 62.5 ppm, 78 mg/Sm3', out().includes('62.5') && out().includes('78 mg/Sm3'), out());
type(w, $('oa'), '19');
ok('O2 19% → 높음 경고', out().includes('매우 높아'), out());
type(w, $('oa'), '22');
ok('O2 22% → 입력 확인', out().includes('입력 확인'), out());
type(w, $('os'), '');
ok('기준 O2 비우면 안내', out().includes('기준 O2를 넣어'), out());
type(w, $('os'), '6'); type(w, $('oa'), '13');
ok('기준 6%로 바꾸면 50×15/8 = 93.8', out().includes('93.8'), out());
ok('에러 없음', errs.length === 0, errs);

// 3) 다시 열기
const saved = w.localStorage.getItem('emis-calc-v1');
let B = open({ 'emis-calc-v1': saved });
ok('다시 열면 CO·기준 6·식대로·입력 그대로', btn(B.d, '#subSeg', 'CO').className === 'on' && B.$('os').value === '6' && btn(B.d, '#lowSeg', '식대로 환산').className === 'on' && B.$('c').value === '50' && B.out().includes('93.8'), B.out());
btn(B.d, '#subSeg', 'NOx').click();
ok('NOx 배출 기준 150 기억', B.$('lim').value === '150');
[...B.d.querySelectorAll('button')].find(b => b.textContent === '설정 전부 기본값으로').click();
ok('설정 기본값: 기준 11, 그대로, 배출 기준 비움', B.$('os').value === '11' && btn(B.d, '#lowSeg', '측정값 그대로').className === 'on' && B.$('lim').value === '');
B = open({ 'emis-calc-v1': '{깨짐' });
ok('저장소가 깨져 있어도 기본값으로 열림', B.errs.length === 0 && B.$('os').value === '11');

console.log('합계 OK ' + pass + ' / FAIL ' + fail);
process.exit(fail ? 1 : 0);
