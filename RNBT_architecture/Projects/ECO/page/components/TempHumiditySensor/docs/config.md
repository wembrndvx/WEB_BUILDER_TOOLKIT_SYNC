# TempHumiditySensor 컴포넌트 Config 명세

## 개요

TempHumiditySensor(온습도 센서) 컴포넌트는 설정(Config)을 통해 API 응답과 UI를 매핑합니다. 공통 패턴은 [UPS config.md](../../UPS/docs/config.md)를 참조하세요.

이 문서는 **TempHumiditySensor만의 차이점**을 중심으로 설명합니다.

---

## Config 구조

```
┌─────────────────────────────────────────────────────────────────┐
│  TempHumiditySensor Component Config                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  datasetInfo          API 호출 ↔ 렌더링 함수 매핑               │
│  baseInfoConfig       헤더 영역 (asset 객체 → UI selector)      │
│  fieldsContainerSelector  동적 필드 컨테이너                    │
│  chartConfig          차트 렌더링 설정 (이중 Y축: 온도/습도)    │
│  templateConfig       팝업 템플릿 ID                            │
│  popupCreatedConfig   팝업 생성 후 초기화 설정                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## UPS와의 차이점

| 항목 | UPS | TempHumiditySensor |
|------|-----|-------------------|
| **chartConfig.styleMap** | `load`, `battery` | `temperature`, `humidity` |
| **차트 Y축** | 단일 | **이중** (온도/습도) |
| **baseInfoConfig selector** | `.ups-*` | `.sensor-*` |
| **역할** | 전력 공급 장치 | **측정 전용 센서** |

---

## 1. baseInfoConfig

**역할**: API의 `asset` 객체 필드를 헤더 UI에 매핑

```javascript
this.baseInfoConfig = [
    { key: 'name', selector: '.sensor-name' },
    { key: 'locationLabel', selector: '.sensor-zone' },
    { key: 'statusType', selector: '.sensor-status', transform: this.statusTypeToLabel },
    { key: 'statusType', selector: '.sensor-status', dataAttr: 'status', transform: this.statusTypeToDataAttr },
];
```

**매핑 예시**:
```
API: asset.name = "Sensor 0001"     →  .sensor-name.textContent = "Sensor 0001"
API: asset.locationLabel = "서버실 A"  →  .sensor-zone.textContent = "서버실 A"
API: asset.statusType = "ACTIVE"    →  .sensor-status.textContent = "Normal"
API: asset.statusType = "ACTIVE"    →  .sensor-status[data-status] = "normal"
```

**왜 하드코딩인가?**

```
┌─────────────────────────────────────────────────────────────────┐
│  하드코딩의 원인: UI Selector (HTML 템플릿 종속)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  component.html (팝업 HTML 구조)                                │
│  ┌─────────────────────────────────────────────┐               │
│  │  <div class="sensor-name">...</div>         │ ← 고정        │
│  │  <div class="sensor-zone">...</div>         │ ← 고정        │
│  │  <div class="sensor-status">...</div>       │ ← 고정        │
│  └─────────────────────────────────────────────┘               │
│                    ↑                                            │
│                    │                                            │
│  baseInfoConfig    │                                            │
│  ┌─────────────────┴───────────────────────────┐               │
│  │  selector: '.sensor-name'   ←── HTML에 종속   │               │
│  │  selector: '.sensor-zone'   ←── HTML에 종속   │               │
│  │  selector: '.sensor-status' ←── HTML에 종속   │               │
│  └─────────────────────────────────────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 항목 | 하드코딩 여부 | 이유 |
|------|--------------|------|
| `key` | O | API 표준 필드 (변경 빈도 낮음) |
| `selector` | **O (핵심)** | HTML 템플릿의 class명에 종속 |
| `transform` | O | 값 변환 로직은 컴포넌트별 고정 |

---

## 2. chartConfig

**역할**: ECharts 차트 렌더링 설정 (이중 Y축: 온도/습도)

```javascript
this.chartConfig = {
    xKey: 'timestamps',
    valuesKey: 'values',
    styleMap: {
        temperature: { color: '#3b82f6', yAxisIndex: 0 },  // 온도 (°C)
        humidity: { color: '#22c55e', yAxisIndex: 1 },     // 습도 (%)
    },
    optionBuilder: getDualAxisChartOption,
};
```

| 필드 | 타입 | 설명 |
|------|------|------|
| xKey | string | API 응답에서 x축 데이터 배열의 키 |
| valuesKey | string | API 응답에서 시계열 값 객체의 키 |
| styleMap | object | 각 series의 스타일 정의 |
| optionBuilder | function | ECharts option 생성 함수 |

**styleMap 상세**:

| key | 색상 | Y축 | 설명 |
|-----|------|-----|------|
| `temperature` | #3b82f6 (파랑) | 왼쪽 (°C) | 온도 |
| `humidity` | #22c55e (초록) | 오른쪽 (%) | 습도 |

**차트 시각화**:
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

## CRAC와의 차이점

TempHumiditySensor와 CRAC는 모두 온습도 데이터를 다루지만 역할이 다릅니다:

| 항목 | CRAC | TempHumiditySensor |
|------|------|-------------------|
| **역할** | 항온항습기 (액티브 제어) | 센서 (수동 측정) |
| **주요 필드** | 공급온도, 환기온도, 팬속도, 모드 | 온도, 습도, 이슬점, 체감온도 |
| **운전 모드** | O (cooling/heating/auto) | X (측정 전용) |
| **styleMap** | `supplyTemp`, `returnTemp`, `humidity` | `temperature`, `humidity` |
| **시리즈 수** | 3개 | 2개 |

---

## 컴포넌트별 styleMap 비교

| 컴포넌트 | styleMap keys | Y축 | 특징 |
|----------|--------------|-----|------|
| UPS | `load`, `battery` | 단일 (%) | 부하율, 배터리 |
| PDU | `power`, `current` | 이중 (kW/A) | 전력, 전류 |
| CRAC | `supplyTemp`, `returnTemp`, `humidity` | 이중 (°C/%) | 온도 2개 + 습도 1개 |
| **TempHumiditySensor** | `temperature`, `humidity` | **이중 (°C/%)** | 온도, 습도 |

---

## 참고

- [UPS config.md](../../UPS/docs/config.md) - Config 상세 명세 (공통 패턴)
- [codeflow.md](./codeflow.md) - 코드 실행 흐름

---

*최종 업데이트: 2026-01-27*
