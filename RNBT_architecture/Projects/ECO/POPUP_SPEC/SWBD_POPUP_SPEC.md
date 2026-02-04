# 수배전반(SWBD) 팝업 정보 화면 명세

**출처**: 기획서 PPT (v.0.8_260128.pptx) - "UPS 팝업 정보" 페이지 (수배전반 예시 포함)

---

## 팝업 구조 개요

팝업은 3개 섹션으로 구성됩니다. (번호는 기획서 원 표기 기준)

```
┌─────────────────────────────────────────────────┐
│  ● HV-2 자산정보                            [X] │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────┐  ┌──────────────────────┐         │
│  │          │  │  ① 기본정보 테이블    │         │
│  │  수배전반 │  │  자산명(ID), 자산타입, │         │
│  │  이미지   │  │  용도, 제조사명, 모델, │         │
│  │          │  │  위치, 상태, 설치일    │         │
│  └──────────┘  └──────────────────────┘         │
│                                                  │
│  ② 고압반 운전 상태 추이                         │
│  ┌──────────────────────────────────────┐       │
│  │ [전압] [전류] [주파수] [유효전력]      │       │
│  │  ● A상  ● B상  ● C상                 │       │
│  │  ~~~~~~~~~~~~~~~~~~~~~~~~~ (라인 차트) │       │
│  │  09시                          09시   │       │
│  └──────────────────────────────────────┘       │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## ① 기본정보 테이블

| 필드 | 예시 값 | API 소스 | 매핑 |
|------|---------|----------|------|
| 자산명 (ID) | MHV #2 | `ast/gx` | `asset.name` |
| 자산타입 | 고압반 | `ast/gx` | `asset.assetType` |
| 용도 | 전력차단 및 변전계통보호 | `ast/gx` | `asset.usageLabel` (API 요청 완료, 필드명 미정) |
| 제조사명 | LS 산전 | `vdr/g` | `vendor.name` (asset.assetModelKey → mdl/g → model.assetVendorKey → vdr/g) |
| 모델 | HV_W750 | `mdl/g` | `model.name` (asset.assetModelKey → mdl/g) |
| 위치 | 지하 1 층 전기실 | `ast/gx` | `asset.locationLabel` |
| 상태 | 정상운영 | `ast/gx` | `asset.statusType` → UI 라벨 변환 |
| 설치일 | 2025 년 10 월 23 일 | `ast/gx` | `asset.installDate` → 날짜 포맷 변환 |

### API 호출 흐름

```
1. POST /api/v1/ast/gx  { assetKey, locale: "ko" }
   → asset 기본정보 + properties

2. asset.assetModelKey가 있으면:
   POST /api/v1/mdl/g  { assetModelKey }
   → model.name (모델명), model.assetVendorKey

3. model.assetVendorKey가 있으면:
   POST /api/v1/vdr/g  { assetVendorKey }
   → vendor.name (제조사명)
```

### 데이터 커버리지

| 필드 | 가능 여부 |
|------|----------|
| 자산명 (ID) | **O** |
| 자산타입 | **O** |
| 용도 | **△** (`asset.usageLabel` API 요청 완료, 필드명 미정) |
| 제조사명 | **O** |
| 모델 | **O** |
| 위치 | **O** |
| 상태 | **O** |
| 설치일 | **O** |

---

## ② 고압반 운전 상태 추이 (트렌드 차트)

24시간 (전일 동시간 ~ 현재시간) 데이터를 표시합니다.

### 탭 구성

| 탭 | 기획서 범례 | Y축 단위 | 현재 metricConfig | 비고 |
|----|------------|---------|-------------------|------|
| 전압 | A상, B상, C상 | V | `SWBD.VOLTAGE_V` (단일값) | **X** 3상 개별 메트릭 미정의 |
| 전류 | A상, B상, C상 | A | `SWBD.CURRENT_A` (단일값) | **X** 3상 개별 메트릭 미정의 |
| 주파수 | (없음) | Hz | `SWBD.FREQUENCY_HZ` | **O** 단일값 |
| 유효전력 | 금일, 월평균 | kW | `SWBD.ACTIVE_POWER_KW` | **△** 월평균 계산 방식 확인 필요 |

> **문제점**: 기획서 차트는 A상·B상·C상 3개 라인을 개별 표시하지만, 현재 metricConfig의 SWBD 메트릭은 단일값만 정의되어 있어 3상 개별 표시 불가.

### 3상 개별 표시를 위해 필요한 메트릭 (미정의)

| 탭 | 필요 메트릭 코드 | 설명 |
|----|----------------|------|
| 전압 | `SWBD.VOLTAGE_V_A`, `SWBD.VOLTAGE_V_B`, `SWBD.VOLTAGE_V_C` | 전압 A/B/C상 |
| 전류 | `SWBD.CURRENT_A_A`, `SWBD.CURRENT_A_B`, `SWBD.CURRENT_A_C` | 전류 A/B/C상 |

### 대체 방안: 단일값으로 표시

3상 개별 메트릭이 확보되기 전까지, 기존 SWBD 메트릭으로 단일 라인 차트를 구성할 수 있음.

| 탭 | 사용 메트릭 | 표시 방식 |
|----|-----------|----------|
| 전압 | `SWBD.VOLTAGE_V` | 전압 1개 라인 |
| 전류 | `SWBD.CURRENT_A` | 전류 1개 라인 |
| 주파수 | `SWBD.FREQUENCY_HZ` | 주파수 1개 라인 |
| 유효전력 | `SWBD.ACTIVE_POWER_KW` | 금일/월평균 2개 라인 비교 |

### API 호출

**전압/전류/주파수 (금일 24시간)**:
```
POST /api/v1/mhs/l
{
  "sort": [{ "field": "time", "direction": "ASC" }],
  "filter": {
    "assetKey": "swbd-0001",
    "interval": "1h",
    "metricCodes": ["SWBD.VOLTAGE_V", "SWBD.CURRENT_A", "SWBD.FREQUENCY_HZ"],
    "timeFrom": "2026-02-03T09:00:00.000",
    "timeTo": "2026-02-04T09:00:00.000"
  },
  "statsKeys": ["avg"]
}
```

**유효전력 (금일 + 월평균 비교)**:
```
// 금일 데이터
POST /api/v1/mhs/l
{
  "filter": {
    "assetKey": "swbd-0001",
    "interval": "1h",
    "metricCodes": ["SWBD.ACTIVE_POWER_KW"],
    "timeFrom": "2026-02-03T09:00:00.000",
    "timeTo": "2026-02-04T09:00:00.000"
  },
  "statsKeys": ["avg"]
}

// 월평균 데이터 (해당 월 전체 또는 별도 통계 API 필요)
// 구현 방식 확인 필요
```

### 데이터 커버리지

| 항목 | 가능 여부 |
|------|----------|
| 전압 (3상 개별) | **X** - 3상 개별 메트릭 미정의 |
| 전압 (단일값) | **O** - `SWBD.VOLTAGE_V` |
| 전류 (3상 개별) | **X** - 3상 개별 메트릭 미정의 |
| 전류 (단일값) | **O** - `SWBD.CURRENT_A` |
| 주파수 | **O** - `SWBD.FREQUENCY_HZ` |
| 유효전력 (금일) | **O** - `SWBD.ACTIVE_POWER_KW` |
| 유효전력 (월평균) | **△** - 월평균 계산 방식 확인 필요 |
| 시계열 통계 API | **O** |

---

## 기획서 우측 확장 정보 (참고)

기획서 우측에는 팝업보다 더 확장된 자산 상세 정보가 표시됩니다.

| 필드 | 예시 값 | 가능 여부 |
|------|---------|----------|
| 담당자 | 홍길동 | **O** (※ `ownerUserId`로 사용자 이름 조회 API 확인 필요) |
| 설명 | 주 전력 공급 장치 | **O** |
| 과전류 | 1,500 A | **O** (properties) |
| 과전류지락 | 300 A | **O** (properties) |
| 지락방향 | Forward | **O** (properties) |
| 과전압 | 24.0 kV | **O** (properties) |
| 저전압 | 21.0 kV | **O** (properties) |

---

## 알람 메트릭 (실시간 상태 표시용)

metricConfig에 정의된 SWBD 알람 메트릭입니다. 팝업에서 상태 표시에 활용할 수 있습니다.

| 메트릭 코드 | 라벨 | 설명 |
|------------|------|------|
| `SWBD.IS_NORMAL` | 상태(정상여부) | true=정상(1), false=차단(0) |
| `SWBD.ALARM_OCR` | 과전류(OCR) | 과전류 알람 |
| `SWBD.ALARM_OCGR` | 과전류지락(OCGR) | 과전류지락 알람 |
| `SWBD.ALARM_OVR` | 과전압(OVR) | 과전압 알람 |
| `SWBD.ALARM_OVGR` | 과전압지락(OVGR) | 과전압지락 알람 |
| `SWBD.ALARM_UVR` | 저전압(UVR) | 저전압 알람 |
| `SWBD.ALARM_POR` | 결상전압(POR) | 결상전압 알람 |
| `SWBD.ALARM_DGR` | 지락방향(DGR) | 지락방향 알람 |
| `SWBD.ALARM_ELD` | 지락누설(ELD) | 지락누설 알람 |
| `SWBD.ALARM_TR_TEMP` | 변압기 고온 | 변압기 고온 알람 |
| `SWBD.ALARM_GENERAL` | 경보 | 일반 경보 |

---

## 추가 메트릭 (참고)

metricConfig에 정의된 기타 SWBD 메트릭입니다.

| 메트릭 코드 | 라벨 | 단위 |
|------------|------|------|
| `SWBD.REACTIVE_POWER_KVAR` | 무효전력 | kVAR |
| `SWBD.POWER_FACTOR` | 역률 | ratio |
| `SWBD.DC_CURRENT_A` | 직류전류 | A |
| `SWBD.DC_VOLTAGE_V` | 직류전압 | V |
| `SWBD.ACTIVE_ENERGY_KWH` | 유효전력량 | kWh |
| `SWBD.REACTIVE_ENERGY_KVARH` | 무효전력량 | kVARh |

---

## 종합: 미제공 데이터 항목

| 항목 | 유형 | 미제공 사유 | 대응 방안 |
|------|------|-----------|----------|
| 전압 3상 개별 (A/B/C) | 메트릭 | metricConfig에 `SWBD.VOLTAGE_V_A/B/C` 미정의. 인터페이스에서 3상 개별값 수신 가능 여부 확인 필요 | 3상 메트릭 추가 또는 **대체**: `SWBD.VOLTAGE_V` 단일 라인으로 표시 |
| 전류 3상 개별 (A/B/C) | 메트릭 | metricConfig에 `SWBD.CURRENT_A_A/B/C` 미정의. 인터페이스에서 3상 개별값 수신 가능 여부 확인 필요 | 3상 메트릭 추가 또는 **대체**: `SWBD.CURRENT_A` 단일 라인으로 표시 |
| 유효전력 월평균 | 통계 | 월평균 계산 방식 미정의 | 해당 월 데이터 평균 계산 또는 별도 통계 API |
| 용도 | 속성 | `ast/gx` 기본정보에 용도 전용 필드 미존재 (API 요청 완료) | `asset.usageLabel`로 제공 예정 (필드명 미정) |

---

*최종 업데이트: 2026-02-04*
