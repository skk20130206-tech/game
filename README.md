# justgame — 2D 우주 탐험

Canvas 2D로 그리는 탑다운 탐험 게임입니다. 행성 지표와 우주 비행, 캐릭터·11종 생명체·자원·기지·유적·시작 화면을 모두 2D로 표현합니다. WebGL이나 외부 3D 라이브러리를 사용하지 않습니다.

5개 행성, 자원 채굴, 기지 건설·업그레이드, 친구와 동행, 15개 유적, 산소·연료, 도감, 공유, 자동 저장과 7단계 튜토리얼을 지원합니다. 기존 저장 파일과 브라우저 저장 기록을 이어 쓸 수 있으며, 예전 비행 고도는 불러올 때 0으로 맞춥니다.

## 실행

```sh
npm run build
npm test
npm run dev
```

`http://localhost:8000/play`에서 게임을 실행합니다. `index.html`은 오프라인 미리보기이고, Cloudflare Worker는 `game/play.txt`와 시작 화면 패치를 조합해 서비스합니다.

## 조작

- WASD / 방향키 / 터치 패드: 이동, Shift: 가속
- 빈 땅 클릭: 이동, 드래그: 지도 둘러보기
- 휠: 확대·축소, V: 확대 / 전체 보기
- E: 채굴·교류·착륙, Q: 스캔, B: 건설
- F: 우주선 이륙·착륙, M: 성계 지도, J: 도감
- R: 연료 합성·비상 충전, X: 화면 효과 설정

진행 상황은 기존 `orbit-frontier-save-v1`에 저장합니다. 저장 파일 가져오기·내보내기도 같은 형식을 사용합니다. 튜토리얼은 `justgame-tutorial-v2`에 따로 저장되며 `?`에서 다시 시작할 수 있습니다.

## 파일

- `game/core.js`: 게임 규칙과 기존 저장 형식
- `game/portraits.js`: 2D 생명체·행성 일러스트
- `game/renderer-2d.js`: Canvas 2D 화면, 카메라, 이펙트, 미니맵
- `game/app.js`, `game/tutorial.js`: 조작과 튜토리얼
- `patch/start-screen-side-ad.txt`: 2D 시작 화면

이전 3D 렌더러와 모델 파일은 이력 보관용으로 남아 있으나 게임 빌드와 Worker에서 불러오지 않습니다.
