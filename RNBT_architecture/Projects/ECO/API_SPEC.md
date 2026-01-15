# ECO API 명세

**Base URL**: `{baseUrl}` (datasetList.json의 rest_api URL 참조)

**프로젝트 설명**: 데이터센터 전력/냉방 장비 모니터링 대시보드

---

## 설계 원칙: 모든 것은 자산(Asset)

### 배경

외부 자산관리시스템은 다양한 계층 구조를 가질 수 있습니다:
- Building > Floor > Room (공간 계층)
- Room > Rack > Server (장비 계층)
- PDU > Circuit (전력 분배)
- 독립 센서, CRAC 등

**핵심 통찰**: "계층"과 "자산"이 별개가 아닙니다. Building, Floor, Room도 자산의 일종이며, 다만 children을 가질 수 있는 자산일 뿐입니다.

### 단일 구분 기준: `canHaveChildren`

| 값 | 분류 | 설명 | Tree 표현 | 예시 |
|----|------|------|----------|------|
| `true` | 컨테이너 자산 | children을 가질 수 있음 | O | Building, Floor, Room, Rack, Cabinet, PDU(Main) |
| `false` | 말단 자산 | children을 가질 수 없음 | X | Server, UPS, Sensor, CRAC, Circuit |

### UI 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                         자산 패널                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │      Tree        │    │              Table                  │ │
│  │                  │    │                                     │ │
│  │  모든 자산       │    │  선택한 노드의 하위 전체 자산         │ │
│  │  계층 탐색       │    │  (컨테이너 + 말단 모두 포함)          │ │
│  │                  │    │                                     │ │
│  └─────────────────┘    └─────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

| 영역 | 표시 기준 |
|------|----------|
| Tree | 모든 자산 (canHaveChildren 관계없이) |
| Table | 선택한 노드 하위의 모든 자산 (컨테이너 + 말단) |

---

## 계층 구조 예시

```
🏢 본관 (building, canHaveChildren=true)
 ├── 📂 1층 (floor, canHaveChildren=true)
 │    ├── 🚪 서버실 A (room, canHaveChildren=true)
 │    │    ├── 🗄️ Rack A-01 (rack, canHaveChildren=true)
 │    │    │    ├── 🖥️ Server 001 (server, canHaveChildren=false)
 │    │    │    ├── 🖥️ Server 002 (server, canHaveChildren=false)
 │    │    │    └── 🖥️ Server 003 (server, canHaveChildren=false)
 │    │    ├── 🗄️ Rack A-02 (rack, canHaveChildren=true)
 │    │    │    ├── 🖥️ Server 004 (server, canHaveChildren=false)
 │    │    │    └── 🔌 PDU 001 (pdu, canHaveChildren=false) ← Rack 안 PDU
 │    │    ├── 🔌 PDU 002 (pdu, canHaveChildren=false) ← Room 직속 PDU
 │    │    ├── ❄️ CRAC 001 (crac, canHaveChildren=false)
 │    │    └── 📡 Sensor 001 (sensor, canHaveChildren=false)
 │    └── 🚪 네트워크실 (room, canHaveChildren=true)
 │         ├── 🗄️ Network Rack 01 (rack, canHaveChildren=true)
 │         │    ├── 🔀 Switch 001 (switch, canHaveChildren=false)
 │         │    └── 📶 Router 001 (router, canHaveChildren=false)
 │         └── 🔋 UPS 001 (ups, canHaveChildren=false)
 └── 📂 2층 (floor, canHaveChildren=true)
      └── 🚪 UPS실 (room, canHaveChildren=true)
           ├── 🔋 UPS 002 (ups, canHaveChildren=false)
           └── 🔋 UPS 003 (ups, canHaveChildren=false)

🏢 별관 A (building, canHaveChildren=true)
 └── 📂 1층 (floor, canHaveChildren=true)
      └── 🚪 전산실 (room, canHaveChildren=true)
           ├── 🔌 PDU 003 (Main) (pdu, canHaveChildren=true) ← 컨테이너 PDU
           │    ├── ⚡ Circuit A1 (circuit, canHaveChildren=false)
           │    ├── ⚡ Circuit A2 (circuit, canHaveChildren=false)
           │    └── ⚡ Circuit B1 (circuit, canHaveChildren=false)
           └── 🔌 PDU 004 (pdu, canHaveChildren=false) ← 말단 PDU

🚪 독립 전산실 (room, parentId=null, canHaveChildren=true) ← 케이스 4: 독립 공간
 ├── 🗄️ Rack I-01 (rack, canHaveChildren=true)
 │    └── 🖥️ Server I-01 (server, canHaveChildren=false)
 └── ❄️ CRAC I-01 (crac, canHaveChildren=false)
```

**참고**:
- 같은 타입(예: PDU)도 상황에 따라 컨테이너/말단이 될 수 있습니다.
- 케이스 4: 독립 공간은 Building 없이 root-level에 Room이 직접 존재하는 경우입니다.

---

## API - 컴포넌트 기능 매핑

| API | 호출 시점 | 컴포넌트 | 기능 |
|-----|----------|----------|------|
| `GET /api/hierarchy?depth=n&locale=ko` | 페이지 로드 | AssetList | 계층 트리 초기 렌더링 |
| `GET /api/hierarchy/:nodeId/children?locale=ko` | 트리 노드 펼침 | AssetList | Lazy Loading |
| `GET /api/hierarchy/:nodeId/assets?locale=ko` | 트리 노드 클릭 | AssetList | 선택 노드의 자산 목록 표시 |
| `GET /api/ups/:id?locale=ko` | 행 클릭 / 3D 클릭 | UPS | UPS 현재 상태 + fields 메타데이터 |
| `GET /api/ups/:id/history` | 행 클릭 / 3D 클릭 | UPS | 부하/배터리 차트 렌더링 |
| `GET /api/pdu/:id?locale=ko` | 행 클릭 / 3D 클릭 | PDU | PDU 현재 상태 + fields 메타데이터 |
| `GET /api/pdu/:id/circuits` | 행 클릭 / 3D 클릭 | PDU | 회로 테이블 렌더링 |
| `GET /api/pdu/:id/history` | 행 클릭 / 3D 클릭 | PDU | 전력 사용량 차트 렌더링 |
| `GET /api/crac/:id?locale=ko` | 행 클릭 / 3D 클릭 | CRAC | CRAC 현재 상태 + fields 메타데이터 |
| `GET /api/crac/:id/history` | 행 클릭 / 3D 클릭 | CRAC | 온습도 차트 렌더링 |
| `GET /api/sensor/:id?locale=ko` | 행 클릭 / 3D 클릭 | TempHumiditySensor | 센서 현재 상태 + fields 메타데이터 |
| `GET /api/sensor/:id/history` | 행 클릭 / 3D 클릭 | TempHumiditySensor | 온습도 차트 렌더링 |

---

## API 호출 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  1. 패널 로드                                                    │
│     GET /api/hierarchy?depth=2                                   │
│     → Tree 초기 렌더링 (루트 + 1레벨)                            │
│                                                                  │
│  2. Tree 노드 펼침 (예: 1층 펼침)                                 │
│     GET /api/hierarchy/floor-001-01/children                     │
│     → 서버실, 네트워크실 등 하위 자산 로딩                        │
│                                                                  │
│  3. Tree 노드 선택 (예: 서버실 클릭)                              │
│     GET /api/hierarchy/room-001-01-01/assets                     │
│     → Table에 서버실 하위 전체 자산 표시                          │
│                                                                  │
│  4. Table 행 클릭 (예: UPS-A 클릭)                                │
│     GET /api/ups/ups-001                                         │
│     → 상세 정보 표시 또는 이벤트 발행                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. 계층 트리 조회 (초기 로딩)

### Request

```
GET /api/hierarchy?depth={n}&locale={locale}
```

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| depth | number | 2 | 반환할 트리 깊이 (1: 루트만, 2: 루트+1레벨, ...) |
| locale | string | "ko" | 다국어 코드 (`ko`, `en`, `ja`) - [I18N_SPEC.md](I18N_SPEC.md) 참조 |

### Response

```json
{
  "data": {
    "items": [
      {
        "id": "building-001",
        "name": "본관",
        "type": "building",
        "typeLabel": "건물",
        "canHaveChildren": true,
        "hasChildren": true,
        "parentId": null,
        "status": "warning",
        "statusLabel": "경고",
        "children": [
          {
            "id": "floor-001-01",
            "name": "1층",
            "type": "floor",
            "typeLabel": "층",
            "canHaveChildren": true,
            "hasChildren": true,
            "parentId": "building-001",
            "status": "warning",
            "statusLabel": "경고",
            "children": []
          }
        ]
      },
      {
        "id": "room-independent-01",
        "name": "독립 전산실",
        "type": "room",
        "typeLabel": "방",
        "canHaveChildren": true,
        "hasChildren": true,
        "parentId": null,
        "status": "normal",
        "statusLabel": "정상",
        "children": []
      }
    ],
    "summary": {
      "totalAssets": 45,
      "containers": 15,
      "terminals": 30,
      "byType": { "building": 3, "floor": 6, "room": 6, "rack": 4, "server": 6, "ups": 4, "pdu": 5, "crac": 4, "sensor": 8 }
    }
  },
  "meta": {
    "locale": "ko"
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| id | string | 자산 ID |
| name | string | 자산 이름 (locale에 따라 번역됨) |
| type | string | 자산 타입 |
| typeLabel | string | 타입 라벨 (locale에 따라 번역됨) |
| canHaveChildren | boolean | 컨테이너 여부 (Tree 노드 펼침 가능 여부) |
| hasChildren | boolean | 하위 자산 존재 여부 (Lazy Loading 판단용) |
| parentId | string | 부모 자산 ID (독립 공간인 경우 null) |
| status | string | 상태 (`normal` \| `warning` \| `critical`) |
| statusLabel | string | 상태 라벨 (locale에 따라 번역됨) |
| children | array | depth 범위 내 하위 자산 (범위 밖이면 빈 배열) |
| meta.locale | string | 응답에 적용된 언어 코드 |

### Lazy Loading 동작 원리

```
초기 로드: depth=2 (Building + Floor)
    │
    ├─→ Building [hasChildren=true, children=[Floor...]]
    │       └─→ Floor [hasChildren=true, children=[]]
    │               └─→ "Loading..." placeholder 표시
    │
    └─→ 사용자가 Floor ▶ 클릭
            │
            └─→ GET /api/hierarchy/floor-001-01/children
                    │
                    └─→ Room, Rack, Server 등 반환
```

---

## 2. 노드 하위 자산 조회 (Lazy Loading)

### Request

```
GET /api/hierarchy/:nodeId/children?locale={locale}
```

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| locale | string | "ko" | 다국어 코드 (`ko`, `en`, `ja`) |

### Response

```json
{
  "data": {
    "parentId": "floor-001-01",
    "children": [
      {
        "id": "room-001-01-01",
        "name": "서버실 A",
        "type": "room",
        "typeLabel": "방",
        "canHaveChildren": true,
        "hasChildren": true,
        "parentId": "floor-001-01",
        "status": "warning",
        "statusLabel": "경고"
      },
      {
        "id": "room-001-01-02",
        "name": "네트워크실",
        "type": "room",
        "typeLabel": "방",
        "canHaveChildren": true,
        "hasChildren": true,
        "parentId": "floor-001-01",
        "status": "normal",
        "statusLabel": "정상"
      }
    ]
  },
  "meta": {
    "locale": "ko"
  }
}
```

---

## 3. 노드별 자산 조회 (Table용)

### Request

```
GET /api/hierarchy/:nodeId/assets?locale={locale}
```

**Parameters**:
- `nodeId`: 노드 ID (예: `building-001`, `floor-001-01`, `room-001-01-01`)

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| locale | string | "ko" | 다국어 코드 (`ko`, `en`, `ja`) |

### Response

```json
{
  "data": {
    "nodeId": "room-001-01-01",
    "nodeName": "서버실 A",
    "nodePath": "본관 > 1층 > 서버실 A",
    "nodeType": "room",
    "nodeTypeLabel": "방",
    "assets": [
      {
        "id": "rack-001",
        "name": "Rack A-01",
        "type": "rack",
        "typeLabel": "랙",
        "canHaveChildren": true,
        "parentId": "room-001-01-01",
        "status": "normal",
        "statusLabel": "정상"
      },
      {
        "id": "server-001",
        "name": "Server 001",
        "type": "server",
        "typeLabel": "서버",
        "canHaveChildren": false,
        "parentId": "rack-001",
        "status": "normal",
        "statusLabel": "정상"
      },
      {
        "id": "pdu-002",
        "name": "PDU 002 (Standalone)",
        "type": "pdu",
        "typeLabel": "PDU",
        "canHaveChildren": false,
        "parentId": "room-001-01-01",
        "status": "warning",
        "statusLabel": "경고"
      }
    ],
    "summary": {
      "total": 10,
      "byType": { "rack": 2, "server": 5, "pdu": 1, "crac": 1, "sensor": 1 },
      "byStatus": { "normal": 8, "warning": 2, "critical": 0 }
    }
  },
  "meta": {
    "locale": "ko"
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| nodeId | string | 노드 ID |
| nodeName | string | 노드 이름 (locale에 따라 번역됨) |
| nodePath | string | 경로 (breadcrumb, locale에 따라 번역됨) |
| nodeType | string | 노드 타입 |
| nodeTypeLabel | string | 노드 타입 라벨 (locale에 따라 번역됨) |
| assets | array | 하위 모든 자산 (컨테이너 + 말단, 플랫 목록) |
| summary | object | 자산 요약 |
| meta.locale | string | 응답에 적용된 언어 코드 |

---

## 4. UPS 현재 상태 조회

### Request

```
GET /api/ups/:id?locale={locale}
```

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| locale | string | "ko" | 다국어 코드 (`ko`, `en`, `ja`) |

### Response

```json
{
  "data": {
    "id": "ups-001",
    "name": "UPS 0001",
    "type": "ups",
    "typeLabel": "UPS",
    "parentId": "room-001-01-01",
    "status": "normal",
    "statusLabel": "정상",
    "fields": [
      { "key": "load", "label": "부하율", "value": 65.2, "unit": "%", "order": 1 },
      { "key": "batteryLevel", "label": "배터리 잔량", "value": 100, "unit": "%", "order": 2 },
      { "key": "batteryHealth", "label": "배터리 상태", "value": 98, "unit": "%", "order": 3 },
      { "key": "inputVoltage", "label": "입력 전압", "value": 220.5, "unit": "V", "order": 4 },
      { "key": "outputVoltage", "label": "출력 전압", "value": 220.0, "unit": "V", "order": 5 },
      { "key": "runtime", "label": "예상 런타임", "value": 45, "unit": "min", "order": 6 },
      { "key": "temperature", "label": "온도", "value": 32.5, "unit": "°C", "order": 7 },
      { "key": "mode", "label": "운전 모드", "value": "online", "valueLabel": "온라인", "order": 8 }
    ],
    "threshold": {
      "loadWarning": 70,
      "loadCritical": 90,
      "batteryWarning": 30,
      "batteryCritical": 15
    },
    "lastUpdated": "2025-12-22T08:30:00.000Z"
  },
  "meta": {
    "locale": "ko"
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| id | string | UPS ID |
| name | string | UPS 이름 |
| type | string | 자산 타입 |
| typeLabel | string | 타입 라벨 (locale에 따라 번역됨) |
| parentId | string | 부모 자산 ID (Room, Rack 등) |
| status | string | 상태 (`normal` \| `warning` \| `critical`) |
| statusLabel | string | 상태 라벨 (locale에 따라 번역됨) |
| fields | array | 필드 메타데이터 배열 (동적 렌더링용) |
| fields[].key | string | 필드 키 |
| fields[].label | string | 필드 라벨 (locale에 따라 번역됨) |
| fields[].value | any | 필드 값 |
| fields[].unit | string | 단위 (선택적) |
| fields[].valueLabel | string | 값 라벨 (enum 타입일 경우, locale에 따라 번역됨) |
| fields[].order | number | 정렬 순서 |
| meta.locale | string | 응답에 적용된 언어 코드 |

### 상태 판정 로직

```
load >= 90% OR batteryLevel <= 15%  → status: "critical"
load >= 70% OR batteryLevel <= 30%  → status: "warning"
otherwise                           → status: "normal"
```

---

## 5. UPS 히스토리 조회

### Request

```
GET /api/ups/:id/history
GET /api/ups/:id/history?period=7d
```

### Response

```json
{
  "data": {
    "upsId": "ups-001",
    "period": "24h",
    "timestamps": ["08:00", "09:00", "10:00", "..."],
    "load": [62.5, 65.1, 68.8, "..."],
    "battery": [100, 100, 99, "..."],
    "thresholds": {
      "loadWarning": 70,
      "loadCritical": 90
    }
  }
}
```

---

## 6. PDU 현재 상태 조회

### Request

```
GET /api/pdu/:id?locale={locale}
```

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| locale | string | "ko" | 다국어 코드 (`ko`, `en`, `ja`) |

### Response

```json
{
  "data": {
    "id": "pdu-001",
    "name": "PDU 0001",
    "type": "pdu",
    "typeLabel": "PDU",
    "parentId": "room-001-01-01",
    "status": "normal",
    "statusLabel": "정상",
    "fields": [
      { "key": "totalPower", "label": "총 전력", "value": 12.5, "unit": "kW", "order": 1 },
      { "key": "totalCurrent", "label": "총 전류", "value": 56.8, "unit": "A", "order": 2 },
      { "key": "voltage", "label": "전압", "value": 220.0, "unit": "V", "order": 3 },
      { "key": "circuitCount", "label": "회로 수", "value": 24, "order": 4 },
      { "key": "activeCircuits", "label": "활성 회로", "value": 18, "order": 5 },
      { "key": "powerFactor", "label": "역률", "value": 0.95, "order": 6 }
    ],
    "threshold": {
      "powerWarning": 15,
      "powerCritical": 18
    },
    "lastUpdated": "2025-12-22T08:30:00.000Z"
  },
  "meta": {
    "locale": "ko"
  }
}
```

---

## 7. PDU 회로 목록 조회

### Request

```
GET /api/pdu/:id/circuits
```

### Response

```json
{
  "data": {
    "pduId": "pdu-001",
    "circuits": [
      {
        "id": 1,
        "name": "Server Rack A-1",
        "current": 8.5,
        "power": 1.87,
        "status": "active",
        "breaker": "on"
      }
    ],
    "totalCount": 24
  }
}
```

---

## 8. PDU 히스토리 조회

### Request

```
GET /api/pdu/:id/history
```

### Response

```json
{
  "data": {
    "pduId": "pdu-001",
    "period": "24h",
    "timestamps": ["08:00", "09:00", "10:00", "..."],
    "power": [11.2, 12.5, 12.8, "..."],
    "current": [50.9, 56.8, 58.2, "..."]
  }
}
```

---

## 9. CRAC 현재 상태 조회

### Request

```
GET /api/crac/:id?locale={locale}
```

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| locale | string | "ko" | 다국어 코드 (`ko`, `en`, `ja`) |

### Response

```json
{
  "data": {
    "id": "crac-001",
    "name": "CRAC 0001",
    "type": "crac",
    "typeLabel": "항온항습기",
    "parentId": "room-001-01-01",
    "status": "normal",
    "statusLabel": "정상",
    "fields": [
      { "key": "supplyTemp", "label": "공급 온도", "value": 18.5, "unit": "°C", "order": 1 },
      { "key": "returnTemp", "label": "환기 온도", "value": 24.8, "unit": "°C", "order": 2 },
      { "key": "setpoint", "label": "설정 온도", "value": 18.0, "unit": "°C", "order": 3 },
      { "key": "humidity", "label": "습도", "value": 45, "unit": "%", "order": 4 },
      { "key": "humiditySetpoint", "label": "습도 설정", "value": 50, "unit": "%", "order": 5 },
      { "key": "fanSpeed", "label": "팬 속도", "value": 75, "unit": "%", "order": 6 },
      { "key": "compressorStatus", "label": "압축기 상태", "value": "running", "valueLabel": "가동중", "order": 7 },
      { "key": "coolingCapacity", "label": "냉각 용량", "value": 85, "unit": "%", "order": 8 },
      { "key": "mode", "label": "운전 모드", "value": "cooling", "valueLabel": "냉방", "order": 9 }
    ],
    "threshold": {
      "tempWarning": 28,
      "tempCritical": 32,
      "humidityLow": 30,
      "humidityHigh": 70
    },
    "lastUpdated": "2025-12-22T08:30:00.000Z"
  },
  "meta": {
    "locale": "ko"
  }
}
```

---

## 10. CRAC 히스토리 조회

### Request

```
GET /api/crac/:id/history
```

### Response

```json
{
  "data": {
    "cracId": "crac-001",
    "period": "24h",
    "timestamps": ["08:00", "09:00", "10:00", "..."],
    "supplyTemp": [18.2, 18.5, 18.3, "..."],
    "returnTemp": [24.5, 24.8, 25.1, "..."],
    "humidity": [45, 46, 44, "..."]
  }
}
```

---

## 11. 온습도 센서 현재 상태 조회

### Request

```
GET /api/sensor/:id?locale={locale}
```

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| locale | string | "ko" | 다국어 코드 (`ko`, `en`, `ja`) |

### Response

```json
{
  "data": {
    "id": "sensor-001",
    "name": "Sensor 00001",
    "type": "sensor",
    "typeLabel": "센서",
    "parentId": "room-001-01-01",
    "status": "normal",
    "statusLabel": "정상",
    "fields": [
      { "key": "temperature", "label": "온도", "value": 24.5, "unit": "°C", "order": 1 },
      { "key": "humidity", "label": "습도", "value": 45, "unit": "%", "order": 2 },
      { "key": "dewpoint", "label": "이슬점", "value": 12.3, "unit": "°C", "order": 3 }
    ],
    "threshold": {
      "tempWarning": 28,
      "tempCritical": 32,
      "humidityLow": 30,
      "humidityHigh": 70
    },
    "lastUpdated": "2025-12-22T08:30:00.000Z"
  },
  "meta": {
    "locale": "ko"
  }
}
```

### 상태 판정 로직

```
temperature >= 32°C OR humidity < 30% OR humidity > 70%  → status: "critical"
temperature >= 28°C OR humidity < 40% OR humidity > 60%  → status: "warning"
otherwise                                                 → status: "normal"
```

---

## 12. 온습도 센서 히스토리 조회

### Request

```
GET /api/sensor/:id/history
```

### Response

```json
{
  "data": {
    "sensorId": "sensor-001",
    "period": "24h",
    "timestamps": ["08:00", "09:00", "10:00", "..."],
    "temperatures": [23.5, 24.1, 24.8, "..."],
    "humidity": [45, 46, 44, "..."]
  }
}
```

---

## 자산관리시스템에 요청할 필드

### 필수 필드

```json
{
  "id": "asset-001",
  "name": "서버실 A",
  "type": "room",
  "canHaveChildren": true,
  "hasChildren": true,
  "parentId": "floor-001",
  "status": "normal"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 자산 ID |
| name | string | 자산 이름 |
| type | string | 자산 타입 (자산관리시스템에서 정의) |
| canHaveChildren | boolean | **핵심 구분자** - children 가능 여부 |
| hasChildren | boolean | 실제 하위 노드 존재 여부 (Lazy Loading용) |
| parentId | string | 상위 자산 ID |
| status | string | 상태 (normal / warning / critical) |

---

## 데이터 로딩 전략

| 항목 | 결정 내용 |
|------|----------|
| Tree 초기 로딩 | depth 파라미터로 제한 (기본 2레벨) |
| Tree 확장 | Lazy Loading (노드 펼침 시 children 조회) |
| Table 로딩 | 노드 선택 시 하위 자산 한 번에 전부 로딩 |
| 렌더링 최적화 | Tabulator 가상 스크롤 |

### 규모별 전략

| 규모 | 자산 수 | 전략 |
|------|---------|------|
| 소규모 | ~100개 | 전체 로딩 가능 (depth 제한 없이) |
| 중규모 | 100~1,000개 | depth=2~3으로 제한 + Lazy Loading |
| 대규모 | 1,000개 이상 | depth=1 + Lazy Loading 필수 |

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
  ECO Mock Server
  Environmental Control & Operations
  Running on http://localhost:4004
========================================

핵심 원칙: 모든 것은 자산(Asset)
  - canHaveChildren: true → Tree에 표시 (컨테이너)
  - canHaveChildren: false → Table에만 표시 (말단)

Asset Summary:
  Total Assets: 45
  Containers: 15
  Terminals: 30
  By Type: { building: 3, floor: 6, room: 6, rack: 4, ... }

Available endpoints:
  GET /api/hierarchy?depth=n&locale=ko       - Hierarchy tree (depth limited, i18n)
  GET /api/hierarchy/:nodeId/children        - Node children (Lazy Loading)
  GET /api/hierarchy/:nodeId/assets          - All assets under node (for Table)
  GET /api/ups/:id?locale=ko                 - UPS status + fields metadata
  GET /api/ups/:id/history                   - UPS load/battery history
  GET /api/pdu/:id?locale=ko                 - PDU status + fields metadata
  GET /api/pdu/:id/circuits                  - PDU circuit list
  GET /api/pdu/:id/history                   - PDU power history
  GET /api/crac/:id?locale=ko                - CRAC status + fields metadata
  GET /api/crac/:id/history                  - CRAC temperature history
  GET /api/sensor/:id?locale=ko              - Sensor status + fields metadata
  GET /api/sensor/:id/history                - Sensor temperature history
```

---

## 다국어(i18n) 지원

모든 Hierarchy API는 `locale` 쿼리 파라미터를 지원합니다.

자세한 내용은 [I18N_SPEC.md](I18N_SPEC.md) 참조.

### 지원 언어

```
GET /api/i18n/locales
```

```json
{
  "data": {
    "available": [
      { "code": "ko", "name": "한국어", "default": true },
      { "code": "en", "name": "English" },
      { "code": "ja", "name": "日本語" }
    ],
    "default": "ko"
  }
}
```

---

## 개발 검토 필요 사항

### 서버 측 검색 API

현재 검색/필터링은 클라이언트 측에서 처리합니다. 대량 데이터(수만 개 이상)에서 전역 검색이 필요한 경우 서버 API 개발을 검토해야 합니다.

**현재 방식 (클라이언트 필터링)**
- 트리 검색: 로드된 노드만 검색 가능
- 테이블 검색: 선택한 노드 하위만 검색 가능
- 한계: Lazy Loading 환경에서 미로드 노드는 검색 불가

**서버 API 필요 시 검토 사항**

| API | 설명 | 용도 |
|-----|------|------|
| `GET /api/search?q={검색어}&locale={locale}` | 전역 자산 검색 | 자산 이름/ID로 전체 검색 |
| `GET /api/hierarchy/search?q={검색어}` | 계층 구조 검색 | 검색 결과 + 경로 반환 |
| `GET /api/search/suggest?q={prefix}` | 자동완성 | 검색어 입력 시 제안 |

**응답 예시 (계층 구조 검색)**

```json
{
  "data": {
    "results": [
      {
        "id": "server-00123",
        "name": "Server 00123",
        "type": "server",
        "path": ["본관", "1층", "서버실 A", "Rack A-01"],
        "pathIds": ["building-001", "floor-001-01", "room-001-01-01", "rack-0001"]
      }
    ],
    "total": 15
  }
}
```

**구현 우선순위**
1. 전역 검색 API - 대량 데이터에서 필수
2. 검색 결과 경로 표시 - 트리에서 해당 노드로 이동 지원
3. 자동완성 - UX 개선 (선택적)

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-22 | 초안 작성 - 기본 API 정의 |
| 2026-01-14 | "모든 것은 자산" 설계 원칙 반영, Lazy Loading API 추가 |
| 2026-01-14 | AssetPanelAPI.md 내용 통합 |
| 2026-01-14 | 다국어(i18n) 지원 추가 - locale 파라미터, typeLabel/statusLabel 필드 |
| 2026-01-14 | 독립 공간(케이스 4: root-level room) 문서화 |
| 2026-01-14 | 개발 검토 필요 사항 추가 - 서버 측 검색 API |
| 2026-01-15 | 자산 상세 API의 roomId → parentId 변경 (일관성 개선) |
| 2026-01-15 | 미사용 API 제거 (`/api/assets`, `/api/asset/:id`) |
| 2026-01-15 | 자산 상세 API에 fields 메타데이터 추가 (하드코딩 제거) |
