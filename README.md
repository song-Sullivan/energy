# energy

연소설비의 공학적 개념을 다루는 작은 도구 모음. 폰 브라우저에서 바로 쓰고, 홈 화면에 앱으로 설치할 수 있어요.

| 도구 | 하는 일 | 열기 |
|---|---|---|
| [배가스 계산기](flue-calc/) | 연료(NG·Mixed Gas·COG)와 Gas·Air 유량(Nm3/hr) → 예상 배가스 O2(건조·습윤)와 예상 범위, 공기비 | https://song-sullivan.github.io/energy/flue-calc/ |
| [NOx·CO 산소 환산](emis-calc/) | 측정 농도(ppm)·측정 O2 → 기준 O2 환산값과 mg/Sm3, 과잉공기 가중, 배출 기준 대비 % | https://song-sullivan.github.io/energy/emis-calc/ |
| [온압보정 검산](flow-calc/) | 보정 전 유량·온도·압력(체적식·차압식) → Nm3/hr를 직접 계산해 DCS 보정값과 비교, 안 맞으면 흔한 원인 추정 | https://song-sullivan.github.io/energy/flow-calc/ |
| [연료 원단위](unit-calc/) | NG·Mixed Gas·COG 유량·발열량, 생산량(시간당·누계) → Mcal/t, GJ/t, 연료별 비중, 목표 대비 | https://song-sullivan.github.io/energy/unit-calc/ |

## 폴더 규칙
- 도구 하나 = 폴더 하나 (`index.html` 하나로 동작, 외부 라이브러리 없음)
- 검사는 각 폴더의 `tests/run-all.sh` (jsdom 필요)
- 실제 설비 번호·실측값은 넣지 않고 일반적인 연소 공학 개념만 다룸
