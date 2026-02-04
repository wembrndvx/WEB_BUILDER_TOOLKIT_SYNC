# 분전반(PDU) 팝업 정보 화면 명세

**출처**: 기획서 PPT (v.0.8_260128.pptx) - "분전반 활성화 → 자산 클릭 시 상세정보 팝업"

---

## 팝업 구조 개요

팝업은 2개 섹션으로 구성됩니다. (UPS와 달리 전력현황 섹션 없음)

```
┌─────────────────────────────────────────────────┐
│  ● 분전반-01                                [X] │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────┐  ┌──────────────────────┐         │
│  │          │  │  ① 기본정보 테이블    │         │
│  │  분전반   │  │  자산명(ID), 자산타입, │         │
│  │  이미지   │  │  용도, 제조사명, 모델, │         │
│  │          │  │  위치, 상태, 설치일    │         │
│  └──────────┘  └──────────────────────┘         │
│                                                  │
│  ② 실시간 전력추이현황                            │
│  ┌──────────────────────────────────────┐       │
│  │ [전압] [전류] [전력사용량] [입력주파수]  │       │
│  │  ● A 상  ● B 상  ● C 상              │       │
│  │  ~~~~~~~~~~~~~~~~~~~~~~~~~ (라인 차트) │       │
│  │  07:00               08:00    09:00   │       │
│  └──────────────────────────────────────┘       │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## ① 기본정보 테이블

UPS 팝업과 동일한 8개 필드. 공통 기본정보 참조.

| 필드 | 예시 값 | API 소스 | 매핑 |
|------|---------|----------|------|
| 자산명 (ID) | PDB-01 | `ast/gx` | `asset.name` |
| 자산타입 | 분전반 | `ast/gx` | `asset.assetType` |
| 용도 | 랙 전원 분배 | `ast/gx` | `asset.usageLabel` (API 요청 완료, 필드명 미정) |
| 제조사명 | LS ELECTRIC | `vdr/g` | `vendor.name` (asset.assetModelKey → mdl/g → model.assetVendorKey → vdr/g) |
| 모델 | SUS-PDB-800 | `mdl/g` | `model.name` (asset.assetModelKey → mdl/g) |
| 위치 | 2 층 전기실 | `ast/gx` | `asset.locationLabel` |
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

## ② 분전반 운전 상태 추이 (트렌드 차트)

24시간 (전일 동시간 ~ 현재시간) 데이터를 표시합니다.

### 탭 구성

| 탭 | 기획서 범례 | Y축 단위 | 현재 metricConfig | 비고 |
|----|------------|---------|-------------------|------|
| 전압 | A상, B상, C상 | V | `DIST.V_LN_AVG` (평균만) | **X** 3상 개별 메트릭 미정의 |
| 전류 | A상, B상, C상 | A | `DIST.CURRENT_AVG_A` (평균만) | **X** 3상 개별 메트릭 미정의 |
| 전력사용량 | 금일, 전일 | kW | `DIST.ACTIVE_POWER_TOTAL_KW` | **O** 시간대 조정으로 비교 가능 |
| 입력주파수 | (없음) | Hz | `DIST.FREQUENCY_HZ` | **O** 단일값 |

> **문제점**: 기획서 차트는 A상·B상·C상 3개 라인을 개별 표시하지만, 현재 metricConfig의 DIST 메트릭은 평균/합계값만 정의되어 있어 3상 개별 표시 불가.

### 3상 개별 표시를 위해 필요한 메트릭 (미정의)

| 탭 | 필요 메트릭 코드 | 설명 |
|----|----------------|------|
| 전압 | `DIST.V_LN_1`, `DIST.V_LN_2`, `DIST.V_LN_3` | 선간전압 A/B/C상 |
| 전류 | `DIST.CURRENT_1_A`, `DIST.CURRENT_2_A`, `DIST.CURRENT_3_A` | 전류 A/B/C상 |

### 대체 방안: 평균/합계값으로 단일 라인 표시

3상 개별 메트릭이 확보되기 전까지, 기존 DIST 메트릭으로 단일 라인 차트를 구성할 수 있음.

| 탭 | 사용 메트릭 | 표시 방식 |
|----|-----------|----------|
| 전압 | `DIST.V_LN_AVG` | 평균 전압 1개 라인 |
| 전류 | `DIST.CURRENT_AVG_A` | 평균 전류 1개 라인 |
| 전력사용량 | `DIST.ACTIVE_POWER_TOTAL_KW` | 금일/전일 2개 라인 비교 |
| 입력주파수 | `DIST.FREQUENCY_HZ` | 주파수 1개 라인 |

### API 호출

**전압/전류/주파수 (금일 24시간)**:
```
POST /api/v1/mhs/l
{
  "sort": [{ "field": "time", "direction": "ASC" }],
  "filter": {
    "assetKey": "pdu-001",
    "interval": "1h",
    "metricCodes": ["DIST.V_LN_AVG", "DIST.CURRENT_AVG_A", "DIST.FREQUENCY_HZ"],
    "timeFrom": "2026-02-03T07:00:00.000",
    "timeTo": "2026-02-04T09:00:00.000"
  },
  "statsKeys": ["avg"]
}
```

**전력사용량 (금일 + 전일 비교)**:
```
// 금일 데이터
POST /api/v1/mhs/l
{
  "filter": {
    "assetKey": "pdu-001",
    "interval": "1h",
    "metricCodes": ["DIST.ACTIVE_POWER_TOTAL_KW"],
    "timeFrom": "2026-02-03T07:00:00.000",
    "timeTo": "2026-02-04T09:00:00.000"
  },
  "statsKeys": ["avg"]
}

// 전일 데이터
POST /api/v1/mhs/l
{
  "filter": {
    "assetKey": "pdu-001",
    "interval": "1h",
    "metricCodes": ["DIST.ACTIVE_POWER_TOTAL_KW"],
    "timeFrom": "2026-02-02T07:00:00.000",
    "timeTo": "2026-02-03T09:00:00.000"
  },
  "statsKeys": ["avg"]
}
```

### 데이터 커버리지

| 항목 | 가능 여부 |
|------|----------|
| 전압 (3상 개별) | **X** - 3상 개별 메트릭 미정의 |
| 전압 (평균) | **O** - `DIST.V_LN_AVG` |
| 전류 (3상 개별) | **X** - 3상 개별 메트릭 미정의 |
| 전류 (평균) | **O** - `DIST.CURRENT_AVG_A` |
| 전력사용량 (금일) | **O** - `DIST.ACTIVE_POWER_TOTAL_KW` |
| 전력사용량 (전일) | **O** - timeFrom/timeTo 조정으로 조회 |
| 입력주파수 | **O** - `DIST.FREQUENCY_HZ` |
| 시계열 통계 API | **O** |

---

## 기획서 우측 확장 정보 (참고)

기획서 우측에는 팝업보다 더 확장된 자산 상세 정보가 표시됩니다.

| 필드 | 예시 값 | 가능 여부 |
|------|---------|----------|
| 담당자 | 홍길동 | **O** (※ `ownerUserId`로 사용자 이름 조회 API 확인 필요) |
| 설명 | 전산실 A 존 주 분전반 | **O** |
| 정격전압 | 380V | **O** (properties.rated_voltage) |
| 정격전류 | 800 A | **O** (properties.rated_current) |
| 상 | 3Ø (3 상) | **O** (properties.phase) |
| 주 차단기 용량 | 1000 A | **O** (properties.main_breaker_capacity) |
| 상위전원장비 | UPS-01 | **O** (properties.upstream_equipment) |

---

## 종합: 미제공 데이터 항목

| 항목 | 유형 | 미제공 사유 | 대응 방안 |
|------|------|-----------|----------|
| 전압 3상 개별 (A/B/C) | 메트릭 | metricConfig에 `DIST.V_LN_1~3` 미정의. 인터페이스에서 3상 개별값 수신 가능 여부 확인 필요 | 3상 메트릭 추가 또는 **대체**: `DIST.V_LN_AVG` 단일 라인으로 표시 |
| 전류 3상 개별 (A/B/C) | 메트릭 | metricConfig에 `DIST.CURRENT_1~3_A` 미정의. 인터페이스에서 3상 개별값 수신 가능 여부 확인 필요 | 3상 메트릭 추가 또는 **대체**: `DIST.CURRENT_AVG_A` 단일 라인으로 표시 |
| 용도 | 속성 | `ast/gx` 기본정보에 용도 전용 필드 미존재 (API 요청 완료) | `asset.usageLabel`로 제공 예정 (필드명 미정) |

---

*최종 업데이트: 2026-02-04*
