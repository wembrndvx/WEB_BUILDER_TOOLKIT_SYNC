# Simple3DStatus

3D 컴포넌트에서 장비 상태를 mesh의 material color로 표시하는 RNBT 예제 프로젝트입니다.

## 설계 의도: 서버-모델링 분리

### 문제

- 서버는 클라이언트의 3D 모델링 상황을 모릅니다
- 모델링의 mesh 이름은 모델러가 결정하며, 서버와 무관합니다
- 둘을 직접 연결하면 결합도가 높아져 변경이 어렵습니다

### 해결: Config 기반 매핑

```
서버 (id, status, color)
        ↓ ID
Config (id ↔ meshName 매핑)  ← 변화 가능 영역
        ↓ meshName
모델링 (mesh)
```

- **연결 키**: ID (서버와 모델링의 유일한 접점)
- **매핑 제공**: Configuration 또는 별도 API
- **결과**: 서버는 모델링을 모르고, 모델링은 서버를 모릅니다

### 구현

```javascript
// Equipment3D/scripts/register.js
this.meshStatusConfig = [
    { meshName: 'Rack_A', equipmentId: 'eq-001' },
    { meshName: 'Cooling_01', equipmentId: 'eq-003' },
    // meshName: 클라이언트 3D 모델의 mesh 이름 (모델러가 결정)
    // equipmentId: 서버 데이터의 ID
];
```

config만 수정하면 다른 모델링이나 다른 서버에도 적용 가능합니다.

## 구조

```
Simple3DStatus/
├── mock_server/                    # Express API 서버
│   ├── server.js
│   └── package.json
│
├── master/                         # MASTER 레이어 (앱 전역)
│   └── page/
│       ├── page_scripts/
│       │   ├── before_load.js
│       │   ├── loaded.js
│       │   └── before_unload.js
│       ├── page_styles/container.css
│       └── components/
│           ├── Header/             # 사용자 정보 헤더
│           └── Sidebar/            # 네비게이션 + 상태 범례
│
├── page/                           # PAGE 레이어 (페이지별)
│   ├── page_scripts/
│   │   ├── before_load.js          # 3D raycasting 초기화
│   │   ├── loaded.js               # 장비 상태 데이터 발행
│   │   └── before_unload.js        # 3D 리소스 정리
│   ├── page_styles/container.css
│   └── components/
│       └── Equipment3D/            # 3D 장비 상태 컴포넌트
│
├── datasetList.json                # API 엔드포인트 정의
├── preview.html                    # 전체 레이아웃 프리뷰
└── README.md
```

## 실행 방법

### 1. Mock Server 실행

```bash
cd mock_server
npm install
npm start
```

서버가 http://localhost:4006 에서 실행됩니다.

### 2. Preview 확인

`preview.html`을 브라우저에서 열어 레이아웃을 확인합니다.

> Note: preview.html은 정적 미리보기입니다. 실제 3D 렌더링은 런타임에서 Three.js로 수행됩니다.

## API 엔드포인트

| Endpoint | Layer | Component | 설명 |
|----------|-------|-----------|------|
| GET /api/user | MASTER | Header | 사용자 정보 |
| GET /api/menu | MASTER | Sidebar | 네비게이션 메뉴 |
| GET /api/equipment/status | PAGE | Equipment3D | 전체 장비 상태 (5초 갱신) |
| GET /api/equipment/:id | PAGE | 클릭 핸들러 | 장비 상세 정보 |

## 상태 타입

| Status | Color | 의미 |
|--------|-------|------|
| normal | #4CAF50 (Green) | 정상 |
| warning | #FF9800 (Orange) | 경고 |
| error | #F44336 (Red) | 오류 |
| offline | #9E9E9E (Gray) | 오프라인 |

## Equipment3D 컴포넌트 패턴

### 1. Mesh Status Config

```javascript
const meshStatusConfig = [
    { meshName: 'Rack_A', equipmentId: 'eq-001' },
    // meshName: Three.js Object3D.name
    // equipmentId: API 응답의 id 필드
];
```

### 2. Material Color 업데이트 (파이프라인 패턴)

```javascript
function updateMeshStatus(meshStatusConfig, { response }) {
    const { data } = response;
    const mainGroup = this.appendElement;

    fx.go(
        meshStatusConfig,
        fx.map(cfg => ({ cfg, equipment: data.find(eq => eq.id === cfg.equipmentId) })),
        fx.filter(({ equipment }) => equipment),
        fx.map(({ cfg, equipment }) => ({
            ...cfg,
            equipment,
            mesh: mainGroup.getObjectByName(cfg.meshName)
        })),
        fx.filter(({ mesh }) => mesh),
        fx.each(ctx => applyMeshColor.call(this, ctx))
    );
}
```

### 3. 3D 이벤트 처리 (모나드 합성 패턴)

```javascript
// 컴포넌트: 이벤트 발행
this.customEvents = {
    click: '@3dObjectClicked'
};

// 페이지: 이벤트 핸들러
'@3dObjectClicked': async ({ event: { intersects }, targetInstance: { datasetInfo, meshStatusConfig } }) => {
    go(
        intersects,
        fx.filter(intersect => fx.find(c => c.meshName === intersect.object.name, meshStatusConfig)),
        fx.each(target => fx.go(
            datasetInfo,
            fx.map(info => ({ datasetName: info.datasetName, param: info.getParam(target.object, meshStatusConfig) })),
            fx.filter(({ param }) => param),
            fx.each(({ datasetName, param }) => Wkit.fetchData(this, datasetName, param))
        ))
    )
}
```

## 라이프사이클

```
[페이지 로드]
  MASTER before_load → 이벤트 핸들러 등록
    ↓
  PAGE before_load → 3D raycasting 초기화
    ↓
  컴포넌트 register → Equipment3D subscribe(equipmentStatus)
    ↓
  PAGE loaded → equipmentStatus 발행 시작 (5초 interval)
    ↓
  Equipment3D.updateMeshStatus() → mesh color 업데이트

[3D 클릭]
  canvas click → raycasting → @3dObjectClicked
    ↓
  페이지 핸들러 → fetchData(equipmentDetailApi) → 상세 처리

[페이지 언로드]
  PAGE before_unload
    → stopAllIntervals()
    → raycasting cleanup
    → disposeAllThreeResources()
```

## 설계 분석: datasetInfo 확장

### 자유로운 메소드 구현

datasetInfo에 필요한 메소드를 자유롭게 추가할 수 있습니다:

```javascript
this.datasetInfo = [
    {
        datasetName: 'equipmentDetailApi',
        getParam: (obj, config) => { ... },  // 이 예제의 방식
        validate: (obj) => { ... },          // 필요하면 추가 가능
    }
];
```

### param key가 필수인 경우

런타임 API가 `param` key를 직접 참조할 때:

```javascript
// fetchAndPublish 내부에서 datasetInfo[0].param을 사용하는 경우
fetchAndPublish(this, datasetName, datasetInfo[0].param);
```

이 예제에서는 `getParam` 함수로 param을 생성한 후 전달하므로 `param` key 불필요

## 확장 포인트

1. **상세 팝업**: `@3dObjectClicked` 핸들러에서 PopupMixin 패턴으로 상세 정보 표시
2. **호버 효과**: `mousemove` 이벤트 추가하여 호버 시 하이라이트
3. **필터링**: 상태별 필터 UI 추가하여 특정 상태만 강조
4. **애니메이션**: 상태 변경 시 tween 애니메이션으로 색상 전환
