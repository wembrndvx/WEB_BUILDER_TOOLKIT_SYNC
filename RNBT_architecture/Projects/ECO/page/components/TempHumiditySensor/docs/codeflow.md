# TempHumiditySensor 컴포넌트 코드 흐름

## 개요

TempHumiditySensor(온습도 센서) 컴포넌트는 3D 환경에서 사용되는 **팝업 컴포넌트(Component With Popup)**입니다. Shadow DOM 팝업을 통해 센서의 상세 정보와 온도/습도 히스토리 차트를 표시합니다.

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│  TempHumiditySensor Component With Popup                    │
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
        name: 'sensor',        // 현재 상태
        renderFn: 'renderStatus',
        params: { assetId: this.id }
    },
    {
        name: 'sensorHistory', // 히스토리 차트
        renderFn: 'renderChart',
        params: { assetId: this.id }
    }
];
```

### baseInfoConfig

기본 정보 필드와 DOM 셀렉터 매핑:

```javascript
this.baseInfoConfig = [
    { key: 'name', selector: '.sensor-name' },
    { key: 'typeLabel', selector: '.sensor-type' },
    { key: 'id', selector: '.sensor-id' },
    { key: 'statusLabel', selector: '.sensor-status' }
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
│  1. datasetInfo 정의 (sensor, sensorHistory)                    │
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
│  사용자가 3D Sensor 클릭                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Page의 @assetClicked 핸들러 호출                            │
│     └─→ targetInstance.showDetail()                            │
│                                                                 │
│  2. showDetail() 내부:                                          │
│     ├─→ _showPopup() (Shadow DOM 팝업 표시)                     │
│     ├─→ fetchData('sensor', params)                            │
│     │       └─→ renderStatus() 호출                            │
│     └─→ fetchData('sensorHistory', params)                     │
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
        { "key": "temperature", "label": "온도", "value": 24.5, "unit": "°C" },
        { "key": "humidity", "label": "습도", "value": 52, "unit": "%" },
        { "key": "dewPoint", "label": "이슬점", "value": 13.8, "unit": "°C" },
        { "key": "heatIndex", "label": "체감 온도", "value": 25.1, "unit": "°C" }
    ]
}

렌더링 결과:
┌─────────────────────────┐
│  온도            24.5°C │
│  습도            52%    │
│  이슬점          13.8°C │
│  체감 온도       25.1°C │
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
   30 ┤                                           ┤ 70
      │         ╭──╮                                 │
   25 ┤ ────────╯  ╰──────────────────── Temp   ┤ 60
      │                                              │
   20 ┤ ───╮      ╭───────────────────── Humidity┤ 50
      │     ╰────╯                                  │
   15 ┤                                           ┤ 40
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
TempHumiditySensor/
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

## CRAC와의 차이점

| 항목 | CRAC | TempHumiditySensor |
|------|------|---------------------|
| 역할 | 항온항습기 (액티브 제어) | 센서 (수동 측정) |
| 주요 필드 | 공급온도, 환기온도, 팬속도, 모드 | 온도, 습도, 이슬점, 체감온도 |
| 운전 모드 | O (cooling/heating/auto) | X (측정 전용) |
| threshold | 복잡 (온도+습도 범위) | 단순 (온도/습도 임계값) |

---

## 컴포넌트 간 공통점

모든 3D 팝업 컴포넌트(UPS, PDU, CRAC, TempHumiditySensor)는 동일한 패턴을 공유합니다:

| 항목 | 설명 |
|------|------|
| `applyShadowPopupMixin` | Shadow DOM 팝업 관리 |
| `datasetInfo` | API 호출 + 렌더링 함수 매핑 |
| `baseInfoConfig` | 기본 정보 필드 설정 |
| `fieldsContainerSelector` | 동적 필드 컨테이너 |
| `showDetail()` / `hideDetail()` | 팝업 표시/숨김 |
| `@assetClicked` | 3D 클릭 이벤트 |

---

## 참고

- [Shadow Popup Mixin](../../../Utils/Mixins/ShadowPopupMixin.js)
- [ECharts Mixin](../../../Utils/Mixins/EChartsMixin.js)
- [API 명세](../../../API_SPEC.md)
- [다국어 명세](../../../I18N_SPEC.md)

---

*최종 업데이트: 2026-01-15*
