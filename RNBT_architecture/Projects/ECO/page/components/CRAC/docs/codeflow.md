# CRAC 컴포넌트 코드 흐름

## 개요

CRAC(Computer Room Air Conditioning) 컴포넌트는 3D 환경에서 사용되는 **팝업 컴포넌트(Component With Popup)**입니다. Shadow DOM 팝업을 통해 항온항습기의 상세 정보와 온도/습도 히스토리 차트를 표시합니다.

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│  CRAC Component With Popup                                  │
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
│              │  Popup UI │      │ Dual-Axis │                  │
│              │  Render   │      │   Chart   │                  │
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
        name: 'crac',          // 현재 상태
        renderFn: 'renderStatus',
        params: { assetId: this.id }
    },
    {
        name: 'cracHistory',   // 히스토리 차트
        renderFn: 'renderChart',
        params: { assetId: this.id }
    }
];
```

### baseInfoConfig

기본 정보 필드와 DOM 셀렉터 매핑:

```javascript
this.baseInfoConfig = [
    { key: 'name', selector: '.crac-name' },
    { key: 'typeLabel', selector: '.crac-type' },
    { key: 'id', selector: '.crac-id' },
    { key: 'statusLabel', selector: '.crac-status' }
];
```

### fieldsContainerSelector

동적 필드가 렌더링될 컨테이너:

```javascript
this.fieldsContainerSelector = '.fields-container';
```

### chartConfig (이중 Y축)

ECharts 차트 설정 - 온도/습도를 위한 이중 Y축:

```javascript
this.chartConfig = {
    containerSelector: '.chart-container',
    height: '200px',
    option: {
        tooltip: { trigger: 'axis' },
        legend: { data: ['Temperature', 'Humidity'] },
        xAxis: { type: 'category', data: [] },
        yAxis: [
            { type: 'value', name: 'Temp (°C)', position: 'left' },
            { type: 'value', name: 'Humidity (%)', position: 'right' }
        ],
        series: [
            { name: 'Temperature', type: 'line', data: [], yAxisIndex: 0 },
            { name: 'Humidity', type: 'line', data: [], yAxisIndex: 1 }
        ]
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
│  1. datasetInfo 정의 (crac, cracHistory)                        │
│  2. baseInfoConfig 정의                                         │
│  3. fieldsContainerSelector 정의                                │
│  4. chartConfig 정의 (이중 Y축)                                  │
│  5. applyShadowPopupMixin(this) 적용                            │
│  6. applyEChartsMixin(this) 적용                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. 3D 클릭 → showDetail()

```
┌─────────────────────────────────────────────────────────────────┐
│  사용자가 3D CRAC 클릭                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Page의 @assetClicked 핸들러 호출                            │
│     └─→ targetInstance.showDetail()                            │
│                                                                 │
│  2. showDetail() 내부:                                          │
│     ├─→ _showPopup() (Shadow DOM 팝업 표시)                     │
│     ├─→ fetchData('crac', params)                              │
│     │       └─→ renderStatus() 호출                            │
│     └─→ fetchData('cracHistory', params)                       │
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
        { "key": "supplyTemp", "label": "공급 온도", "value": 18.5, "unit": "°C" },
        { "key": "returnTemp", "label": "환기 온도", "value": 24.2, "unit": "°C" },
        { "key": "setpoint", "label": "설정 온도", "value": 22.0, "unit": "°C" },
        { "key": "humidity", "label": "습도", "value": 45, "unit": "%" },
        { "key": "fanSpeed", "label": "팬 속도", "value": 75, "unit": "%" },
        { "key": "mode", "label": "운전 모드", "value": "cooling", "valueLabel": "냉방" }
    ]
}

렌더링 결과:
┌─────────────────────────┐
│  공급 온도       18.5°C │
│  환기 온도       24.2°C │
│  설정 온도       22.0°C │
│  습도            45%    │
│  팬 속도         75%    │
│  운전 모드       냉방    │
└─────────────────────────┘
```

### 5. 차트 렌더링 (renderChart) - 이중 Y축

```javascript
renderChart({ response }) {
    const { data } = response;
    const { history = [] } = data;

    // ECharts 옵션 업데이트 (이중 Y축)
    this._chart.setOption({
        xAxis: {
            data: history.map(h => h.timestamp)
        },
        series: [
            { data: history.map(h => h.temperature) },  // 온도 (좌측 Y축)
            { data: history.map(h => h.humidity) }      // 습도 (우측 Y축)
        ]
    });
}
```

**차트 시각화:**

```
      °C                                              %
      │                                              │
   30 ┤                                           ┤ 60
      │    ╭──╮                                     │
   25 ┤ ──╯    ╰──────────────────────── Temp   ┤ 50
      │                                              │
   20 ┤ ─────────╮    ╭───────────────── Humidity┤ 40
      │           ╰──╯                              │
   15 ┤                                           ┤ 30
      │                                              │
      └──────────────────────────────────────────────┘
        10:00   10:30   11:00   11:30   12:00
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
| `renderChart({ response })` | 히스토리 차트 렌더링 (이중 Y축) |

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
                        ┌─────────────────┴─────────────────┐
                        │                                   │
                  ┌─────▼─────┐                      ┌──────▼──────┐
                  │renderStatus│                     │ renderChart │
                  └─────┬─────┘                      └──────┬──────┘
                        │                                   │
                  ┌─────▼─────┐                      ┌──────▼──────┐
                  │ DOM 업데이트│                     │  Dual Y-Axis │
                  │ (팝업 UI)  │                     │    Chart     │
                  └───────────┘                      └─────────────┘
```

---

## 파일 구조

```
CRAC/
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

## UPS와의 차이점

| 항목 | UPS | CRAC |
|------|-----|------|
| 차트 Y축 | 단일 (Load %) | 이중 (Temperature/Humidity) |
| 차트 시리즈 | 1개 (load) | 2개 (temperature, humidity) |
| 주요 필드 | 부하율, 배터리, 전압 | 공급온도, 환기온도, 습도 |
| 운전 모드 | online/battery/bypass | cooling/heating/auto |

---

## 참고

- [Shadow Popup Mixin](../../../Utils/Mixins/ShadowPopupMixin.js)
- [ECharts Mixin](../../../Utils/Mixins/EChartsMixin.js)
- [API 명세](../../../API_SPEC.md)
- [다국어 명세](../../../I18N_SPEC.md)

---

*최종 업데이트: 2026-01-15*
