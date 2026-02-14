# Runtime Parameter Update API — 목적과 설계 철학

## 1. 이 API가 해결하는 문제

ECO 컴포넌트는 데이터센터 장비(UPS, SWBD, PDU, CRAC, 온습도센서)의 메트릭 데이터를 시각화한다.
이 과정에서 **도메인 해석의 오류**가 발생할 수 있다.

```
인터페이스(SNMP/Modbus/ACCURA)
    ↓ 수집
DCMS (dh_metric_history)
    ↓ 집계
stats_1m / stats_1h
    ↓ API (mh/gl, mhs/l)
컴포넌트 (register.js)
    ↓ 표출
팝업 UI
```

이 파이프라인에서 컴포넌트가 담당하는 구간은 **API 응답 → 표출**이다.
여기서 발생할 수 있는 도메인 오해의 예:

| 오해 유형 | 예시 |
|----------|------|
| 메트릭 코드 오매핑 | 전류 탭에 전압 메트릭을 연결 |
| 집계 방식 오류 | 전류를 평균(avg)으로 집계 — 실제로는 합계(sum)가 올바름 |
| 스케일 오류 | Deci 단위 원시값(÷10 필요)에 scale=1.0 적용 |
| 상태카드 메트릭 오류 | 배터리 전압 자리에 배터리 잔량 퍼센트를 연결 |
| 단위 표기 오류 | kW를 표시해야 하는데 W로 표기 |

**이러한 오류를 발견했을 때, 소스 코드를 수정하지 않고 런타임에서 교정할 수 있어야 한다.**

---

## 2. 핵심 원칙: 정보의 변경, UI 구조의 변경이 아님

이 API는 **"무엇을 보여줄 것인가"**를 변경한다. **"어떻게 보여줄 것인가"**는 변경하지 않는다.

```
변경 가능 (정보 매핑)          변경 불가 (UI 구조)
─────────────────────          ─────────────────────
메트릭 코드 (metricCode)       탭 개수
집계 방식 (statsKey)           차트 유형 (bar, line)
스케일 (scale)                 레이아웃 배치
표시 라벨 (label)              팝업 HTML 구조
표시 단위 (unit)               CSS 스타일
상태카드 추가/제거             3D 이벤트 바인딩
```

---

## 3. 탭 키는 내부 슬롯이다

탭 키(`current`, `voltage`, `frequency` 등)는 **사용자에게 보이지 않는 내부 식별자**이다.

```javascript
// 'current' 탭이지만, 사용자에게는 '역률'로 보인다
component.updateUpsTabMetric('current', {
  inputCode:  'UPS.INPUT_PF',
  outputCode: 'UPS.OUTPUT_PF',
  statsKey:   'avg',
  label:      '역률',      // ← 사용자가 보는 이름
  unit:       'PF'         // ← 사용자가 보는 단위
});
```

따라서 도메인 교정 시 탭 키를 변경할 필요가 없다.
키는 슬롯 번호와 같고, 그 슬롯에 어떤 정보를 담을지가 API의 관심사이다.

---

## 4. 사용 시점

```
initComponent()
  │
  ├─ this.config 초기화 (register.js 기본값)
  ├─ this.datasetInfo 생성
  │
  ├─ ★ Runtime Parameter Update API 호출 ★
  │     → 도메인 오해 교정
  │     → config만 변경, DOM/fetch 없음
  │
  └─ showDetail() 호출
        → 변경된 config 기반으로 fetch → render
        → 사용자에게 교정된 정보 표출
```

팝업이 열린 후가 아니라, **등록 직후 ~ 첫 표출 전**에 호출한다.
config만 변경하면 이후 렌더링에서 자연스럽게 반영되므로 DOM 조작이 불필요하다.

---

## 5. 변경 가능한 항목과 API 매핑

### 5.1 차트 메트릭 교정 (Category B)

| 컴포넌트 | 메서드 | 변경 가능 필드 |
|----------|--------|--------------|
| UPS | `updateUpsTabMetric(tabName, opts)` | inputCode, outputCode, statsKey, label, unit |
| SWBD | `updateSwbdTabMetric(tabName, opts)` | metricCode, statsKey, label, unit, color, scale |
| PDU | `updatePduTabMetric(tabName, opts)` | metricCode, statsKey, label, unit, color, scale |
| CRAC | `updateCracSeriesMetric(seriesName, opts)` | metricCode, statsKey, scale, label |
| SENSOR | `updateSensorSeriesMetric(seriesName, opts)` | metricCode, statsKey, scale, label |

한 번의 호출로 **3곳이 자동 동기화**된다:

```
1. chart.tabs[tab] 또는 chart.series[series]  — config 객체 갱신
2. api.statsKeyMap[newCode]                    — 집계 방식 갱신
3. datasetInfo.param.metricCodes               — API 요청 파라미터 재구축
```

### 5.2 상태카드 메트릭 교정 (Category E)

| 컴포넌트 | update | add | remove |
|----------|--------|-----|--------|
| UPS | `updateUpsStatusMetric(key, opts)` | `addUpsStatusMetric(key, opts)` | `removeUpsStatusMetric(key)` |
| CRAC | `updateCracStatusMetric(key, opts)` | `addCracStatusMetric(key, opts)` | `removeCracStatusMetric(key)` |
| SENSOR | `updateSensorStatusMetric(key, opts)` | `addSensorStatusMetric(key, opts)` | `removeSensorStatusMetric(key)` |

SWBD, PDU는 상태카드가 없으므로 해당 없음.

### 5.3 공통 파라미터 교정 (Category A, C, D)

| Category | 메서드 | 용도 |
|----------|--------|------|
| A | `updateTrendParams(opts)` | timeRange, interval, apiEndpoint, timeField |
| C | `updateGlobalParams(opts)` | assetKey, baseUrl, locale |
| D | `updateRefreshInterval(datasetName, ms)` | 폴링 주기 |

---

## 6. 구체적 교정 시나리오

### 시나리오 1: 집계 방식 오류 발견

UPS 전류를 평균(avg)으로 집계하고 있었으나, 3상 전류는 합계(sum)가 올바름.

```javascript
component.updateUpsTabMetric('current', {
  inputCode:  'UPS.INPUT_A_SUM',
  outputCode: 'UPS.OUTPUT_A_SUM',
  statsKey:   'sum'
});
```

### 시나리오 2: 스케일 오류 발견

UPS 원시값이 DeciVolt(÷10 필요)인데 scale=1.0으로 되어 있어 10배 큰 값이 표출됨.

```javascript
component.updateUpsTabMetric('voltage', {
  inputCode:  'UPS.INPUT_V_AVG',
  outputCode: 'UPS.OUTPUT_V_AVG',
  statsKey:   'avg',
  unit:       'V'
});
// scale 변경이 필요하면 metricConfig.json의 scale 또는
// 수집 파이프라인에서 사전 변환 여부를 확인
```

### 시나리오 3: 메트릭 코드 자체가 잘못됨

SWBD 전압 탭에 전류 메트릭이 연결되어 있었음.

```javascript
component.updateSwbdTabMetric('voltage', {
  metricCode: 'SWBD.VOLTAGE_V',   // 올바른 코드로 교체
  statsKey:   'avg',
  label:      '전압',
  unit:       'V'
});
```

### 시나리오 4: 상태카드 메트릭 교체

UPS 배터리 출력전압 카드에 잘못된 메트릭이 연결됨.

```javascript
component.updateUpsStatusMetric('batteryVolt', {
  metricCode: 'UPS.BATT_V',
  label:      '배터리 출력전압',
  unit:       'V',
  scale:      1.0
});
```

### 시나리오 5: 탭 슬롯을 완전히 다른 정보로 교체

전류 탭이 불필요하여 역률 정보로 대체.

```javascript
component.updateUpsTabMetric('current', {
  inputCode:  'UPS.INPUT_PF',
  outputCode: 'UPS.OUTPUT_PF',
  statsKey:   'avg',
  label:      '역률',
  unit:       'PF'
});
// 내부 키 'current'는 그대로이지만,
// 사용자에게 보이는 모든 것이 '역률'로 변경됨
```

---

## 7. 이 API가 하지 않는 것

| 항목 | 사유 |
|------|------|
| 탭 추가/삭제 | UI 구조 변경 — HTML 소스 수정 필요 |
| 차트 유형 변경 (bar↔line) | UI 구조 변경 |
| 팝업 레이아웃 변경 | HTML/CSS 소스 수정 필요 |
| 3D 이벤트 바인딩 변경 | 컴포넌트 아키텍처 변경 |
| DOM 즉시 반영 | 등록 시 전용이므로 불필요 |

이 경계는 의도적이다. **정보 매핑 교정**과 **UI 재설계**는 다른 문제이며, 이 API는 전자만 담당한다.

---

## 8. 관련 문서

| 문서 | 내용 |
|------|------|
| [RUNTIME_PARAM_UPDATE_API.md](RUNTIME_PARAM_UPDATE_API.md) | 메서드별 상세 설계 (시그니처, 파라미터, 동기화 규칙) |
| [RUNTIME_PARAM_UPDATE_API_TEST_RESULTS.md](RUNTIME_PARAM_UPDATE_API_TEST_RESULTS.md) | 130개 테스트 전수 통과 결과 |
| [ECO_IMPLEMENTATION_AUDIT_REPORT.md](../ECO_IMPLEMENTATION_AUDIT_REPORT.md) | 구현 충실도 감사 보고서 |

---

*최종 업데이트: 2026-02-14*
