# UPS 팝업 정보 화면 명세

**출처**: 기획서 PPT (v.0.8_260128.pptx) - "UPS 팝업 정보" 페이지

---

## 팝업 구조 개요

팝업은 3개 섹션으로 구성됩니다. (번호는 기획서 원 표기 기준)

```
┌─────────────────────────────────────────────────┐
│  ● UPS-01 자산정보                          [X] │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────┐  ┌──────────────────────┐         │
│  │          │  │  ① 기본정보 테이블    │         │
│  │  UPS     │  │  자산명(ID), 자산타입, │         │
│  │  이미지   │  │  용도, 제조사명, 모델, │         │
│  │          │  │  위치, 상태, 설치일    │         │
│  └──────────┘  └──────────────────────┘         │
│                                                  │
│  ② UPS 전력현황                                  │
│  ┌──────────────────────────────────────┐       │
│  │  배터리 사용률  ████░░  83%           │       │
│  │  * 배터리 잔여시간       8.3 h        │       │
│  │  * 부하율        ███░░  54%           │       │
│  │    배터리 출력전압       220V          │       │
│  └──────────────────────────────────────┘       │
│                                                  │
│  ③ UPS 입/출력 추이                              │
│  ┌──────────────────────────────────────┐       │
│  │ [입/출력 전류] [입/출력전압] [입/출력 주파수] │       │
│  │  ● 입력  ● 출력                       │       │
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
| 자산명 (ID) | UPS #1 | `ast/gx` | `asset.name` |
| 자산타입 | UPS | `ast/gx` | `asset.assetType` |
| 용도 | 주전원 | `ast/gx` | `asset.usageLabel` (API 요청 완료, 필드명 미정) |
| 제조사명 | APC | `vdr/g` | `vendor.name` (asset.assetModelKey → mdl/g → model.assetVendorKey → vdr/g) |
| 모델 | Galaxy 8000 | `mdl/g` | `model.name` (asset.assetModelKey → mdl/g) |
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

## ② UPS 전력현황

| 항목 | 예시 값 | 데이터 소스 | 매핑 |
|------|---------|------------|------|
| 배터리 사용률 | 83% | `mh/gl` | 메트릭에서 계산 (현재 metricConfig에 미정의) |
| 배터리 잔여시간 | 8.3 h | `mh/gl` | 메트릭에서 계산 (현재 metricConfig에 미정의) |
| 부하율 | 54% | `mh/gl` | 메트릭에서 계산 (현재 metricConfig에 미정의) |
| 배터리 출력전압 | 220V | `mh/gl` | `UPS.BATT_V` × scale(1.0) |

### 데이터 커버리지

| 항목 | 가능 여부 |
|------|----------|
| 배터리 사용률 | **X** |
| 배터리 잔여시간 | **X** |
| 부하율 | **X** |
| 배터리 출력전압 | **O** |

---

## ③ UPS 입/출력 추이 (트랜드 차트)

24시간 (전일 동시간 ~ 현재시간) 데이터를 표시합니다.

### 탭 구성

| 탭 | 입력 메트릭 | 출력 메트릭 | Y축 단위 |
|----|-----------|-----------|---------|
| 입/출력 전류 | `UPS.INPUT_A_1~3` | `UPS.OUTPUT_A_1~3` | A |
| 입/출력전압 | `UPS.INPUT_V_1~3` | `UPS.OUTPUT_V_1~3` | V |
| 입/출력 주파수 | `UPS.INPUT_F_1~3` | `UPS.OUTPUT_F_1~3` | Hz |

> **참고**: 축약 메트릭(`INPUT_V_AVG`, `INPUT_A_SUM`, `OUTPUT_V_AVG`, `OUTPUT_F_AVG`, `OUTPUT_A_SUM`)과 파생 메트릭(`INPUT_POWER_KW`, `OUTPUT_POWER_KW`)도 metricConfig에 정의됨. 차트에서 3상 개별 대신 축약값을 사용할 수 있음.

### API 호출

```
POST /api/v1/mhs/l
{
  "sort": [{ "field": "time", "direction": "ASC" }],
  "filter": {
    "assetKey": "ups-0001",
    "interval": "1h",
    "metricCodes": ["UPS.INPUT_A_1", "UPS.INPUT_A_2", "UPS.INPUT_A_3",
                    "UPS.OUTPUT_A_1", "UPS.OUTPUT_A_2", "UPS.OUTPUT_A_3"],
    "timeFrom": "2026-02-02T09:00:00.000",
    "timeTo": "2026-02-03T09:00:00.000"
  },
  "statsKeys": ["avg"]
}
```

### 데이터 커버리지

| 항목 | 가능 여부 |
|------|----------|
| 입력 전류 (R/S/T) | **O** |
| 출력 전류 (R/S/T) | **O** |
| 입력 전압 (R/S/T) | **O** |
| 출력 전압 (R/S/T) | **O** |
| 입력 주파수 (R/S/T) | **O** |
| 출력 주파수 (R/S/T) | **O** |
| 시계열 통계 API | **O** |

---

## 기획서 우측 확장 정보 (참고)

기획서 우측에는 팝업보다 더 확장된 자산 상세 정보가 표시됩니다.

| 필드 | 예시 값 | 가능 여부 |
|------|---------|----------|
| 담당자 | 홍길동 | **O** (※ `ownerUserId`로 사용자 이름 조회 API 확인 필요) |
| 설명 | 주 전력 공급 장치 | **O** |
| 정격 용량 | 500kVA | **O** |
| 출력 전압 | 380V | **O** |
| 출력 상 | 3 상 | **O** (properties) |
| UPS 타입 | 온라인 | **O** (properties) |
| 배터리 구성 | 리튬이온 | **O** (properties) |

---

## 종합: 미제공 데이터 항목

| 항목 | 유형 | 미제공 사유 | 대응 방안 |
|------|------|-----------|----------|
| 배터리 사용률 (SOC, State of Charge: 배터리 잔존 충전량 비율) | 메트릭 | metricConfig에 `UPS.BATT_SOC` 코드 미정의. 장비가 직접 보고하는 SOC 메트릭이 없음 | metricConfig에 `UPS.BATT_SOC` 추가 + mock server. **대체**: 배터리 전압(`UPS.BATT_V`)으로 표시 |
| 배터리 잔여시간 | 메트릭 | metricConfig에 `UPS.BATT_REMAIN_TIME` 코드 미정의. 장비가 직접 보고하는 잔여시간 메트릭이 없음 | metricConfig에 `UPS.BATT_REMAIN_TIME` 추가 + mock server. **대체**: 배터리 상태(`UPS.BATT_CHARGING`, `UPS.OUTPUT_ON_BATTERY`)로 표시 |
| 부하율 | 메트릭 | metricConfig에 `UPS.LOAD_RATE` 코드 미정의. 장비가 직접 보고하는 부하율 메트릭이 없음 | metricConfig에 `UPS.LOAD_RATE` 추가 + mock server. **대체**: `UPS.OUTPUT_POWER_KW` / 정격용량(properties.rated_capacity)으로 프론트 계산 가능 |
| 용도 | 속성 | `ast/gx` 기본정보에 용도 전용 필드 미존재 (API 요청 완료) | `asset.usageLabel`로 제공 예정 (필드명 미정) |

---

*최종 업데이트: 2026-02-03*
