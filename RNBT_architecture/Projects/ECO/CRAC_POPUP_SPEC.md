# 항온항습기(CRAC) 팝업 정보 화면 명세

**출처**: 기획서 PPT (v.0.8_260128.pptx) - "항온항습기 활성화 → 자산 클릭 시 상세정보 팝업"

---

## 팝업 구조 개요

팝업은 3개 섹션으로 구성됩니다.

```
┌─────────────────────────────────────────────────┐
│  ● 항온항습기 1                             [X] │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────┐  ┌──────────────────────┐         │
│  │          │  │  ① 기본정보 테이블    │         │
│  │  CRAC    │  │  자산명(ID), 자산타입, │         │
│  │  이미지   │  │  용도, 제조사명, 모델, │         │
│  │          │  │  위치, 상태, 설치일    │         │
│  └──────────┘  └──────────────────────┘         │
│                                                  │
│  항온항습기 상태정보                               │
│  ┌────────────────┐  ┌────────────────┐         │
│  │ 현재온도/설정온도 │  │ 현재습도/설정습도 │         │
│  │  24 °C / 32 °C │  │  23 % / 38 %  │         │
│  └────────────────┘  └────────────────┘         │
│                                                  │
│  ② 상태 인디케이터                                │
│  ┌──────────────────────────────────────┐       │
│  │  팬●  냉방●  난방●  가습●  제습●  누수● │       │
│  └──────────────────────────────────────┘       │
│                                                  │
│  ③ 온/습도 현황                                   │
│  ┌──────────────────────────────────────┐       │
│  │  ■ 온도  ● 습도                      │       │
│  │  ████████████████████ (바+라인 차트)  │       │
│  │  09시                         09시   │       │
│  └──────────────────────────────────────┘       │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## ① 기본정보 테이블

UPS/PDU 팝업과 동일한 8개 필드. 공통 기본정보 참조.

| 필드 | 예시 값 | API 소스 | 매핑 |
|------|---------|----------|------|
| 자산명 (ID) | CRAH-02 | `ast/gx` | `asset.name` |
| 자산타입 | 항온항습기 | `ast/gx` | `asset.assetType` |
| 용도 | 전산실 냉각 | `ast/gx` | `asset.usageLabel` (API 요청 완료, 필드명 미정) |
| 제조사명 | STULZ | `vdr/g` | `vendor.name` (asset.assetModelKey → mdl/g → model.assetVendorKey → vdr/g) |
| 모델 | GaCyberAir 3 | `mdl/g` | `model.name` (asset.assetModelKey → mdl/g) |
| 위치 | 2 층 전산실 B 존 | `ast/gx` | `asset.locationLabel` |
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

## 항온항습기 상태정보 (온습도 현재값)

| 항목 | 예시 값 | 데이터 소스 | 매핑 |
|------|---------|------------|------|
| 현재온도 | 24 °C | `mh/gl` | `CRAC.RETURN_TEMP` × scale(0.1) |
| 설정온도 | 32 °C | `mh/gl` | `CRAC.TEMP_SET` × scale(0.1) |
| 현재습도 | 23 % | `mh/gl` | `CRAC.RETURN_HUMIDITY` × scale(0.1) |
| 설정습도 | 38 % | `mh/gl` | `CRAC.HUMIDITY_SET` × scale(0.1) |

### 데이터 커버리지

| 항목 | 가능 여부 |
|------|----------|
| 현재온도 | **O** (`CRAC.RETURN_TEMP`) |
| 설정온도 | **O** (`CRAC.TEMP_SET`) |
| 현재습도 | **O** (`CRAC.RETURN_HUMIDITY`) |
| 설정습도 | **O** (`CRAC.HUMIDITY_SET`) |

---

## ② 상태 인디케이터

각 항목은 on/off 상태를 색상으로 표시합니다. (빨강=off/에러, 초록=on/정상)

| 항목 | 데이터 소스 | 매핑 |
|------|------------|------|
| 팬 | `mh/gl` | `CRAC.FAN_STATUS` |
| 냉방 | `mh/gl` | `CRAC.COOL_STATUS` |
| 난방 | `mh/gl` | `CRAC.HEAT_STATUS` |
| 가습 | `mh/gl` | `CRAC.HUMIDIFY_STATUS` |
| 제습 | `mh/gl` | `CRAC.DEHUMIDIFY_STATUS` |
| 누수 | `mh/gl` | `CRAC.LEAK_STATUS` |

> **참고**: 기획서 우측 설명에 생략 항목으로 "콤프레사상태, 인입온도, 인입습도, 온도설정값, 습도설정값, 공급온도" 기재. 이 중 콤프레사상태(`CRAC.UNIT_STATUS`)는 팝업에 미표시되나 metricConfig에 정의되어 있음.

### 데이터 커버리지

| 항목 | 가능 여부 |
|------|----------|
| 팬 | **O** (`CRAC.FAN_STATUS`) |
| 냉방 | **O** (`CRAC.COOL_STATUS`) |
| 난방 | **O** (`CRAC.HEAT_STATUS`) |
| 가습 | **O** (`CRAC.HUMIDIFY_STATUS`) |
| 제습 | **O** (`CRAC.DEHUMIDIFY_STATUS`) |
| 누수 | **O** (`CRAC.LEAK_STATUS`) |

---

## ③ 온/습도 현황 (트렌드 차트)

24시간 (전일 동시간 ~ 현재시간) 데이터를 표시합니다. 온도는 바 차트, 습도는 라인 차트로 복합 차트 구성.

### 차트 구성

| 시리즈 | 메트릭 | 차트 타입 | Y축 단위 |
|--------|--------|----------|---------|
| 온도 | `CRAC.RETURN_TEMP` | 바 차트 | °C |
| 습도 | `CRAC.RETURN_HUMIDITY` | 라인 차트 | % |

### API 호출

```
POST /api/v1/mhs/l
{
  "sort": [{ "field": "time", "direction": "ASC" }],
  "filter": {
    "assetKey": "crac-001",
    "interval": "1h",
    "metricCodes": ["CRAC.RETURN_TEMP", "CRAC.RETURN_HUMIDITY"],
    "timeFrom": "2026-02-02T09:00:00.000",
    "timeTo": "2026-02-03T09:00:00.000"
  },
  "statsKeys": ["avg"]
}
```

### 데이터 커버리지

| 항목 | 가능 여부 |
|------|----------|
| 온도 트렌드 | **O** (`CRAC.RETURN_TEMP`) |
| 습도 트렌드 | **O** (`CRAC.RETURN_HUMIDITY`) |
| 시계열 통계 API | **O** |

---

## 기획서 우측 확장 정보 (참고)

기획서 우측에는 팝업보다 더 확장된 자산 상세 정보가 표시됩니다.

| 필드 | 예시 값 | 가능 여부 |
|------|---------|----------|
| 담당자 | 홍길동 | **O** (※ `ownerUserId`로 사용자 이름 조회 API 확인 필요) |
| 설명 | 핫아일 대응 냉각 장비 | **O** |
| 장비타입 | CRAH | **O** (properties.equipment_type) |
| 정격냉방용량 | 120 kW | **O** (properties.rated_cooling_capacity) |
| 급·배기 방향 | 하부 급기 / 상부 배기 | **O** (properties.airflow_direction) |

---

## 종합: 미제공 데이터 항목

| 항목 | 유형 | 미제공 사유 | 대응 방안 |
|------|------|-----------|----------|
| 용도 | 속성 | `ast/gx` 기본정보에 용도 전용 필드 미존재 (API 요청 완료) | `asset.usageLabel`로 제공 예정 (필드명 미정) |

> **참고**: CRAC 팝업에 필요한 모든 메트릭(`CRAC.*`)이 metricConfig에 정의되어 있어, 미제공 메트릭 항목은 없음.

---

*최종 업데이트: 2026-02-03*
