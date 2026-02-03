# ECO API 명세 (Asset API v1)

**Base URL**: `http://10.23.128.125:4004`

**프로젝트 설명**: 데이터센터 전력/냉방 장비 모니터링 대시보드

---

## API 개요

ECO 프로젝트는 Asset API v1만 사용합니다. 모든 API는 POST 메서드를 사용하며, JSON 형식으로 요청/응답합니다.

### 사용 가능한 API

**Asset API**

| API | 메서드 | 설명 |
|-----|--------|------|
| `/api/v1/ast/l` | POST | 자산 전체 목록 조회 |
| `/api/v1/ast/la` | POST | 자산 목록 조회 (페이징) |
| `/api/v1/ast/g` | POST | 자산 단건 조회 |
| `/api/v1/ast/gx` | POST | 자산 상세 조회 (통합 API) |
| `/api/v1/rel/l` | POST | 관계 전체 목록 조회 |
| `/api/v1/rel/la` | POST | 관계 목록 조회 (페이징) |
| `/api/v1/rel/g` | POST | 관계 단건 조회 |

**Metric API**

| API | 메서드 | 설명 |
|-----|--------|------|
| `/api/v1/mh/gl` | POST | 자산별 최신 메트릭 데이터 조회 |

**Metric History Stats API**

| API | 메서드 | 설명 |
|-----|--------|------|
| `/api/v1/mhs/l` | POST | 메트릭 통계 기간 리스트 조회 |
| `/api/v1/mhs/g` | POST | 메트릭 통계 단건 조회 |

**Vendor API**

| API | 메서드 | 설명 |
|-----|--------|------|
| `/api/v1/vdr/la` | POST | 벤더 목록 조회 (페이징) |
| `/api/v1/vdr/l` | POST | 벤더 전체 목록 조회 |
| `/api/v1/vdr/g` | POST | 벤더 단건 조회 |

**Model API**

| API | 메서드 | 설명 |
|-----|--------|------|
| `/api/v1/mdl/la` | POST | 자산 모델 목록 조회 (페이징) |
| `/api/v1/mdl/l` | POST | 자산 모델 전체 목록 조회 |
| `/api/v1/mdl/g` | POST | 자산 모델 단건 조회 |

---

## 1. 자산 전체 목록 조회

### Request

```
POST /api/v1/ast/l
Content-Type: application/json
```

```json
{
  "filter": {},
  "sort": [{ "field": "createdAt", "direction": "DESC" }]
}
```

### Filter Options

| 필드 | 타입 | 설명 |
|------|------|------|
| assetType | string | 자산 타입 필터 (예: "UPS", "PDU", "CRAC") |
| assetKey | string | 자산 키 검색 (부분 매칭) |
| statusType | string | 상태 필터 ("ACTIVE", "WARNING", "CRITICAL") |

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "assetKey": "ups-0001",
      "assetModelId": null,
      "assetModelKey": null,
      "ownerUserId": null,
      "serviceType": "DCM",
      "domainType": "FACILITY",
      "assetCategoryType": "EQUIPMENT",
      "assetType": "UPS",
      "usageCode": null,
      "serialNumber": "SN-ups-0001",
      "name": "UPS 0001",
      "locationCode": "room-001-01-01",
      "locationLabel": "서버실 A",
      "description": "UPS 0001 (ups)",
      "statusType": "ACTIVE",
      "installDate": "2024-01-15",
      "decommissionDate": null,
      "property": "{\"canHaveChildren\": false}",
      "createdAt": "2024-01-15T09:00:00Z",
      "updatedAt": "2026-01-26T12:00:00Z"
    }
  ],
  "error": null,
  "timestamp": "2026-01-26T12:00:00Z",
  "path": "/api/v1/ast/l"
}
```

### Response Fields

| 필드 | 타입 | 설명 |
|------|------|------|
| assetKey | string | 자산 고유 키 |
| assetType | string | 자산 타입 (BUILDING, FLOOR, ROOM, RACK, UPS, PDU, CRAC, SENSOR 등) |
| assetCategoryType | string | 자산 카테고리 (LOCATION: 컨테이너, EQUIPMENT: 장비) |
| name | string | 자산 이름 |
| locationCode | string | 부모 자산 키 |
| locationLabel | string | 부모 자산 이름 |
| statusType | string | 상태 (ACTIVE, WARNING, CRITICAL, INACTIVE, MAINTENANCE) |
| installDate | string | 설치일 (ISO 날짜) |
| serialNumber | string | 시리얼 번호 |

---

## 2. 자산 목록 조회 (페이징)

### Request

```
POST /api/v1/ast/la
Content-Type: application/json
```

```json
{
  "page": 0,
  "size": 20,
  "filter": {},
  "sort": [{ "field": "createdAt", "direction": "DESC" }]
}
```

### Response

```json
{
  "success": true,
  "data": {
    "content": [...],
    "page": 0,
    "size": 20,
    "totalElements": 1500,
    "totalPages": 75,
    "first": true,
    "last": false,
    "empty": false
  },
  "error": null,
  "timestamp": "2026-01-26T12:00:00Z",
  "path": "/api/v1/ast/la"
}
```

---

## 3. 자산 단건 조회

### Request

```
POST /api/v1/ast/g
Content-Type: application/json
```

```json
{
  "assetKey": "ups-0001"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "assetKey": "ups-0001",
    "assetType": "UPS",
    "assetCategoryType": "EQUIPMENT",
    "name": "UPS 0001",
    "locationCode": "room-001-01-01",
    "locationLabel": "서버실 A",
    "statusType": "ACTIVE",
    "serialNumber": "SN-ups-0001",
    "installDate": "2024-01-15",
    "description": "UPS 0001 (ups)",
    ...
  },
  "error": null,
  "timestamp": "2026-01-26T12:00:00Z",
  "path": "/api/v1/ast/g"
}
```

### Error Response (404)

```json
{
  "success": false,
  "data": null,
  "error": {
    "key": "ASSET_NOT_FOUND",
    "message": "Asset not found: invalid-key",
    "data": null
  },
  "timestamp": "2026-01-26T12:00:00Z",
  "path": "/api/v1/ast/g"
}
```

---

## 4. 관계 전체 목록 조회

### Request

```
POST /api/v1/rel/l
Content-Type: application/json
```

```json
{
  "filter": {},
  "sort": [{ "field": "createdAt", "direction": "DESC" }]
}
```

### Filter Options

| 필드 | 타입 | 설명 |
|------|------|------|
| fromAssetKey | string | 자식 자산 키 |
| toAssetKey | string | 부모 자산 키 |
| relationType | string | 관계 타입 (예: "LOCATED_IN") |

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "fromAssetKey": "floor-001-01",
      "toAssetKey": "building-001",
      "relationType": "LOCATED_IN",
      "attr": null,
      "createdAt": "2024-01-15T09:00:00Z",
      "updatedAt": "2026-01-26T12:00:00Z"
    }
  ],
  "error": null,
  "timestamp": "2026-01-26T12:00:00Z",
  "path": "/api/v1/rel/l"
}
```

### Response Fields

| 필드 | 타입 | 설명 |
|------|------|------|
| fromAssetKey | string | 자식 자산 키 (관계의 출발점) |
| toAssetKey | string | 부모 자산 키 (관계의 도착점) |
| relationType | string | 관계 타입 |

---

## 5. 관계 목록 조회 (페이징)

### Request

```
POST /api/v1/rel/la
Content-Type: application/json
```

```json
{
  "page": 0,
  "size": 100,
  "filter": {},
  "sort": []
}
```

### Response

페이징 응답 구조는 자산 목록 조회 (페이징)과 동일합니다.

---

## 6. 관계 단건 조회

### Request

```
POST /api/v1/rel/g
Content-Type: application/json
```

```json
{
  "id": 1
}
```

---

## 7. 자산 상세 조회 (통합 API)

Asset 기본 정보와 카테고리별 속성을 한 번에 조회합니다.

### Request

```
POST /api/v1/ast/gx
Content-Type: application/json
```

```json
{
  "assetKey": "ups-0001",
  "locale": "ko"
}
```

### Request Parameters

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| assetKey | string | O | 자산 고유 키 |
| locale | string | X | 언어 코드 (기본값: "ko") |

### Response

```json
{
  "success": true,
  "data": {
    "asset": {
      "assetKey": "ups-0001",
      "name": "UPS 0001",
      "assetType": "UPS",
      "assetCategoryType": "UPS",
      "statusType": "ACTIVE",
      "locationLabel": "서버실 A",
      "serialNumber": "SN-ups-0001",
      "assetModelKey": null,
      "installDate": "2024-01-15",
      "ownerUserId": null,
      "description": "UPS 0001 (ups)"
    },
    "properties": [
      {
        "fieldKey": "rated_power_kw",
        "value": 75,
        "label": "정격 전력",
        "helpText": "UPS 명판 기준 정격 전력 (kW)",
        "displayOrder": 1
      },
      {
        "fieldKey": "battery_capacity_ah",
        "value": 150,
        "label": "배터리 용량",
        "helpText": "배터리 총 용량 (Ah)",
        "displayOrder": 2
      },
      {
        "fieldKey": "efficiency_percent",
        "value": 94.5,
        "label": "효율",
        "helpText": "정격 부하 시 효율 (%)",
        "displayOrder": 3
      }
    ]
  },
  "error": null,
  "timestamp": "2026-01-27T12:00:00Z",
  "path": "/api/v1/ast/gx"
}
```

### Response Fields

**asset 객체**

| 필드 | 타입 | 설명 |
|------|------|------|
| assetKey | string | 자산 고유 키 |
| name | string | 자산 이름 |
| assetType | string | 자산 타입 |
| assetCategoryType | string | 자산 카테고리 |
| statusType | string | 상태 |
| locationLabel | string | 위치 이름 |
| serialNumber | string | 시리얼 번호 |
| installDate | string | 설치일 |

**properties 배열**

| 필드 | 타입 | 설명 |
|------|------|------|
| fieldKey | string | 속성 키 |
| value | any | 속성 값 |
| label | string | 표시 라벨 (locale 기반) |
| helpText | string | 도움말 텍스트 |
| displayOrder | number | 표시 순서 |

### 공통 기본정보 (전 자산 타입 공통)

| 필드 | label (ko) | API 소스 | 매핑 |
|------|-----------|----------|------|
| 자산명 (ID) | 자산명 | `ast/gx` | `asset.name` |
| 자산타입 | 자산타입 | `ast/gx` | `asset.assetType` |
| 용도 | 용도 | `ast/gx` | `asset.usageLabel` (API 요청 완료, 필드명 미정) |
| 제조사명 | 제조사명 | `vdr/g` | `vendor.name` (asset.assetModelKey → mdl/g → vdr/g) |
| 모델 | 모델 | `mdl/g` | `model.name` (asset.assetModelKey → mdl/g) |
| 위치 | 위치 | `ast/gx` | `asset.locationLabel` |
| 상태 | 상태 | `ast/gx` | `asset.statusType` → UI 라벨 변환 |
| 설치일 | 설치일 | `ast/gx` | `asset.installDate` → 날짜 포맷 변환 |
| 담당자 | 담당자 | `ast/gx` | `asset.ownerUserId` → 사용자 이름 조회 (API 확인 필요) |
| 설명 | 설명 | `ast/gx` | `asset.description` |

### 자산 타입별 properties 항목

#### UPS

| fieldKey | label (ko) | 예시 값 |
|----------|-----------|---------|
| rated_capacity | 정격 용량 | 500kVA |
| output_voltage | 출력 전압 | 380V |
| output_phase | 출력 상 | 3상 |
| ups_type | UPS 타입 | 온라인 |
| battery_type | 배터리 구성 | 리튬이온 |

#### 분전반 (PDU)

| fieldKey | label (ko) | 예시 값 |
|----------|-----------|---------|
| rated_voltage | 정격전압 | 380V |
| rated_current | 정격전류 | 800 A |
| phase | 상 | 3Ø (3상) |
| main_breaker_capacity | 주 차단기 용량 | 1000 A |
| upstream_equipment | 상위전원장비 | UPS-01 |

#### 수배전반 (SWBD)

| fieldKey | label (ko) | 예시 값 |
|----------|-----------|---------|
| rated_voltage | 정격전압 | 22.9 kV |
| rated_current | 정격전류 | 1,250 A |
| rated_breaking_current | 정격차단전류 | 25 kA |
| breaker_type | 차단기 타입 | VCB |

#### 항온항습기 (CRAC)

| fieldKey | label (ko) | 예시 값 |
|----------|-----------|---------|
| equipment_type | 장비타입 | CRAH |
| rated_cooling_capacity | 정격냉방용량 | 120 kW |
| airflow_direction | 급·배기 방향 | 하부 급기 / 상부 배기 |

#### 온습도센서 (TempHumiditySensor)

| fieldKey | label (ko) | 예시 값 |
|----------|-----------|---------|
| measurement_range | 측정범위 | -10 ~ 60 ℃ / 0 ~ 95 %RH |
| accuracy | 정확도 | ±0.3 ℃ / ±2 %RH |
| install_position_type | 설치 위치 유형 | 랙 전면 흡입부 |

---

## 8. 자산별 최신 메트릭 데이터 조회

특정 자산(asset_key)의 metric_code별 최신 데이터를 조회합니다. 최근 1분 이내 데이터만 조회됩니다.

### Request

```
POST /api/v1/mh/gl
Content-Type: application/json
```

```json
{
  "assetKey": "DC1-TEMP-01"
}
```

### Request Parameters

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| assetKey | string | O | 자산 고유 키 |

### Response

```json
{
  "data": [
    {
      "metricCode": "SENSOR.HUMIDITY",
      "eventedAt": "2026-01-28T06:31:49.039Z",
      "valueType": "NUMBER",
      "valueNumber": 52.1,
      "extra": "{\"tags\": {\"profileId\": \"SENSOR_V1\"}}"
    },
    {
      "metricCode": "SENSOR.TEMP",
      "eventedAt": "2026-01-28T06:31:49.039Z",
      "valueType": "NUMBER",
      "valueNumber": 24.5,
      "extra": "{\"tags\": {\"profileId\": \"SENSOR_V1\", \"endpointId\": 1}}"
    }
  ],
  "path": "/api/v1/mh/gl",
  "success": true,
  "timestamp": "2026-01-28T15:31:51"
}
```

### Response Fields

| 필드 | 타입 | 설명 |
|------|------|------|
| metricCode | string | 메트릭 코드 (예: SENSOR.TEMP, SENSOR.HUMIDITY) |
| eventedAt | string | 측정 시각 (ISO 8601) |
| valueType | string | 값 타입 (NUMBER, STRING 등) |
| valueNumber | number | 숫자 값 (valueType이 NUMBER인 경우) |
| valueString | string | 문자열 값 (valueType이 STRING인 경우) |
| extra | string | 추가 정보 (JSON 문자열) |

### Metric Code 참조

센서 메트릭 코드는 `metricConfig.json` 파일을 참조하세요.

| metricCode | 라벨 | 단위 | 설명 |
|------------|------|------|------|
| SENSOR.TEMP | 온도 | °C | 센서 온도 |
| SENSOR.HUMIDITY | 습도 | %RH | 상대습도 |
| SENSOR.MEASURED_AT | 측정시각 | timestamp | 측정시각(필요 시) |

---

## 9. 벤더 목록 조회 (페이징)

### Request

```
POST /api/v1/vdr/la
Content-Type: application/json
```

```json
{
  "page": 0,
  "size": 20,
  "sort": [{ "field": "createdAt", "direction": "DESC" }],
  "filter": {
    "code": "DELL",
    "name": "Dell Technologies",
    "country": "USA",
    "q": "Dell"
  }
}
```

### Filter Options

| 필드 | 타입 | 설명 |
|------|------|------|
| code | string | 벤더 코드 |
| name | string | 벤더 이름 |
| country | string | 국가 |
| q | string | 통합 검색 (코드, 이름, 국가) |

### Response

```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 1,
        "assetVendorKey": "VENDOR_DELL_001",
        "name": "Dell",
        "code": "DELL",
        "country": "USA",
        "extra": "{\"website\":\"https://www.dell.com\"}",
        "createdAt": "2026-02-03T00:40:37.389Z",
        "updatedAt": "2026-02-03T00:40:37.389Z"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 0,
    "totalPages": 0,
    "first": true,
    "last": true,
    "empty": true
  },
  "error": null,
  "timestamp": "2026-02-03T00:40:37.389Z",
  "path": "/api/v1/vdr/la"
}
```

---

## 10. 벤더 전체 목록 조회

### Request

```
POST /api/v1/vdr/l
Content-Type: application/json
```

```json
{
  "sort": [{ "field": "createdAt", "direction": "DESC" }],
  "filter": {
    "code": "DELL",
    "name": "Dell Technologies",
    "country": "USA",
    "q": "Dell"
  }
}
```

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "assetVendorKey": "VENDOR_DELL_001",
      "name": "Dell",
      "code": "DELL",
      "country": "USA",
      "extra": "{\"website\":\"https://www.dell.com\"}",
      "createdAt": "2026-02-03T00:41:53.980Z",
      "updatedAt": "2026-02-03T00:41:53.980Z"
    }
  ],
  "error": null,
  "timestamp": "2026-02-03T00:41:53.980Z",
  "path": "/api/v1/vdr/l"
}
```

---

## 11. 벤더 단건 조회

### Request

```
POST /api/v1/vdr/g
Content-Type: application/json
```

```json
{
  "assetVendorKey": "VENDOR-001"
}
```

### Request Parameters

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| assetVendorKey | string | O | 벤더 고유 키 |

### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "assetVendorKey": "VENDOR_DELL_001",
    "name": "Dell",
    "code": "DELL",
    "country": "USA",
    "extra": "{\"website\":\"https://www.dell.com\"}",
    "createdAt": "2026-02-03T00:42:11.840Z",
    "updatedAt": "2026-02-03T00:42:11.840Z"
  },
  "error": null,
  "timestamp": "2026-02-03T00:42:11.840Z",
  "path": "/api/v1/vdr/g"
}
```

### Response Fields

| 필드 | 타입 | 설명 |
|------|------|------|
| assetVendorKey | string | 벤더 고유 키 |
| name | string | 벤더 이름 |
| code | string | 벤더 코드 |
| country | string | 국가 |
| extra | string | 추가 정보 (JSON 문자열) |
| createdAt | string | 생성일시 (ISO 8601) |
| updatedAt | string | 수정일시 (ISO 8601) |

---

## 12. 자산 모델 목록 조회 (페이징)

### Request

```
POST /api/v1/mdl/la
Content-Type: application/json
```

```json
{
  "page": 0,
  "size": 20,
  "sort": [{ "field": "createdAt", "direction": "DESC" }],
  "filter": {
    "assetVendorKey": "VENDOR_DELL_001",
    "categoryCode": "SERVER",
    "code": "R750",
    "name": "PowerEdge",
    "q": "Dell"
  }
}
```

### Filter Options

| 필드 | 타입 | 설명 |
|------|------|------|
| assetVendorKey | string | 벤더 키 |
| categoryCode | string | 카테고리 코드 |
| code | string | 모델 코드 |
| name | string | 모델 이름 |
| q | string | 통합 검색 |

### Response

```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 1,
        "vendorName": "Dell",
        "assetModelKey": "MODEL_DELL_R750_001",
        "assetVendorKey": "VENDOR_DELL_001",
        "name": "PowerEdge R750",
        "code": "R750",
        "categoryCode": "SERVER",
        "specJson": "{\"cpu\":\"Intel Xeon\",\"ram\":\"128GB\"}",
        "createdAt": "2026-02-03T00:44:04.615Z",
        "updatedAt": "2026-02-03T00:44:04.615Z"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 0,
    "totalPages": 0,
    "first": true,
    "last": true,
    "empty": true
  },
  "error": null,
  "timestamp": "2026-02-03T00:44:04.615Z",
  "path": "/api/v1/mdl/la"
}
```

---

## 13. 자산 모델 전체 목록 조회

### Request

```
POST /api/v1/mdl/l
Content-Type: application/json
```

```json
{
  "sort": [{ "field": "createdAt", "direction": "DESC" }],
  "filter": {
    "assetVendorKey": "VENDOR_DELL_001",
    "categoryCode": "SERVER",
    "code": "R750",
    "name": "PowerEdge",
    "q": "Dell"
  }
}
```

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "vendorName": "Dell",
      "assetModelKey": "MODEL_DELL_R750_001",
      "assetVendorKey": "VENDOR_DELL_001",
      "name": "PowerEdge R750",
      "code": "R750",
      "categoryCode": "SERVER",
      "specJson": "{\"cpu\":\"Intel Xeon\",\"ram\":\"128GB\"}",
      "createdAt": "2026-02-03T00:44:48.520Z",
      "updatedAt": "2026-02-03T00:44:48.520Z"
    }
  ],
  "error": null,
  "timestamp": "2026-02-03T00:44:48.520Z",
  "path": "/api/v1/mdl/l"
}
```

---

## 14. 자산 모델 단건 조회

### Request

```
POST /api/v1/mdl/g
Content-Type: application/json
```

```json
{
  "assetModelKey": "MODEL-001"
}
```

### Request Parameters

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| assetModelKey | string | O | 모델 고유 키 |

### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "vendorName": "Dell",
    "assetModelKey": "MODEL_DELL_R750_001",
    "assetVendorKey": "VENDOR_DELL_001",
    "name": "PowerEdge R750",
    "code": "R750",
    "categoryCode": "SERVER",
    "specJson": "{\"cpu\":\"Intel Xeon\",\"ram\":\"128GB\"}",
    "createdAt": "2026-02-03T00:45:11.108Z",
    "updatedAt": "2026-02-03T00:45:11.108Z"
  },
  "error": null,
  "timestamp": "2026-02-03T00:45:11.108Z",
  "path": "/api/v1/mdl/g"
}
```

### Response Fields

| 필드 | 타입 | 설명 |
|------|------|------|
| assetModelKey | string | 모델 고유 키 |
| assetVendorKey | string | 벤더 키 (FK) |
| vendorName | string | 벤더 이름 (조인) |
| name | string | 모델 이름 |
| code | string | 모델 코드 |
| categoryCode | string | 카테고리 코드 |
| specJson | string | 스펙 정보 (JSON 문자열) |
| createdAt | string | 생성일시 (ISO 8601) |
| updatedAt | string | 수정일시 (ISO 8601) |

---

## 15. 메트릭 통계 기간 리스트 조회

특정 기간(timeFrom ~ timeTo) 동안의 통계 row를 전체 배열(List)로 조회합니다. `interval` 값에 따라 조회 테이블이 결정됩니다.

- `interval=1m` → `dh_metric_history_stats_1m`
- `interval=1h` → `dh_metric_history_stats_1h`

페이징 없이 전체 결과를 반환하므로 기간/건수 제한을 운영 정책으로 권장합니다.

### Request

```
POST /api/v1/mhs/l
Content-Type: application/json
```

```json
{
  "sort": [
    { "field": "time", "direction": "ASC" }
  ],
  "filter": {
    "assetKey": "AST-000123",
    "interval": "1h",
    "metricCodes": ["temperature", "loadRate"],
    "timeFrom": "2026-01-20T00:00:00.000",
    "timeTo": "2026-01-23T23:59:59.999"
  },
  "statsKeys": ["avg", "max", "count", "numeric_count"]
}
```

### Request Parameters

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| sort | array | X | 정렬 (기본 time ASC 권장) |
| filter.assetKey | string | O | 자산 Key |
| filter.interval | string | O | 집계 주기 (지원: `1m`, `1h`) |
| filter.metricCodes | array(string) | X | 메트릭 코드 목록 (미지정 시 전체) |
| filter.timeFrom | string | O | 조회 시작 (포함, ISO 8601) |
| filter.timeTo | string | O | 조회 종료 (포함, ISO 8601) |
| statsKeys | array(string) | X | statsBody에서 반환할 키 제한 (미지정 시 전체) |

### Response

```json
{
  "success": true,
  "data": [
    {
      "time": "2026-01-23T10:00:00.000",
      "assetKey": "AST-000123",
      "metricCode": "temperature",
      "interval": "1h",
      "statsBody": {
        "avg": 25.1,
        "max": 29.2,
        "count": 3600,
        "numeric_count": 3590
      },
      "windowStartAt": "2026-01-23T10:00:00.000",
      "windowEndAt": "2026-01-23T10:59:59.999999",
      "sampleCount": 3600,
      "endpointId": null,
      "sensorExternalId": null,
      "createdAt": "2026-01-23T11:02:00.000",
      "updatedAt": "2026-01-23T11:05:00.000"
    }
  ],
  "error": null,
  "timestamp": "2026-02-03T00:53:36.751Z",
  "path": "/api/v1/mhs/l"
}
```

### Response Fields (MhsDto)

| 필드 | 타입 | 설명 |
|------|------|------|
| time | string | 버킷 시작 시각 (ISO 8601) |
| assetKey | string | 자산 Key |
| metricCode | string | 메트릭 코드 |
| interval | string | 집계 주기 (요청 값 그대로 포함) |
| statsBody | object | 통계 값 (count, numeric_count, avg, min, max 등) |
| windowStartAt | string | 윈도우 시작 시각 |
| windowEndAt | string | 윈도우 종료 시각 |
| sampleCount | number | 샘플 수 |
| endpointId | string\|null | v1에서는 null 고정 |
| sensorExternalId | string\|null | v1에서는 null 고정 |
| createdAt | string | 생성일시 |
| updatedAt | string | 수정일시 |

### statsBody 지원 키

| 키 | 설명 |
|----|------|
| count | 전체 데이터 수 |
| numeric_count | 숫자 값 데이터 수 |
| avg | 평균 |
| min | 최소 |
| max | 최대 |

---

## 16. 메트릭 통계 단건 조회

특정 time + assetKey + metricCode + interval에 해당하는 통계 1건을 조회합니다.

### Request

```
POST /api/v1/mhs/g
Content-Type: application/json
```

```json
{
  "filter": {
    "time": "2026-01-23T10:00:00.000",
    "assetKey": "AST-000123",
    "metricCode": "temperature",
    "interval": "1h"
  },
  "statsKeys": ["count", "numeric_count", "avg", "min", "max"]
}
```

### Request Parameters

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| filter.time | string | O | 버킷 시작 시각 (ISO 8601) |
| filter.assetKey | string | O | 자산 Key |
| filter.metricCode | string | O | 메트릭 코드 |
| filter.interval | string | O | 집계 주기 (지원: `1m`, `1h`) |
| statsKeys | array(string) | X | statsBody에서 반환할 키 제한 (미지정 시 전체) |

### Response

```json
{
  "success": true,
  "data": {
    "time": "2026-01-23T10:00:00.000",
    "assetKey": "AST-000123",
    "metricCode": "temperature",
    "interval": "1h",
    "statsBody": {
      "count": 3600,
      "numeric_count": 3590,
      "avg": 25.1,
      "min": 22.0,
      "max": 29.2
    },
    "windowStartAt": "2026-01-23T10:00:00.000",
    "windowEndAt": "2026-01-23T10:59:59.999999",
    "sampleCount": 3600,
    "endpointId": null,
    "sensorExternalId": null,
    "createdAt": "2026-01-23T11:02:00.000",
    "updatedAt": "2026-01-23T11:05:00.000"
  },
  "error": null,
  "timestamp": "2026-02-03T00:53:36.731Z",
  "path": "/api/v1/mhs/g"
}
```

### Error Response (404)

```json
{
  "success": false,
  "data": null,
  "error": {
    "key": "METRIC_STATS_NOT_FOUND",
    "message": "Metric stats not found for given filter",
    "data": null
  },
  "timestamp": "2026-02-03T00:53:36.731Z",
  "path": "/api/v1/mhs/g"
}
```

---

## 컴포넌트 - API 매핑

| 컴포넌트 | 사용 데이터셋 | API |
|----------|--------------|-----|
| UPS | assetDetailUnified | POST /api/v1/ast/gx |
| PDU | assetDetailUnified | POST /api/v1/ast/gx |
| CRAC | assetDetailUnified | POST /api/v1/ast/gx |
| TempHumiditySensor | assetDetailUnified | POST /api/v1/ast/gx |
| TempHumiditySensor | metricLatest | POST /api/v1/mh/gl |

### 컴포넌트 데이터 흐름

```
3D 오브젝트 클릭
    │
    ├─→ showDetail() 호출
    │
    ├─→ fetchData('assetDetailUnified', { assetKey: this._defaultAssetKey, locale: 'ko' })
    │
    └─→ renderBaseInfo(asset) + renderProperties(properties) → 팝업에 자산 정보 표시
```

---

## statusType 매핑

| API statusType | UI Label | UI Data Attribute |
|----------------|----------|-------------------|
| ACTIVE | Normal | normal |
| WARNING | Warning | warning |
| CRITICAL | Critical | critical |
| INACTIVE | Inactive | inactive |
| MAINTENANCE | Maintenance | maintenance |

---

## Mock Server 실행

```bash
cd ECO/mock_server
npm install
npm start  # http://localhost:4004
```

### 서버 시작 시 출력

```
========================================
  ECO Mock Server (Asset API v1 Only)
  Running on http://localhost:4004
========================================

Asset Summary: 15000 total assets

Available endpoints:
  POST /api/v1/ast/l      - Asset list (all)
  POST /api/v1/ast/la     - Asset list (paged)
  POST /api/v1/ast/g      - Asset single
  POST /api/v1/ast/gx     - Asset detail (unified API)
  POST /api/v1/rel/l      - Relation list (all)
  POST /api/v1/rel/la     - Relation list (paged)
  POST /api/v1/rel/g      - Relation single
  POST /api/v1/mh/gl      - Metric latest (by asset)
  POST /api/v1/mhs/l      - Metric history stats list
  POST /api/v1/mhs/g      - Metric history stats single
  POST /api/v1/vdr/la     - Vendor list (paged)
  POST /api/v1/vdr/l      - Vendor list (all)
  POST /api/v1/vdr/g      - Vendor single
  POST /api/v1/mdl/la     - Model list (paged)
  POST /api/v1/mdl/l      - Model list (all)
  POST /api/v1/mdl/g      - Model single
```

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-22 | 초안 작성 - 기본 API 정의 |
| 2026-01-26 | Asset API v1으로 전면 개편, 레거시 API 제거 |
| 2026-01-27 | /api/v1/ast/gx (자산 상세 조회 통합 API) 문서 추가 |
| 2026-01-28 | /api/v1/mh/gl (자산별 최신 메트릭 조회) API 추가 |
| 2026-02-03 | /api/v1/vdr/* (자산 벤더 관리), /api/v1/mdl/* (자산 모델 관리) API 추가 |
| 2026-02-03 | /api/v1/mhs/* (메트릭 통계 조회) API 추가 |
