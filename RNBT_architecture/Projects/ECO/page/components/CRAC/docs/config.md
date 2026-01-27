# CRAC 컴포넌트 Config 명세

## 개요

CRAC(항온항습기) 컴포넌트는 설정(Config)을 통해 API 응답과 UI를 매핑합니다. 공통 패턴은 [UPS config.md](../../UPS/docs/config.md)를 참조하세요.

이 문서는 **CRAC만의 차이점**을 중심으로 설명합니다.

---

## Config 구조

```
┌─────────────────────────────────────────────────────────────────┐
│  CRAC Component Config                                          │
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

| 항목 | UPS | CRAC |
|------|-----|------|
| **chartConfig.styleMap** | `load`, `battery` | `supplyTemp`, `returnTemp`, `humidity` |
| **차트 Y축** | 단일 | **이중** (온도/습도) |
| **시리즈 수** | 2개 | **3개** |
| **baseInfoConfig selector** | `.ups-*` | `.crac-*` |

---

## 1. baseInfoConfig

**역할**: API의 `asset` 객체 필드를 헤더 UI에 매핑

```javascript
this.baseInfoConfig = [
    { key: 'name', selector: '.crac-name' },
    { key: 'locationLabel', selector: '.crac-zone' },
    { key: 'statusType', selector: '.crac-status', transform: this.statusTypeToLabel },
    { key: 'statusType', selector: '.crac-status', dataAttr: 'status', transform: this.statusTypeToDataAttr },
];
```

**매핑 예시**:
```
API: asset.name = "CRAC 0001"       →  .crac-name.textContent = "CRAC 0001"
API: asset.locationLabel = "서버실 A"  →  .crac-zone.textContent = "서버실 A"
API: asset.statusType = "ACTIVE"    →  .crac-status.textContent = "Normal"
API: asset.statusType = "ACTIVE"    →  .crac-status[data-status] = "normal"
```

**왜 하드코딩인가?**

```
┌─────────────────────────────────────────────────────────────────┐
│  하드코딩의 원인: UI Selector (HTML 템플릿 종속)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  component.html (팝업 HTML 구조)                                │
│  ┌─────────────────────────────────────────────┐               │
│  │  <div class="crac-name">...</div>           │ ← 고정        │
│  │  <div class="crac-zone">...</div>           │ ← 고정        │
│  │  <div class="crac-status">...</div>         │ ← 고정        │
│  └─────────────────────────────────────────────┘               │
│                    ↑                                            │
│                    │                                            │
│  baseInfoConfig    │                                            │
│  ┌─────────────────┴───────────────────────────┐               │
│  │  selector: '.crac-name'   ←── HTML에 종속     │               │
│  │  selector: '.crac-zone'   ←── HTML에 종속     │               │
│  │  selector: '.crac-status' ←── HTML에 종속     │               │
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
        supplyTemp: { color: '#3b82f6', yAxisIndex: 0 },  // 공급 온도 (°C)
        returnTemp: { color: '#ef4444', yAxisIndex: 0 },  // 환기 온도 (°C)
        humidity: { color: '#22c55e', yAxisIndex: 1 },    // 습도 (%)
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
| `supplyTemp` | #3b82f6 (파랑) | 왼쪽 (°C) | 공급 온도 |
| `returnTemp` | #ef4444 (빨강) | 왼쪽 (°C) | 환기 온도 |
| `humidity` | #22c55e (초록) | 오른쪽 (%) | 습도 |

**차트 시각화**:
```
      °C                                              %
      │                                              │
   30 ┤                                           ┤ 60
      │    ╭──╮                                     │
   25 ┤ ──╯    ╰────────────────────── supplyTemp ┤ 50
      │  ╭────────────────────────────── returnTemp│
   20 ┤ ╯─────────╮    ╭───────────────── humidity┤ 40
      │           ╰──╯                              │
   15 ┤                                           ┤ 30
      │                                              │
      └──────────────────────────────────────────────┘
        10:00   10:30   11:00   11:30   12:00
```

---

## 컴포넌트별 styleMap 비교

| 컴포넌트 | styleMap keys | Y축 | 특징 |
|----------|--------------|-----|------|
| UPS | `load`, `battery` | 단일 (%) | 부하율, 배터리 |
| PDU | `power`, `current` | 이중 (kW/A) | 전력, 전류 |
| **CRAC** | `supplyTemp`, `returnTemp`, `humidity` | **이중 (°C/%)** | 온도 2개 + 습도 1개 |
| TempHumiditySensor | `temperature`, `humidity` | 이중 (°C/%) | 온도, 습도 |

---

## 참고

- [UPS config.md](../../UPS/docs/config.md) - Config 상세 명세 (공통 패턴)
- [codeflow.md](./codeflow.md) - 코드 실행 흐름

---

*최종 업데이트: 2026-01-27*
