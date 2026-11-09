// 배가스 계산기 검사: 연료별 계산(원소 수지로 따로 계산한 값과 비교), 화면, 예상 범위, 공기 부족, 저장·이어받기, 공유 링크
// REF_HTML=<같은 NG 식을 쓰는 다른 앱의 index.html> 를 주면 그 앱과 NG 결과가 가까운지도 비교 (폰에만 있는 앱이라 경로는 적지 않음)
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ref = process.env.REF_HTML && fs.existsSync(process.env.REF_HTML) ? fs.readFileSync(process.env.REF_HTML, 'utf8') : null;
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : ' → ' + JSON.stringify(x))); };
const near = (a, b, t) => a != null && Math.abs(a - b) <= t;
const open = (store, url) => {
  const errs = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(e.message));
  const dom = new JSDOM(html, { runScripts: 'dangerously', virtualConsole: vc, url: url || 'http://localhost:8082/', pretendToBeVisual: true,
    beforeParse(w) { if (store) for (const k in store) w.localStorage.setItem(k, store[k]); } });
  const w = dom.window, d = w.document;
  return { w, d, errs, $: id => d.getElementById(id), out: () => d.getElementById('out').textContent };
};
const type = (w, el, v) => { el.value = v; el.dispatchEvent(new w.Event('input')); };
const fuelBtn = (d, name) => [...d.querySelectorAll('#fuelSeg button')].find(b => b.textContent === name);

// 1) 계산 함수: 파이썬으로 원소(C·H·O·N) 수지를 따로 세어 낸 값 [건조, 습윤, 공기비] (2026-11-09)
let A = open();
const cases = [
  ['NG', 9150, 100, 1100, 1.857, 1.539, 1.0872],
  ['NG', 9474.15, 100, 1100, 1.106, 0.911, 1.05],
  ['MG', 3150, 1000, 3300, 1.081, 0.885, 1.0554],
  ['MG', 2832, 1000, 3300, 3.036, 2.535, 1.1745],
  ['COG', 4400, 500, 2600, 3.22, 2.586, 1.1611]
];
for (const [k, l, g, a, dry, wet, m] of cases) {
  const r = A.w.flue(g, a, k, l, 21);
  ok(`${k} ${l}kcal ${g}/${a} → 건조 ${dry} 습윤 ${wet} 공기비 ${m}`, near(r.o2, dry, 0.005) && near(r.o2w, wet, 0.005) && near(r.m, m, 0.0005), r && [r.o2, r.o2w, r.m]);
}
ok('COG 500/2200 → 공기 부족(o2 null)', A.w.flue(500, 2200, 'COG', 4400, 21).o2 === null);
ok('습윤 < 건조 (모든 연료)', ['NG', 'MG', 'COG'].every(k => { const r = A.w.flue(100, 100 * A.w.fuelOf(k, A.w.eval('FUELS')[k].lhv).O2 / 0.21 * 1.15, k, A.w.eval('FUELS')[k].lhv, 21); return r.o2w < r.o2; }));
ok('공기 O2 30%(산소부화) → 같은 공기비면 이론공기 줄어듦', A.w.flue(100, 1000, 'NG', 9150, 30).A0 < A.w.flue(100, 1000, 'NG', 9150, 21).A0);

// 2) 화면
const { w, d, $, out, errs } = A;
ok('처음: NG 선택, 기본 9150, 안내 문구', fuelBtn(d, 'NG').className === 'on' && $('lhv').value === '9150' && out().includes('둘 다 넣으면'), [$('lhv').value, out()]);
type(w, $('gas'), '100'); type(w, $('air'), '1100');
ok('NG 100/1100 → 1.9% (예상 범위·습윤·공기비 같이)', out().includes('1.9') && out().includes('예상 범위') && out().includes('습윤 기준 1.5') && out().includes('공기비 1.09'), out());
const rng = out().match(/예상 범위 ([\d.]+) ~ ([\d.]+)/);
ok('예상 범위가 가운데 값을 감쌈', rng && +rng[1] < 1.857 && +rng[2] > 1.857, out());
fuelBtn(d, 'Mixed Gas').click();
ok('Mixed Gas 누르면 기본 2830 (성분 기준 저위, 2026-11-09 3150은 고위로 확인)', $('lhv').value === '2830' && fuelBtn(d, 'Mixed Gas').className === 'on', $('lhv').value);
type(w, $('gas'), '1000'); type(w, $('air'), '3300');
ok('Mixed Gas 2830 1000/3300 → 3.0%, 안내 없음', out().includes('3.0') && !$('info').textContent.includes('고위발열량을 넣은 건'), out());
type(w, $('lhv'), '3150');
ok('고위값 3150을 넣으면 1.1% + 고위 확인 안내', out().includes('1.1') && $('info').textContent.includes('고위발열량을 넣은 건 아닌지'), out());
fuelBtn(d, 'COG').click();
ok('COG 4400 기본, 안내 없음(차이 2%)', $('lhv').value === '4400' && !$('info').textContent.includes('고위발열량을 넣은 건'));
fuelBtn(d, 'Mixed Gas').click();
ok('연료별 발열량 따로 기억 (Mixed Gas 3150 그대로)', $('lhv').value === '3150', $('lhv').value);
[...d.querySelectorAll('.row button')].find(b => b.textContent === '기본값').click();
ok('[기본값] → 2830으로', $('lhv').value === '2830');
type(w, $('air'), '2500');
ok('공기 부족 → 경고 + 필요한 Air', out().includes('공기 부족') && /Air를 [\d,]+ Nm3\/hr/.test(out()), out());
type(w, $('air'), '2865');   // 공기비 약 1.02: 가운데는 괜찮고 -3%면 부족
ok('범위 아래쪽만 공기 부족이면 범위에 표시', out().includes('예상 범위') && out().includes('공기 부족'), out());
type(w, $('err'), '0'); type(w, $('air'), '3300');
ok('오차 0% → 범위 줄 없음', !out().includes('예상 범위'), out());
type(w, $('err'), '5');
ok('오차 5% → 범위 넓어짐', (() => { const m = out().match(/예상 범위 ([\d.]+) ~ ([\d.]+)/); return m && +m[2] - +m[1] > 0.6; })(), out());
ok('에러 없음', errs.length === 0, errs);
const saved = w.localStorage.getItem('flue-calc-v2');

// 3) 다시 열기 (다른 앱 갔다 와서 폰이 앱을 껐어도)
let B = open({ 'flue-calc-v2': saved });
ok('다시 열면 연료·발열량·유량·오차 그대로', fuelBtn(B.d, 'Mixed Gas').className === 'on' && B.$('lhv').value === '2830' && B.$('gas').value === '1000' && B.$('air').value === '3300' && B.$('err').value === '5');
ok('다시 열면 결과 바로 보임', B.out().includes('3.0'), B.out());
B = open({ 'flue-calc-v1': JSON.stringify({ g: '100', a: '1100', lhv: '9200' }) });
ok('첫 버전 값 이어받기 (NG 9200, 유량)', fuelBtn(B.d, 'NG').className === 'on' && B.$('lhv').value === '9200' && B.$('gas').value === '100', [B.$('lhv').value, B.$('gas').value]);
B = open({ 'flue-calc-v2': '{깨짐' });
ok('저장소가 깨져 있어도 기본값으로 열림', B.errs.length === 0 && B.$('lhv').value === '9150');
[...B.d.querySelectorAll('button')].find(b => b.textContent === '설정 전부 기본값으로').click();
ok('설정 전부 기본값', B.$('err').value === '3' && B.$('z').value === '21');

// 4) 공유 링크
B = open(null, 'http://localhost:8082/#fuel=COG&lhv=4300&z=21&e=4');
ok('링크로 열면 COG 4300, 오차 4', fuelBtn(B.d, 'COG').className === 'on' && B.$('lhv').value === '4300' && B.$('err').value === '4', [B.$('lhv').value, B.$('err').value]);
ok('링크 값은 그 폰에 저장되고 주소에서 지워짐', JSON.parse(B.w.localStorage.getItem('flue-calc-v2')).lhv.COG === '4300' && !B.w.location.hash);
let copied = ''; B.w.navigator.clipboard = { writeText: t => { copied = t; return Promise.resolve(); } };
[...B.d.querySelectorAll('button')].find(b => b.textContent.startsWith('이 설정 공유')).click();
ok('[공유] 링크에 연료·발열량·오차', copied.includes('#fuel=COG&lhv=4300&z=21&e=4'), copied);
B = open(null, 'http://localhost:8082/#fuel=XX&lhv=abc');
ok('잘못된 링크는 무시하고 열림', B.errs.length === 0 && fuelBtn(B.d, 'NG').className === 'on');

// 5) 다른 앱과 NG 결과 비교 (REF_HTML을 줬을 때만). 그 앱은 열량당 계수(NG 대표값)라 0.05%p 안이면 같은 것으로 봄
if (ref) {
  const c = new JSDOM(ref, { runScripts: 'dangerously', url: 'http://localhost:8080/', pretendToBeVisual: true, beforeParse(x) { x.scrollTo = () => {}; } }).window;
  let worst = 0;
  for (const lhv of [9150, 9200]) for (const g of [50, 100, 777]) for (const r of [1.02, 1.05, 1.2, 1.6]) {
    const a = g * 1.108 * lhv / 1000 * r; c.eval('cond.lhv = ' + lhv);
    const x = c.eval('flueO2(' + g + ',' + a + ')').o2, y = A.w.flue(g, a, 'NG', lhv, 21).o2; worst = Math.max(worst, Math.abs(x - y));
  }
  ok('REF_HTML 앱과 NG 예상 O2 차이 0.05%p 이내 (최대 ' + worst.toFixed(3) + ')', worst <= 0.05, worst);
} else console.log('     (REF_HTML 없음: 다른 앱과 비교는 건너뜀)');

console.log('합계 OK ' + pass + ' / FAIL ' + fail);
process.exit(fail ? 1 : 0);
