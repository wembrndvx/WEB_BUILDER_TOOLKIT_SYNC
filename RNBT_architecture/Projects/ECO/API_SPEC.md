# ECO API 명세

**Base URL**: `http://localhost:4004`

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
```

**참고**: 같은 타입(예: PDU)도 상황에 따라 컨테이너/말단이 될 수 있습니다.

---

## API - 컴포넌트 기능 매핑

| API | 호출 시점 | 컴포넌트 | 기능 |
|-----|----------|----------|------|
| `GET /api/hierarchy?depth=n` | 페이지 로드 | AssetList | 계층 트리 초기 렌더링 |
| `GET /api/hierarchy/:nodeId/children` | 트리 노드 펼침 | AssetList | Lazy Loading |
| `GET /api/hierarchy/:nodeId/assets` | 트리 노드 클릭 | AssetList | 선택 노드의 자산 목록 표시 |
| `GET /api/assets` | 새로고침 | AssetList | 전체 자산 목록 조회 |
| `GET /api/ups/:id` | 행 클릭 / 3D 클릭 | UPS | UPS 현재 상태 표시 |
| `GET /api/ups/:id/history` | 행 클릭 / 3D 클릭 | UPS | 부하/배터리 차트 렌더링 |
| `GET /api/pdu/:id` | 행 클릭 / 3D 클릭 | PDU | PDU 현재 상태 표시 |
| `GET /api/pdu/:id/circuits` | 행 클릭 / 3D 클릭 | PDU | 회로 테이블 렌더링 |
| `GET /api/pdu/:id/history` | 행 클릭 / 3D 클릭 | PDU | 전력 사용량 차트 렌더링 |
| `GET /api/crac/:id` | 행 클릭 / 3D 클릭 | CRAC | CRAC 현재 상태 표시 |
| `GET /api/crac/:id/history` | 행 클릭 / 3D 클릭 | CRAC | 온습도 차트 렌더링 |
| `GET /api/sensor/:id` | 행 클릭 / 3D 클릭 | TempHumiditySensor | 센서 현재 상태 표시 |
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
GET /api/hierarchy?depth={n}
```

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| depth | number | 2 | 반환할 트리 깊이 (1: 루트만, 2: 루트+1레벨, ...) |

### Response

```json
{
  "data": {
    "title": "ECO 자산 관리",
    "items": [
      {
        "id": "building-001",
        "name": "본관",
        "type": "building",
        "canHaveChildren": true,
        "hasChildren": true,
        "parentId": null,
        "status": "warning",
        "children": [
          {
            "id": "floor-001-01",
            "name": "1층",
            "type": "floor",
            "canHaveChildren": true,
            "hasChildren": true,
            "parentId": "building-001",
            "status": "warning",
            "children": []
          }
        ]
      }
    ],
    "summary": {
      "totalAssets": 45,
      "containers": 15,
      "terminals": 30,
      "byType": { "building": 3, "floor": 6, "room": 6, "rack": 4, "server": 6, "ups": 4, "pdu": 5, "crac": 4, "sensor": 8 }
    }
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| id | string | 자산 ID |
| name | string | 자산 이름 |
| type | string | 자산 타입 |
| canHaveChildren | boolean | 컨테이너 여부 (Tree 노드 펼침 가능 여부) |
| hasChildren | boolean | 하위 자산 존재 여부 (Lazy Loading 판단용) |
| parentId | string | 부모 자산 ID |
| status | string | 상태 (`normal` \| `warning` \| `critical`) |
| children | array | depth 범위 내 하위 자산 (범위 밖이면 빈 배열) |

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
GET /api/hierarchy/:nodeId/children
```

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
        "canHaveChildren": true,
        "hasChildren": true,
        "parentId": "floor-001-01",
        "status": "warning"
      },
      {
        "id": "room-001-01-02",
        "name": "네트워크실",
        "type": "room",
        "canHaveChildren": true,
        "hasChildren": true,
        "parentId": "floor-001-01",
        "status": "normal"
      }
    ]
  }
}
```

---

## 3. 노드별 자산 조회 (Table용)

### Request

```
GET /api/hierarchy/:nodeId/assets
```

**Parameters**:
- `nodeId`: 노드 ID (예: `building-001`, `floor-001-01`, `room-001-01-01`)

### Response

```json
{
  "data": {
    "nodeId": "room-001-01-01",
    "nodeName": "서버실 A",
    "nodePath": "본관 > 1층 > 서버실 A",
    "nodeType": "room",
    "assets": [
      {
        "id": "rack-001",
        "name": "Rack A-01",
        "type": "rack",
        "canHaveChildren": true,
        "parentId": "room-001-01-01",
        "status": "normal"
      },
      {
        "id": "server-001",
        "name": "Server 001",
        "type": "server",
        "canHaveChildren": false,
        "parentId": "rack-001",
        "status": "normal"
      },
      {
        "id": "pdu-002",
        "name": "PDU 002 (Standalone)",
        "type": "pdu",
        "canHaveChildren": false,
        "parentId": "room-001-01-01",
        "status": "warning"
      }
    ],
    "summary": {
      "total": 10,
      "byType": { "rack": 2, "server": 5, "pdu": 1, "crac": 1, "sensor": 1 },
      "byStatus": { "normal": 8, "warning": 2, "critical": 0 }
    }
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| nodeId | string | 노드 ID |
| nodeName | string | 노드 이름 |
| nodePath | string | 경로 (breadcrumb) |
| nodeType | string | 노드 타입 |
| assets | array | 하위 모든 자산 (컨테이너 + 말단, 플랫 목록) |
| summary | object | 자산 요약 |

---

## 4. 전체 자산 조회

### Request

```
GET /api/assets
GET /api/assets?type=ups
GET /api/assets?type=ups,pdu
GET /api/assets?parentId=room-001-01-01
GET /api/assets?canHaveChildren=true
```

### Response

```json
{
  "data": {
    "assets": [
      {
        "id": "ups-001",
        "name": "UPS 001",
        "type": "ups",
        "canHaveChildren": false,
        "parentId": "room-001-01-02",
        "status": "normal"
      }
    ],
    "summary": {
      "total": 45,
      "byType": { "building": 3, "floor": 6, "room": 6, "rack": 4, "server": 6, "ups": 4, "pdu": 5, "crac": 4, "sensor": 8 },
      "byStatus": { "normal": 35, "warning": 8, "critical": 2 }
    }
  }
}
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | 자산 타입 필터 (쉼표로 복수 지정 가능) |
| parentId | string | 부모 자산 ID 필터 |
| canHaveChildren | boolean | 컨테이너/말단 필터 |

---

## 5. UPS 현재 상태 조회

### Request

```
GET /api/ups/:id
```

### Response

```json
{
  "data": {
    "id": "ups-001",
    "name": "UPS 001",
    "roomId": "room-001-01-01",
    "inputVoltage": 220.5,
    "outputVoltage": 220.0,
    "load": 65.2,
    "batteryLevel": 100,
    "batteryHealth": 98,
    "runtime": 45,
    "temperature": 32.5,
    "status": "normal",
    "mode": "online",
    "threshold": {
      "loadWarning": 70,
      "loadCritical": 90,
      "batteryWarning": 30,
      "batteryCritical": 15
    },
    "lastUpdated": "2025-12-22T08:30:00.000Z"
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| id | string | UPS ID |
| name | string | UPS 이름 |
| roomId | string | 소속 방 ID |
| inputVoltage | number | 입력 전압 (V) |
| outputVoltage | number | 출력 전압 (V) |
| load | number | 부하율 (%) |
| batteryLevel | number | 배터리 잔량 (%) |
| batteryHealth | number | 배터리 건강도 (%) |
| runtime | number | 예상 가동 시간 (분) |
| temperature | number | 내부 온도 (°C) |
| status | string | 상태 (`normal` \| `warning` \| `critical`) |
| mode | string | 운전 모드 (`online` \| `bypass` \| `battery`) |

### 상태 판정 로직

```
load >= 90% OR batteryLevel <= 15%  → status: "critical"
load >= 70% OR batteryLevel <= 30%  → status: "warning"
otherwise                           → status: "normal"
```

---

## 6. UPS 히스토리 조회

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

## 7. PDU 현재 상태 조회

### Request

```
GET /api/pdu/:id
```

### Response

```json
{
  "data": {
    "id": "pdu-001",
    "name": "PDU 001",
    "roomId": "room-001-01-01",
    "totalPower": 12.5,
    "totalCurrent": 56.8,
    "voltage": 220.0,
    "circuitCount": 24,
    "activeCircuits": 18,
    "powerFactor": 0.95,
    "status": "normal",
    "threshold": {
      "powerWarning": 15,
      "powerCritical": 18
    },
    "lastUpdated": "2025-12-22T08:30:00.000Z"
  }
}
```

---

## 8. PDU 회로 목록 조회

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

## 9. PDU 히스토리 조회

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

## 10. CRAC 현재 상태 조회

### Request

```
GET /api/crac/:id
```

### Response

```json
{
  "data": {
    "id": "crac-001",
    "name": "CRAC 001",
    "roomId": "room-001-01-01",
    "supplyTemp": 18.5,
    "returnTemp": 24.8,
    "setpoint": 18.0,
    "humidity": 45,
    "humiditySetpoint": 50,
    "fanSpeed": 75,
    "compressorStatus": "running",
    "coolingCapacity": 85,
    "status": "normal",
    "mode": "cooling",
    "threshold": {
      "tempWarning": 28,
      "tempCritical": 32,
      "humidityLow": 30,
      "humidityHigh": 70
    },
    "lastUpdated": "2025-12-22T08:30:00.000Z"
  }
}
```

---

## 11. CRAC 히스토리 조회

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

## 12. 온습도 센서 현재 상태 조회

### Request

```
GET /api/sensor/:id
```

### Response

```json
{
  "data": {
    "id": "sensor-001",
    "name": "Sensor 001",
    "roomId": "room-001-01-01",
    "temperature": 24.5,
    "humidity": 45,
    "dewpoint": 12.3,
    "status": "normal",
    "threshold": {
      "tempWarning": 28,
      "tempCritical": 32,
      "humidityLow": 30,
      "humidityHigh": 70
    },
    "lastUpdated": "2025-12-22T08:30:00.000Z"
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

## 13. 온습도 센서 히스토리 조회

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
  GET /api/hierarchy?depth=n           - Hierarchy tree (depth limited)
  GET /api/hierarchy/:nodeId/children  - Node children (Lazy Loading)
  GET /api/hierarchy/:nodeId/assets    - All assets under node (for Table)
  GET /api/assets                      - All assets
  GET /api/assets?type=ups             - Filter by type
  GET /api/asset/:id                   - Single asset
  GET /api/ups/:id                     - UPS status
  GET /api/pdu/:id                     - PDU status
  GET /api/crac/:id                    - CRAC status
  GET /api/sensor/:id                  - Sensor status
```

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-22 | 초안 작성 - 기본 API 정의 |
| 2026-01-14 | "모든 것은 자산" 설계 원칙 반영, Lazy Loading API 추가 |
| 2026-01-14 | AssetPanelAPI.md 내용 통합 |
