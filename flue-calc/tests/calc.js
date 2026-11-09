// 배가스 계산기 검사: 화면 값, 공기 부족, 다시 열 때 값 유지
// REF_HTML=<같은 flueO2 식을 쓰는 다른 앱의 index.html> 를 주면 그 앱과 답이 같은지도 비교 (폰에만 있는 앱이라 경로는 적지 않음)
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ref = process.env.REF_HTML && fs.existsSync(process.env.REF_HTML) ? fs.readFileSync(process.env.REF_HTML, 'utf8') : null;
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : ' → ' + JSON.stringify(x))); };
const open = (store) => {
  const errs = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(e.message));
  const dom = new JSDOM(html, { runScripts: 'dangerously', virtualConsole: vc, url: 'http://localhost:8082/', pretendToBeVisual: true,
    beforeParse(w) { if (store) for (const k in store) w.localStorage.setItem(k, store[k]); } });
  return { w: dom.window, d: dom.window.document, errs };
};
const type = (w, el, v) => { el.value = v; el.dispatchEvent(new w.Event('input')); };

let { w, d, errs } = open();
const $ = id => d.getElementById(id), out = () => $('out').textContent;
ok('처음: 안내 문구', out().includes('둘 다 넣으면'), out());
ok('발열량 기본 9150', $('lhv').value === '9150', $('lhv').value);
type(w, $('gas'), '100'); ok('Gas만: 아직 안내', out().includes('둘 다 넣으면'), out());
type(w, $('air'), '1100'); ok('100/1100 → 1.8%, 공기비 1.09', out().includes('1.8') && out().includes('공기비 1.09'), out());
type(w, $('air'), '900'); ok('100/900 → 공기 부족 + 필요한 Air 1,014', out().includes('공기 부족') && out().includes('1,014'), out());
type(w, $('gas'), '1,000'); type(w, $('air'), '12000'); ok('쉼표 숫자 1,000/12000 → 3.6%', out().includes('3.6'), out());
type(w, $('lhv'), '9200'); ok('발열량 9200 → 3.5% (손계산 3.46)', out().includes('3.5'), out());
type(w, $('gas'), '-5'); ok('음수 → 안내', out().includes('둘 다 넣으면'), out());
type(w, $('gas'), '1000');
const saved = w.localStorage.getItem('flue-calc-v1');
ok('에러 없음', errs.length === 0, errs);

// 다른 앱 갔다 와서 다시 열었을 때(앱이 꺼졌어도) 값 유지
({ w, d, errs } = open({ 'flue-calc-v1': saved }));
ok('다시 열면 값 유지', d.getElementById('gas').value === '1000' && d.getElementById('air').value === '12000' && d.getElementById('lhv').value === '9200', saved);
ok('다시 열면 결과 바로 보임', d.getElementById('out').textContent.includes('3.5'), d.getElementById('out').textContent);
d.querySelector('button').click();
ok('지우기 → 유량만 비움, 발열량 유지', d.getElementById('gas').value === '' && d.getElementById('air').value === '' && d.getElementById('lhv').value === '9200');
ok('저장소가 깨져 있어도 열림', (() => { const r = open({ 'flue-calc-v1': '{깨짐' }); return r.errs.length === 0 && r.d.getElementById('lhv').value === '9150'; })());

// 다른 앱과 같은 답 (REF_HTML을 줬을 때만, 60가지 조합)
if (ref) {
  const c = new JSDOM(ref, { runScripts: 'dangerously', url: 'http://localhost:8080/', pretendToBeVisual: true, beforeParse(x) { x.scrollTo = () => {}; } }).window;
  let same = true, bad = null;
  for (const lhv of [9150, 9200, 8800]) for (const g of [50, 100, 777, 1500]) for (const r of [0.95, 1.0, 1.05, 1.2, 1.6]) {
    const a = g * 1.108 * lhv / 1000 * r;
    c.eval('cond.lhv = ' + lhv);
    const x = c.eval('flueO2(' + g + ',' + a + ')'), y = w.flueO2(g, a, lhv);
    if (JSON.stringify(x) !== JSON.stringify(y)) { same = false; bad = { lhv, g, a, x, y }; }
  }
  ok('REF_HTML 앱의 flueO2와 60가지 조합 같은 답', same, bad);
} else console.log('     (REF_HTML 없음: 다른 앱과 비교는 건너뜀)');

console.log('합계 OK ' + pass + ' / FAIL ' + fail);
process.exit(fail ? 1 : 0);
