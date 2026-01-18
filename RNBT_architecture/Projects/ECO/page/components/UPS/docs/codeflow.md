# UPS 컴포넌트 코드 흐름

## 개요

UPS(Uninterruptible Power Supply) 컴포넌트는 3D 환경에서 사용되는 **팝업 컴포넌트(Component With Popup)**입니다. Shadow DOM 팝업을 통해 UPS 상세 정보와 히스토리 차트를 표시합니다.

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│  UPS Component With Popup                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ Shadow DOM  │    │  ECharts    │    │  fetchData  │         │
│  │   Popup     │    │   Mixin     │    │   (API)     │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                  │                  │                 │
│         └──────────┬───────┴──────────┬──────┘                 │
│                    │                  │                         │
│              ┌─────▼─────┐      ┌─────▼─────┐                  │
│              │  Popup UI │      │   Chart   │                  │
│              │  Render   │      │  Render   │                  │
│              └───────────┘      └───────────┘                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 적용 Mixin

| Mixin | 역할 |
|-------|------|
| `applyShadowPopupMixin` | Shadow DOM 팝업 생성/관리, 외부 클릭 닫기, 드래그 |
| `applyEChartsMixin` | ECharts 차트 인스턴스 관리, 리사이즈 핸들링 |

---

## 주요 설정

### datasetInfo

API 호출과 렌더링 함수를 매핑합니다.

```javascript
this.datasetInfo = [
    {
        name: 'ups',           // 현재 상태
        renderFn: 'renderStatus',
        params: { assetId: this.id }
    },
    {
        name: 'upsHistory',    // 히스토리 차트
        renderFn: 'renderChart',
        params: { assetId: this.id }
    }
];
```

### baseInfoConfig

기본 정보 필드와 DOM 셀렉터 매핑:

```javascript
this.baseInfoConfig = [
    { key: 'name', selector: '.ups-name' },
    { key: 'typeLabel', selector: '.ups-type' },
    { key: 'id', selector: '.ups-id' },
    { key: 'statusLabel', selector: '.ups-status' }
];
```

### fieldsContainerSelector

동적 필드가 렌더링될 컨테이너:

```javascript
this.fieldsContainerSelector = '.fields-container';
```

### chartConfig

ECharts 차트 설정:

```javascript
this.chartConfig = {
    containerSelector: '.chart-container',
    height: '200px',
    option: {
        // ECharts 옵션
        xAxis: { type: 'category', data: [] },
        yAxis: { type: 'value', name: 'Load (%)' },
        series: [{ type: 'line', data: [], smooth: true }]
    }
};
```

---

## 코드 흐름

### 1. 초기화 (register.js 로드)

```
┌─────────────────────────────────────────────────────────────────┐
│  register.js 실행                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. datasetInfo 정의 (ups, upsHistory)                          │
│  2. baseInfoConfig 정의                                         │
│  3. fieldsContainerSelector 정의                                │
│  4. chartConfig 정의                                            │
│  5. applyShadowPopupMixin(this) 적용                            │
│  6. applyEChartsMixin(this) 적용                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. 3D 클릭 → showDetail()

```
┌─────────────────────────────────────────────────────────────────┐
│  사용자가 3D UPS 클릭                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Page의 @assetClicked 핸들러 호출                            │
│     └─→ targetInstance.showDetail()                            │
│                                                                 │
│  2. showDetail() 내부:                                          │
│     ├─→ _showPopup() (Shadow DOM 팝업 표시)                     │
│     ├─→ fetchData('ups', params)                               │
│     │       └─→ renderStatus() 호출                            │
│     └─→ fetchData('upsHistory', params)                        │
│             └─→ renderChart() 호출                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. 상태 렌더링 (renderStatus)

```javascript
renderStatus({ response }) {
    const { data } = response;

    // 1. 기본 정보 렌더링
    this.baseInfoConfig.forEach(({ key, selector }) => {
        const el = this._popupRoot.querySelector(selector);
        if (el && data[key] !== undefined) {
            el.textContent = data[key];
        }
    });

    // 2. 상태에 따른 스타일 적용
    this._applyStatusStyle(data.status);

    // 3. 동적 필드 렌더링 (API fields 배열 사용)
    this._renderFields(data.fields);
}
```

### 4. 동적 필드 렌더링 (_renderFields)

API 응답의 `fields` 배열을 기반으로 렌더링:

```
API 응답:
{
    "fields": [
        { "key": "load", "label": "부하율", "value": 75, "unit": "%" },
        { "key": "batteryLevel", "label": "배터리 잔량", "value": 90, "unit": "%" },
        { "key": "inputVoltage", "label": "입력 전압", "value": 220.5, "unit": "V" },
        ...
    ]
}

렌더링 결과:
┌─────────────────────────┐
│  부하율          75%    │
│  배터리 잔량     90%    │
│  입력 전압       220.5V │
│  ...                    │
└─────────────────────────┘
```

### 5. 차트 렌더링 (renderChart)

```javascript
renderChart({ response }) {
    const { data } = response;
    const { history = [] } = data;

    // ECharts 옵션 업데이트
    this._chart.setOption({
        xAxis: {
            data: history.map(h => h.timestamp)
        },
        series: [{
            data: history.map(h => h.load)
        }]
    });
}
```

---

## 이벤트 흐름

### 발행 이벤트

| 이벤트 | 발행 시점 | Payload |
|--------|----------|---------|
| `@assetClicked` | 3D 클릭 시 (Page에서 처리) | `{ event, targetInstance }` |

### 외부 클릭 닫기

```
사용자 클릭 (팝업 외부)
    │
    └─→ document click 이벤트
            │
            └─→ _onOutsideClick()
                    │
                    └─→ hideDetail()
                            │
                            └─→ 팝업 숨김 + 차트 정리
```

---

## Public Methods

| 메서드 | 설명 |
|--------|------|
| `showDetail()` | 팝업 표시 + 데이터 로드 |
| `hideDetail()` | 팝업 숨김 + 리소스 정리 |
| `renderStatus({ response })` | 상태 정보 렌더링 |
| `renderChart({ response })` | 히스토리 차트 렌더링 |

---

## 데이터 흐름 다이어그램

```
┌──────────┐     ┌───────────┐     ┌──────────────┐     ┌────────────┐
│ 3D Click │────▶│ showDetail│────▶│ fetchData()  │────▶│ Mock Server│
└──────────┘     └───────────┘     └──────────────┘     └────────────┘
                                          │                    │
                                          │    API Response    │
                                          │◀───────────────────┘
                                          │
                                   ┌──────▼──────┐
                                   │ datasetInfo │
                                   │   매핑      │
                                   └──────┬──────┘
                                          │
                        ┌─────────────────┼─────────────────┐
                        │                 │                 │
                  ┌─────▼─────┐     ┌─────▼─────┐     ┌─────▼─────┐
                  │renderStatus│    │renderChart │    │   ...     │
                  └─────┬─────┘     └─────┬─────┘     └───────────┘
                        │                 │
                  ┌─────▼─────┐     ┌─────▼─────┐
                  │ DOM 업데이트│    │ Chart     │
                  │ (팝업 UI)  │    │ 업데이트   │
                  └───────────┘     └───────────┘
```

---

## 파일 구조

```
UPS/
├── docs/
│   └── codeflow.md          # 이 문서
├── scripts/
│   ├── register.js          # 메인 로직
│   └── beforeDestroy.js     # 정리 (팝업 제거, 차트 파괴)
├── styles/
│   └── component.css        # 팝업 스타일
├── views/
│   └── component.html       # 3D 모델 컨테이너
└── README.md
```

---

## 참고

- [Shadow Popup Mixin](../../../Utils/Mixins/ShadowPopupMixin.js)
- [ECharts Mixin](../../../Utils/Mixins/EChartsMixin.js)
- [API 명세](../../../API_SPEC.md)
- [다국어 명세](../../../I18N_SPEC.md)

---

*최종 업데이트: 2026-01-15*
