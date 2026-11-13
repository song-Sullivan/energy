// 연료 원단위 검사: 원단위 계산(파이썬으로 따로 계산한 값과 비교), 목표 비교, 연료별 비중, 시간당·누계, 발열량 설정, 저장
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : ' → ' + JSON.stringify(x))); };
const near = (a, b, t) => a != null && Math.abs(a - b) <= t;
const open = store => {
  const errs = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(e.message));
  const dom = new JSDOM(html, { runScripts: 'dangerously', virtualConsole: vc, url: 'http://localhost:8085/', pretendToBeVisual: true,
    beforeParse(w) { if (store) for (const k in store) w.localStorage.setItem(k, store[k]); } });
  const w = dom.window, d = w.document;
  return { w, d, errs, $: id => d.getElementById(id), out: () => d.getElementById('out').textContent };
};
const type = (w, el, v) => { el.value = v; el.dispatchEvent(new w.Event('input')); };
const btn = (d, sel, t) => [...d.querySelectorAll(sel + ' button')].find(b => b.textContent === t);

// 1) 계산 함수 (기대값: 파이썬으로 따로 계산, 2026-11-13)
const A = open(), { w, d, $, out, errs } = A;
let r = w.unit({ NG: [1000, 9150], MG: [5000, 2830], COG: [2000, 4400] }, 100);
ok('NG 1000·MG 5000·COG 2000, 100 t/hr → 321 Mcal/t, 1.3440 GJ/t', near(r.mcal, 321, 1e-9) && near(r.gj, 1.343963, 1e-6) && near(r.heat, 32100, 1e-9), r);
ok('빈 연료는 0으로', near(w.unit({ NG: [null, 9150], MG: [5000, 2830], COG: [null, 4400] }, 50).mcal, 283, 1e-9));
ok('생산량 0 또는 연료 없음 → null', w.unit({ NG: [1000, 9150] }, 0) === null && w.unit({ NG: [null, 9150] }, 10) === null);

// 2) 화면
ok('처음: 시간당, 안내 문구', btn(d, '#modeSeg', '시간당').className === 'on' && out().includes('넣으면'), out());
type(w, $('qNG'), '1000'); type(w, $('qMG'), '5000'); type(w, $('qCOG'), '2000'); type(w, $('prod'), '100');
ok('→ 321 Mcal/t, 1.344 GJ/t, 32.1 Gcal/hr', out().includes('321 Mcal/t') && out().includes('1.344 GJ/t') && out().includes('32.1 Gcal/hr'), out());
ok('연료별: NG 92 Mcal/t 28.5%, MG 142 44.1%, COG 88 27.4%', out().includes('92 Mcal/t28.5%') && out().includes('142 Mcal/t44.1%') && out().includes('88 Mcal/t27.4%'), out());
type(w, $('goal'), '300');
ok('목표 300 → +21 (+7.0%), 2.1 Gcal/hr, NG 230 Nm3/hr 더 씀', out().includes('+21 (+7.0%)') && out().includes('2.1 Gcal/hr') && out().includes('230 Nm3/hr 더 씀'), out());
type(w, $('goal'), '350');
ok('목표 350 → −29, 아낌', out().includes('-29') && out().includes('아낌'), out());
type(w, $('lNG'), '10000');
ok('NG 발열량 10000 → 329.5 → 330 Mcal/t', out().includes('330 Mcal/t'), out());
btn(d, '#modeSeg', '누계 (일·월)').click();
ok('누계로 바꾸면 단위 Nm3·t·Gcal, 입력 그대로', $('prodLbl').textContent === '생산량 (t)' && $('qNG').value === '1000' && out().includes('Gcal ·') && !out().includes('Gcal/hr'), out());
[...d.querySelectorAll('button')].find(b => b.textContent === '설정 전부 기본값으로').click();
ok('설정 기본값 → NG 9150, 목표 비움, 321', $('lNG').value === '9150' && $('goal').value === '' && out().includes('321 Mcal/t'), out());
ok('에러 없음', errs.length === 0, errs);

// 3) 다시 열기
type(w, $('goal'), '310');
const saved = w.localStorage.getItem('unit-calc-v1');
let B = open({ 'unit-calc-v1': saved });
ok('다시 열면 누계·유량·목표 그대로', btn(B.d, '#modeSeg', '누계 (일·월)').className === 'on' && B.$('qMG').value === '5000' && B.$('goal').value === '310' && B.out().includes('321 Mcal/t'), B.out());
[...B.d.querySelectorAll('button')].find(b => b.textContent === '유량·생산량 지우기').click();
ok('[지우기] → 안내 문구', B.out().includes('넣으면') && B.$('qNG').value === '');
B = open({ 'unit-calc-v1': '{깨짐' });
ok('저장소가 깨져 있어도 기본값으로 열림', B.errs.length === 0 && B.$('lCOG').value === '4400');

console.log('합계 OK ' + pass + ' / FAIL ' + fail);
process.exit(fail ? 1 : 0);
