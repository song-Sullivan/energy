# energy

연소설비의 공학적 개념을 다루는 작은 도구 모음. 폰 브라우저에서 바로 쓰고, 홈 화면에 앱으로 설치할 수 있어요.

| 도구 | 하는 일 | 열기 |
|---|---|---|
| [배가스 계산기](flue-calc/) | 연료(NG·Mixed Gas·COG)와 Gas·Air 유량(Nm3/hr) → 예상 배가스 O2(건조·습윤)와 예상 범위, 공기비 | https://song-sullivan.github.io/energy/flue-calc/ |

## 폴더 규칙
- 도구 하나 = 폴더 하나 (`index.html` 하나로 동작, 외부 라이브러리 없음)
- 검사는 각 폴더의 `tests/run-all.sh` (jsdom 필요)
- 실제 설비 번호·실측값은 넣지 않고 일반적인 연소 공학 개념만 다룸
