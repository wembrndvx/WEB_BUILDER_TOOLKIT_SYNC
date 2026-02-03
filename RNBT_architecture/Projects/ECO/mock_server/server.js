const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4004;

app.use(cors());
app.use(express.json());

// ======================
// UTILITY FUNCTIONS
// ======================

function getRandomStatus() {
    const rand = Math.random();
    if (rand < 0.75) return 'normal';
    if (rand < 0.92) return 'warning';
    return 'critical';
}

// ======================
// DATA STRUCTURE
// ======================

let ALL_ASSETS = [];

// 대량 데이터 생성 설정
const DATA_CONFIG = {
    buildings: 3,
    floorsPerBuilding: 4,
    roomsPerFloor: 3,
    racksPerRoom: 3,
    serversPerRack: 5,
    pdusPerRoom: 2,
    upsPerRoom: 1,
    cracsPerRoom: 2,
    sensorsPerRoom: 4
};

const BUILDING_NAMES = [
    '본관', '별관 A', '별관 B', '신관', '구관',
    '동관', '서관', '남관', '북관', '중앙관',
    'IDC-A', 'IDC-B', 'IDC-C', 'IDC-D', 'IDC-E',
    'DC Tower A', 'DC Tower B', 'DC Tower C',
    '데이터센터 1', '데이터센터 2', '데이터센터 3',
    '통합관제동', '전산동', '네트워크동', '백업센터'
];

const ROOM_TEMPLATES = [
    '서버실', '전산실', 'IDC룸', '네트워크실',
    'UPS실', '항온항습실', '전력실', '통합관제실',
    '스토리지실', '백업실', '보안관제실', '운영실'
];

// ======================
// DATA GENERATORS
// ======================

function generateAssets() {
    ALL_ASSETS = [];

    let serverIdx = 1, pduIdx = 1, upsIdx = 1, cracIdx = 1, sensorIdx = 1, rackIdx = 1;

    for (let b = 1; b <= DATA_CONFIG.buildings; b++) {
        const buildingId = `building-${String(b).padStart(3, '0')}`;
        const buildingName = BUILDING_NAMES[b - 1] || `Building ${b}`;
        createAsset(buildingId, buildingName, 'building', null, true);

        for (let f = 1; f <= DATA_CONFIG.floorsPerBuilding; f++) {
            const floorId = `floor-${String(b).padStart(3, '0')}-${String(f).padStart(2, '0')}`;
            const floorName = `${f}층`;
            createAsset(floorId, floorName, 'floor', buildingId, true);

            for (let r = 1; r <= DATA_CONFIG.roomsPerFloor; r++) {
                const roomId = `room-${String(b).padStart(3, '0')}-${String(f).padStart(2, '0')}-${String(r).padStart(2, '0')}`;
                const roomTemplate = ROOM_TEMPLATES[(f * DATA_CONFIG.roomsPerFloor + r) % ROOM_TEMPLATES.length];
                const roomName = `${roomTemplate} ${String.fromCharCode(64 + r)}`;
                createAsset(roomId, roomName, 'room', floorId, true);

                // Racks with Servers
                for (let rk = 1; rk <= DATA_CONFIG.racksPerRoom; rk++) {
                    const rackId = `rack-${String(rackIdx++).padStart(4, '0')}`;
                    const rackName = `Rack ${String.fromCharCode(64 + rk)}-${String(rk).padStart(2, '0')}`;
                    createAsset(rackId, rackName, 'rack', roomId, true);

                    for (let s = 1; s <= DATA_CONFIG.serversPerRack; s++) {
                        const serverId = `server-${String(serverIdx++).padStart(5, '0')}`;
                        createAsset(serverId, `Server ${serverId.split('-')[1]}`, 'server', rackId, false);
                    }

                    if (rk === 1) {
                        const pduId = `pdu-${String(pduIdx++).padStart(4, '0')}`;
                        createAsset(pduId, `PDU ${pduId.split('-')[1]} (In-Rack)`, 'pdu', rackId, false);
                    }
                }

                // Standalone equipment
                for (let p = 1; p <= DATA_CONFIG.pdusPerRoom - 1; p++) {
                    const pduId = `pdu-${String(pduIdx++).padStart(4, '0')}`;
                    createAsset(pduId, `PDU ${pduId.split('-')[1]}`, 'pdu', roomId, false);
                }

                for (let u = 1; u <= DATA_CONFIG.upsPerRoom; u++) {
                    const upsId = `ups-${String(upsIdx++).padStart(4, '0')}`;
                    createAsset(upsId, `UPS ${upsId.split('-')[1]}`, 'ups', roomId, false);
                }

                for (let c = 1; c <= DATA_CONFIG.cracsPerRoom; c++) {
                    const cracId = `crac-${String(cracIdx++).padStart(4, '0')}`;
                    createAsset(cracId, `CRAC ${cracId.split('-')[1]}`, 'crac', roomId, false);
                }

                const sensorTypes = ['Temp', 'Humidity', 'Power', 'Air Flow'];
                for (let se = 1; se <= DATA_CONFIG.sensorsPerRoom; se++) {
                    const sensorId = `sensor-${String(sensorIdx++).padStart(5, '0')}`;
                    const sensorType = sensorTypes[(se - 1) % sensorTypes.length];
                    createAsset(sensorId, `${sensorType} Sensor ${sensorId.split('-')[1]}`, 'sensor', roomId, false);
                }
            }
        }
    }

    // Independent rooms
    createAsset('room-independent-01', '외부 창고', 'room', null, true);
    createAsset('storage-001', 'Storage 001', 'storage', 'room-independent-01', false);
    createAsset(`sensor-${String(sensorIdx++).padStart(5, '0')}`, 'Temp Sensor', 'sensor', 'room-independent-01', false);

    createAsset('room-independent-02', '야외 발전기실', 'room', null, true);
    createAsset(`ups-${String(upsIdx++).padStart(4, '0')}`, 'Outdoor UPS', 'ups', 'room-independent-02', false);
    createAsset(`pdu-${String(pduIdx++).padStart(4, '0')}`, 'Outdoor PDU', 'pdu', 'room-independent-02', false);
    createAsset(`sensor-${String(sensorIdx++).padStart(5, '0')}`, 'Power Meter', 'sensor', 'room-independent-02', false);

    console.log(`[Assets] Generated: ${ALL_ASSETS.length} total assets`);
}

function createAsset(id, name, type, parentId, canHaveChildren) {
    ALL_ASSETS.push({
        id,
        name,
        type,
        parentId,
        canHaveChildren,
        status: getRandomStatus()
    });
}

function findAssetById(id) {
    return ALL_ASSETS.find(a => a.id === id);
}

// ======================
// ASSET API v1 DATA
// ======================

// 카테고리별 모델 키 매핑 (MODEL_DATA의 categoryCode 기준)
const MODEL_KEY_BY_CATEGORY = {
    'UPS': 'MODEL_SCHNEIDER_GALAXY_001',
    'PDU': 'MODEL_SCHNEIDER_PDU_001',
    'CRAC': 'MODEL_EMERSON_LIEBERT_001',
    'SENSOR': 'MODEL_HONEYWELL_TEMP_001',
    'SWBD': 'MODEL_LS_SWBD_001',
    'DIST': 'MODEL_SIEMENS_ACCURA_001',
};

function getAssetApiData() {
    return ALL_ASSETS.map((asset, index) => {
        const categoryType = asset.type.toUpperCase();
        const assetModelKey = MODEL_KEY_BY_CATEGORY[categoryType] || null;

        return {
            id: index + 1,
            assetKey: asset.id,
            assetModelId: assetModelKey ? index + 1 : null,
            assetModelKey: assetModelKey,
            ownerUserId: null,
            serviceType: 'DCM',
            domainType: 'FACILITY',
            assetCategoryType: categoryType,
            assetType: categoryType,
            usageCode: null,
            serialNumber: `SN-${asset.id}`,
            name: asset.name,
            locationCode: asset.parentId || null,
            locationLabel: asset.parentId ? findAssetById(asset.parentId)?.name : null,
            description: `${asset.name} (${asset.type})`,
            statusType: asset.status === 'normal' ? 'ACTIVE' : asset.status === 'warning' ? 'WARNING' : 'CRITICAL',
            installDate: '2024-01-15',
            decommissionDate: null,
            property: JSON.stringify({ canHaveChildren: asset.canHaveChildren }),
            createdAt: '2024-01-15T09:00:00Z',
            updatedAt: new Date().toISOString()
        };
    });
}

function getRelationApiData() {
    const relations = [];
    let id = 1;

    ALL_ASSETS.forEach(asset => {
        if (asset.parentId) {
            relations.push({
                id: id++,
                fromAssetKey: asset.id,
                toAssetKey: asset.parentId,
                relationType: 'LOCATED_IN',
                attr: null,
                createdAt: '2024-01-15T09:00:00Z',
                updatedAt: new Date().toISOString()
            });
        }
    });

    return relations;
}

// ======================
// RESPONSE HELPERS
// ======================

function createListResponse(data, path) {
    return {
        success: true,
        data: data,
        error: null,
        timestamp: new Date().toISOString(),
        path: path
    };
}

function createPagedResponse(data, page, size, path) {
    const totalElements = data.length;
    const totalPages = Math.ceil(totalElements / size);
    const start = page * size;
    const end = start + size;
    const content = data.slice(start, end);

    return {
        success: true,
        data: {
            content: content,
            page: page,
            size: size,
            totalElements: totalElements,
            totalPages: totalPages,
            first: page === 0,
            last: page >= totalPages - 1,
            empty: content.length === 0
        },
        error: null,
        timestamp: new Date().toISOString(),
        path: path
    };
}

function createSingleResponse(data, path) {
    return {
        success: true,
        data: data,
        error: null,
        timestamp: new Date().toISOString(),
        path: path
    };
}

function createErrorResponse(key, message, path) {
    return {
        success: false,
        data: null,
        error: {
            key: key,
            message: message,
            data: null
        },
        timestamp: new Date().toISOString(),
        path: path
    };
}

// ======================
// PROPERTY META & FIELD LABEL DATA (for /api/v1/ast/gx)
// ======================

const PROPERTY_META_DATA = [
    // UPS 카테고리
    { id: 1, assetCategoryType: 'UPS', fieldKey: 'rated_power_kw', description: '정격 전력 (kW)', isVisible: true, displayOrder: 1 },
    { id: 2, assetCategoryType: 'UPS', fieldKey: 'battery_capacity_ah', description: '배터리 용량 (Ah)', isVisible: true, displayOrder: 2 },
    { id: 3, assetCategoryType: 'UPS', fieldKey: 'efficiency_percent', description: '효율 (%)', isVisible: true, displayOrder: 3 },
    { id: 4, assetCategoryType: 'UPS', fieldKey: 'input_voltage_v', description: '입력 전압 (V)', isVisible: true, displayOrder: 4 },
    { id: 5, assetCategoryType: 'UPS', fieldKey: 'output_voltage_v', description: '출력 전압 (V)', isVisible: true, displayOrder: 5 },
    { id: 6, assetCategoryType: 'UPS', fieldKey: 'backup_time_min', description: '백업 시간 (분)', isVisible: true, displayOrder: 6 },
    // PDU 카테고리
    { id: 101, assetCategoryType: 'PDU', fieldKey: 'rated_power_kw', description: '정격 용량 (kW)', isVisible: true, displayOrder: 1 },
    { id: 102, assetCategoryType: 'PDU', fieldKey: 'rated_current_a', description: '정격 전류 (A)', isVisible: true, displayOrder: 2 },
    { id: 103, assetCategoryType: 'PDU', fieldKey: 'input_voltage_v', description: '입력 전압 (V)', isVisible: true, displayOrder: 3 },
    { id: 104, assetCategoryType: 'PDU', fieldKey: 'phase_type', description: '상 구분', isVisible: true, displayOrder: 4 },
    { id: 105, assetCategoryType: 'PDU', fieldKey: 'circuit_count', description: '회로 수', isVisible: true, displayOrder: 5 },
    { id: 106, assetCategoryType: 'PDU', fieldKey: 'manufacturer', description: '제조사', isVisible: true, displayOrder: 6 },
    // CRAC 카테고리
    { id: 201, assetCategoryType: 'CRAC', fieldKey: 'cooling_capacity_kw', description: '냉방 용량 (kW)', isVisible: true, displayOrder: 1 },
    { id: 202, assetCategoryType: 'CRAC', fieldKey: 'airflow_cfm', description: '풍량 (CFM)', isVisible: true, displayOrder: 2 },
    { id: 203, assetCategoryType: 'CRAC', fieldKey: 'refrigerant_type', description: '냉매 종류', isVisible: true, displayOrder: 3 },
    { id: 204, assetCategoryType: 'CRAC', fieldKey: 'power_consumption_kw', description: '소비 전력 (kW)', isVisible: true, displayOrder: 4 },
    { id: 205, assetCategoryType: 'CRAC', fieldKey: 'filter_type', description: '필터 종류', isVisible: true, displayOrder: 5 },
    { id: 206, assetCategoryType: 'CRAC', fieldKey: 'manufacturer', description: '제조사', isVisible: true, displayOrder: 6 },
    // SENSOR 카테고리
    { id: 301, assetCategoryType: 'SENSOR', fieldKey: 'sensor_type', description: '센서 유형', isVisible: true, displayOrder: 1 },
    { id: 302, assetCategoryType: 'SENSOR', fieldKey: 'measurement_range', description: '측정 범위', isVisible: true, displayOrder: 2 },
    { id: 303, assetCategoryType: 'SENSOR', fieldKey: 'accuracy', description: '정확도', isVisible: true, displayOrder: 3 },
    { id: 304, assetCategoryType: 'SENSOR', fieldKey: 'protocol', description: '통신 프로토콜', isVisible: true, displayOrder: 4 },
    { id: 305, assetCategoryType: 'SENSOR', fieldKey: 'manufacturer', description: '제조사', isVisible: true, displayOrder: 5 },
];

const FIELD_LABEL_DATA = [
    // UPS - Korean
    { id: 1, assetPropertyMetaId: 1, assetCategoryType: 'UPS', fieldKey: 'rated_power_kw', locale: 'ko', label: '정격 전력', helpText: 'UPS 명판 기준 정격 전력 (kW)' },
    { id: 2, assetPropertyMetaId: 2, assetCategoryType: 'UPS', fieldKey: 'battery_capacity_ah', locale: 'ko', label: '배터리 용량', helpText: '배터리 총 용량 (Ah)' },
    { id: 3, assetPropertyMetaId: 3, assetCategoryType: 'UPS', fieldKey: 'efficiency_percent', locale: 'ko', label: '효율', helpText: '정격 부하 시 효율 (%)' },
    { id: 4, assetPropertyMetaId: 4, assetCategoryType: 'UPS', fieldKey: 'input_voltage_v', locale: 'ko', label: '입력 전압', helpText: '입력 전압 (V)' },
    { id: 5, assetPropertyMetaId: 5, assetCategoryType: 'UPS', fieldKey: 'output_voltage_v', locale: 'ko', label: '출력 전압', helpText: '출력 전압 (V)' },
    { id: 6, assetPropertyMetaId: 6, assetCategoryType: 'UPS', fieldKey: 'backup_time_min', locale: 'ko', label: '백업 시간', helpText: '정전 시 백업 가능 시간 (분)' },
    // UPS - English
    { id: 7, assetPropertyMetaId: 1, assetCategoryType: 'UPS', fieldKey: 'rated_power_kw', locale: 'en', label: 'Rated Power', helpText: 'Rated power capacity (kW)' },
    { id: 8, assetPropertyMetaId: 2, assetCategoryType: 'UPS', fieldKey: 'battery_capacity_ah', locale: 'en', label: 'Battery Capacity', helpText: 'Total battery capacity (Ah)' },
    { id: 9, assetPropertyMetaId: 3, assetCategoryType: 'UPS', fieldKey: 'efficiency_percent', locale: 'en', label: 'Efficiency', helpText: 'Efficiency at rated load (%)' },
    { id: 10, assetPropertyMetaId: 4, assetCategoryType: 'UPS', fieldKey: 'input_voltage_v', locale: 'en', label: 'Input Voltage', helpText: 'Input voltage (V)' },
    { id: 11, assetPropertyMetaId: 5, assetCategoryType: 'UPS', fieldKey: 'output_voltage_v', locale: 'en', label: 'Output Voltage', helpText: 'Output voltage (V)' },
    { id: 12, assetPropertyMetaId: 6, assetCategoryType: 'UPS', fieldKey: 'backup_time_min', locale: 'en', label: 'Backup Time', helpText: 'Backup time during outage (min)' },
    // PDU - Korean
    { id: 101, assetPropertyMetaId: 101, assetCategoryType: 'PDU', fieldKey: 'rated_power_kw', locale: 'ko', label: '정격 용량', helpText: '분전반 정격 용량 (kW)' },
    { id: 102, assetPropertyMetaId: 102, assetCategoryType: 'PDU', fieldKey: 'rated_current_a', locale: 'ko', label: '정격 전류', helpText: '정격 전류 (A)' },
    { id: 103, assetPropertyMetaId: 103, assetCategoryType: 'PDU', fieldKey: 'input_voltage_v', locale: 'ko', label: '입력 전압', helpText: '입력 전압 (V)' },
    { id: 104, assetPropertyMetaId: 104, assetCategoryType: 'PDU', fieldKey: 'phase_type', locale: 'ko', label: '상 구분', helpText: '단상/삼상 구분' },
    { id: 105, assetPropertyMetaId: 105, assetCategoryType: 'PDU', fieldKey: 'circuit_count', locale: 'ko', label: '회로 수', helpText: '총 회로(분기) 수' },
    { id: 106, assetPropertyMetaId: 106, assetCategoryType: 'PDU', fieldKey: 'manufacturer', locale: 'ko', label: '제조사', helpText: '제조사명' },
    // PDU - English
    { id: 107, assetPropertyMetaId: 101, assetCategoryType: 'PDU', fieldKey: 'rated_power_kw', locale: 'en', label: 'Rated Power', helpText: 'Rated power capacity (kW)' },
    { id: 108, assetPropertyMetaId: 102, assetCategoryType: 'PDU', fieldKey: 'rated_current_a', locale: 'en', label: 'Rated Current', helpText: 'Rated current (A)' },
    { id: 109, assetPropertyMetaId: 103, assetCategoryType: 'PDU', fieldKey: 'input_voltage_v', locale: 'en', label: 'Input Voltage', helpText: 'Input voltage (V)' },
    { id: 110, assetPropertyMetaId: 104, assetCategoryType: 'PDU', fieldKey: 'phase_type', locale: 'en', label: 'Phase Type', helpText: 'Single/Three phase' },
    { id: 111, assetPropertyMetaId: 105, assetCategoryType: 'PDU', fieldKey: 'circuit_count', locale: 'en', label: 'Circuit Count', helpText: 'Total circuit branches' },
    { id: 112, assetPropertyMetaId: 106, assetCategoryType: 'PDU', fieldKey: 'manufacturer', locale: 'en', label: 'Manufacturer', helpText: 'Manufacturer name' },
    // CRAC - Korean
    { id: 201, assetPropertyMetaId: 201, assetCategoryType: 'CRAC', fieldKey: 'cooling_capacity_kw', locale: 'ko', label: '냉방 용량', helpText: '냉방 능력 (kW)' },
    { id: 202, assetPropertyMetaId: 202, assetCategoryType: 'CRAC', fieldKey: 'airflow_cfm', locale: 'ko', label: '풍량', helpText: '공기 순환량 (CFM)' },
    { id: 203, assetPropertyMetaId: 203, assetCategoryType: 'CRAC', fieldKey: 'refrigerant_type', locale: 'ko', label: '냉매 종류', helpText: '사용 냉매 종류' },
    { id: 204, assetPropertyMetaId: 204, assetCategoryType: 'CRAC', fieldKey: 'power_consumption_kw', locale: 'ko', label: '소비 전력', helpText: '소비 전력 (kW)' },
    { id: 205, assetPropertyMetaId: 205, assetCategoryType: 'CRAC', fieldKey: 'filter_type', locale: 'ko', label: '필터 종류', helpText: '에어 필터 종류' },
    { id: 206, assetPropertyMetaId: 206, assetCategoryType: 'CRAC', fieldKey: 'manufacturer', locale: 'ko', label: '제조사', helpText: '제조사명' },
    // CRAC - English
    { id: 207, assetPropertyMetaId: 201, assetCategoryType: 'CRAC', fieldKey: 'cooling_capacity_kw', locale: 'en', label: 'Cooling Capacity', helpText: 'Cooling capacity (kW)' },
    { id: 208, assetPropertyMetaId: 202, assetCategoryType: 'CRAC', fieldKey: 'airflow_cfm', locale: 'en', label: 'Airflow', helpText: 'Air circulation (CFM)' },
    { id: 209, assetPropertyMetaId: 203, assetCategoryType: 'CRAC', fieldKey: 'refrigerant_type', locale: 'en', label: 'Refrigerant', helpText: 'Refrigerant type' },
    { id: 210, assetPropertyMetaId: 204, assetCategoryType: 'CRAC', fieldKey: 'power_consumption_kw', locale: 'en', label: 'Power Consumption', helpText: 'Power consumption (kW)' },
    { id: 211, assetPropertyMetaId: 205, assetCategoryType: 'CRAC', fieldKey: 'filter_type', locale: 'en', label: 'Filter Type', helpText: 'Air filter type' },
    { id: 212, assetPropertyMetaId: 206, assetCategoryType: 'CRAC', fieldKey: 'manufacturer', locale: 'en', label: 'Manufacturer', helpText: 'Manufacturer name' },
    // SENSOR - Korean
    { id: 301, assetPropertyMetaId: 301, assetCategoryType: 'SENSOR', fieldKey: 'sensor_type', locale: 'ko', label: '센서 유형', helpText: '온도/습도/전력/풍량 등' },
    { id: 302, assetPropertyMetaId: 302, assetCategoryType: 'SENSOR', fieldKey: 'measurement_range', locale: 'ko', label: '측정 범위', helpText: '센서 측정 가능 범위' },
    { id: 303, assetPropertyMetaId: 303, assetCategoryType: 'SENSOR', fieldKey: 'accuracy', locale: 'ko', label: '정확도', helpText: '측정 정확도' },
    { id: 304, assetPropertyMetaId: 304, assetCategoryType: 'SENSOR', fieldKey: 'protocol', locale: 'ko', label: '통신 프로토콜', helpText: 'Modbus/BACnet/SNMP 등' },
    { id: 305, assetPropertyMetaId: 305, assetCategoryType: 'SENSOR', fieldKey: 'manufacturer', locale: 'ko', label: '제조사', helpText: '제조사명' },
    // SENSOR - English
    { id: 306, assetPropertyMetaId: 301, assetCategoryType: 'SENSOR', fieldKey: 'sensor_type', locale: 'en', label: 'Sensor Type', helpText: 'Temp/Humidity/Power/Airflow etc.' },
    { id: 307, assetPropertyMetaId: 302, assetCategoryType: 'SENSOR', fieldKey: 'measurement_range', locale: 'en', label: 'Measurement Range', helpText: 'Measurable range' },
    { id: 308, assetPropertyMetaId: 303, assetCategoryType: 'SENSOR', fieldKey: 'accuracy', locale: 'en', label: 'Accuracy', helpText: 'Measurement accuracy' },
    { id: 309, assetPropertyMetaId: 304, assetCategoryType: 'SENSOR', fieldKey: 'protocol', locale: 'en', label: 'Protocol', helpText: 'Modbus/BACnet/SNMP etc.' },
    { id: 310, assetPropertyMetaId: 305, assetCategoryType: 'SENSOR', fieldKey: 'manufacturer', locale: 'en', label: 'Manufacturer', helpText: 'Manufacturer name' },
];

// UPS용 property mock 데이터 생성 함수
function generateUPSProperty(assetKey) {
    const idx = parseInt(assetKey.replace(/\D/g, '')) || 1;
    return {
        rated_power_kw: 50 + (idx * 25) + Math.round(Math.random() * 10),
        battery_capacity_ah: 100 + (idx * 50),
        efficiency_percent: 92 + Math.round(Math.random() * 5 * 10) / 10,
        input_voltage_v: 220,
        output_voltage_v: 220,
        backup_time_min: 15 + (idx * 5)
    };
}

// PDU용 property mock 데이터 생성 함수
function generatePDUProperty(assetKey) {
    const idx = parseInt(assetKey.replace(/\D/g, '')) || 1;
    const phases = ['단상', '삼상'];
    const manufacturers = ['Schneider Electric', 'Eaton', 'ABB', 'LS Electric', 'Siemens'];
    return {
        rated_power_kw: 30 + (idx * 10) + Math.round(Math.random() * 5),
        rated_current_a: 100 + (idx * 25),
        input_voltage_v: idx % 2 === 0 ? 380 : 220,
        phase_type: phases[idx % 2],
        circuit_count: 12 + (idx % 4) * 6,
        manufacturer: manufacturers[idx % manufacturers.length]
    };
}

// CRAC용 property mock 데이터 생성 함수
function generateCRACProperty(assetKey) {
    const idx = parseInt(assetKey.replace(/\D/g, '')) || 1;
    const refrigerants = ['R-410A', 'R-407C', 'R-134a', 'R-32'];
    const filters = ['HEPA', 'Pre-filter', 'Medium-filter', 'ULPA'];
    const manufacturers = ['Emerson', 'Daikin', 'Stulz', 'Rittal', 'Carrier'];
    return {
        cooling_capacity_kw: 20 + (idx * 15) + Math.round(Math.random() * 5),
        airflow_cfm: 3000 + (idx * 500),
        refrigerant_type: refrigerants[idx % refrigerants.length],
        power_consumption_kw: 8 + (idx * 3) + Math.round(Math.random() * 2 * 10) / 10,
        filter_type: filters[idx % filters.length],
        manufacturer: manufacturers[idx % manufacturers.length]
    };
}

// SENSOR용 property mock 데이터 생성 함수
function generateSensorProperty(assetKey) {
    const idx = parseInt(assetKey.replace(/\D/g, '')) || 1;
    const sensorTypes = ['온도', '습도', '전력', '풍량'];
    const ranges = ['-20~80°C', '0~100%RH', '0~1000kW', '0~5000CFM'];
    const accuracies = ['±0.5°C', '±2%RH', '±1%', '±3%'];
    const protocols = ['Modbus RTU', 'BACnet IP', 'SNMP', 'Modbus TCP'];
    const manufacturers = ['Honeywell', 'Siemens', 'Schneider', 'Johnson Controls', 'Sensirion'];
    const typeIdx = (idx - 1) % 4;
    return {
        sensor_type: sensorTypes[typeIdx],
        measurement_range: ranges[typeIdx],
        accuracy: accuracies[typeIdx],
        protocol: protocols[idx % protocols.length],
        manufacturer: manufacturers[idx % manufacturers.length]
    };
}

// ======================
// API ENDPOINTS - Asset API v1
// ======================

/**
 * POST /api/v1/ast/l - 자산 전체 목록 조회
 */
app.post('/api/v1/ast/l', (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/v1/ast/l`);

    const { filter = {}, sort = [] } = req.body;
    let assets = getAssetApiData();

    if (filter.assetType) {
        assets = assets.filter(a => a.assetType === filter.assetType);
    }
    if (filter.assetKey) {
        assets = assets.filter(a => a.assetKey.includes(filter.assetKey));
    }
    if (filter.statusType) {
        assets = assets.filter(a => a.statusType === filter.statusType);
    }

    if (sort.length > 0) {
        const { field, direction } = sort[0];
        assets.sort((a, b) => {
            const aVal = a[field] || '';
            const bVal = b[field] || '';
            return direction === 'ASC'
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });
    }

    res.json(createListResponse(assets, '/api/v1/ast/l'));
});

/**
 * POST /api/v1/ast/la - 자산 목록 조회 (페이징)
 */
app.post('/api/v1/ast/la', (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/v1/ast/la`);

    const { page = 0, size = 20, filter = {}, sort = [] } = req.body;
    let assets = getAssetApiData();

    if (filter.assetType) {
        assets = assets.filter(a => a.assetType === filter.assetType);
    }
    if (filter.assetKey) {
        assets = assets.filter(a => a.assetKey.includes(filter.assetKey));
    }

    if (sort.length > 0) {
        const { field, direction } = sort[0];
        assets.sort((a, b) => {
            const aVal = a[field] || '';
            const bVal = b[field] || '';
            return direction === 'ASC'
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });
    }

    res.json(createPagedResponse(assets, page, size, '/api/v1/ast/la'));
});

/**
 * POST /api/v1/ast/g - 자산 단건 조회
 */
app.post('/api/v1/ast/g', (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/v1/ast/g`);

    const { assetKey } = req.body;
    const assets = getAssetApiData();
    const asset = assets.find(a => a.assetKey === assetKey);

    if (!asset) {
        return res.status(404).json(createErrorResponse(
            'ASSET_NOT_FOUND',
            `Asset not found: ${assetKey}`,
            '/api/v1/ast/g'
        ));
    }

    res.json(createSingleResponse(asset, '/api/v1/ast/g'));
});

/**
 * POST /api/v1/rel/l - 관계 전체 목록 조회
 */
app.post('/api/v1/rel/l', (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/v1/rel/l`);

    const { filter = {}, sort = [] } = req.body;
    let relations = getRelationApiData();

    if (filter.fromAssetKey) {
        relations = relations.filter(r => r.fromAssetKey === filter.fromAssetKey);
    }
    if (filter.toAssetKey) {
        relations = relations.filter(r => r.toAssetKey === filter.toAssetKey);
    }
    if (filter.relationType) {
        relations = relations.filter(r => r.relationType === filter.relationType);
    }

    res.json(createListResponse(relations, '/api/v1/rel/l'));
});

/**
 * POST /api/v1/rel/la - 관계 목록 조회 (페이징)
 */
app.post('/api/v1/rel/la', (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/v1/rel/la`);

    const { page = 0, size = 100, filter = {}, sort = [] } = req.body;
    let relations = getRelationApiData();

    if (filter.fromAssetKey) {
        relations = relations.filter(r => r.fromAssetKey === filter.fromAssetKey);
    }
    if (filter.toAssetKey) {
        relations = relations.filter(r => r.toAssetKey === filter.toAssetKey);
    }

    res.json(createPagedResponse(relations, page, size, '/api/v1/rel/la'));
});

/**
 * POST /api/v1/rel/g - 관계 단건 조회
 */
app.post('/api/v1/rel/g', (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/v1/rel/g`);

    const { id } = req.body;
    const relations = getRelationApiData();
    const relation = relations.find(r => r.id === id);

    if (!relation) {
        return res.status(404).json(createErrorResponse(
            'RELATION_NOT_FOUND',
            `Relation not found: ${id}`,
            '/api/v1/rel/g'
        ));
    }

    res.json(createSingleResponse(relation, '/api/v1/rel/g'));
});

/**
 * POST /api/v1/ast/gx - 자산 상세 조회 (통합 API)
 * Request: { assetKey, locale }
 * Response: { asset, properties[] }
 */
app.post('/api/v1/ast/gx', (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/v1/ast/gx`);

    const { assetKey, locale = 'ko' } = req.body;

    if (!assetKey) {
        return res.status(400).json(createErrorResponse(
            'INVALID_REQUEST',
            'assetKey is required',
            '/api/v1/ast/gx'
        ));
    }

    // 1. Asset 조회
    const assets = getAssetApiData();
    const asset = assets.find(a => a.assetKey === assetKey);

    if (!asset) {
        return res.status(404).json(createErrorResponse(
            'ASSET_NOT_FOUND',
            `Asset not found: ${assetKey}`,
            '/api/v1/ast/gx'
        ));
    }

    // 2. assetCategoryType 기반 PropertyMeta 조회
    const categoryType = asset.assetCategoryType;
    const propertyMetas = PROPERTY_META_DATA.filter(
        pm => pm.assetCategoryType === categoryType && pm.isVisible
    ).sort((a, b) => a.displayOrder - b.displayOrder);

    // 3. locale 기반 FieldLabel 조회
    const fieldLabels = FIELD_LABEL_DATA.filter(
        fl => fl.assetCategoryType === categoryType && fl.locale === locale
    );

    // 4. property 값 파싱 (카테고리별 동적 생성)
    let propertyValues = {};
    switch (categoryType) {
        case 'UPS': propertyValues = generateUPSProperty(assetKey); break;
        case 'PDU': propertyValues = generatePDUProperty(assetKey); break;
        case 'CRAC': propertyValues = generateCRACProperty(assetKey); break;
        case 'SENSOR': propertyValues = generateSensorProperty(assetKey); break;
        default:
            try { propertyValues = JSON.parse(asset.property || '{}'); }
            catch (e) { propertyValues = {}; }
    }

    // 5. properties 배열 조합
    const properties = propertyMetas.map(meta => {
        const label = fieldLabels.find(fl => fl.fieldKey === meta.fieldKey);
        return {
            fieldKey: meta.fieldKey,
            value: propertyValues[meta.fieldKey] ?? null,
            label: label?.label || meta.description,
            helpText: label?.helpText || null,
            displayOrder: meta.displayOrder
        };
    });

    // 6. 응답 생성
    const responseData = {
        asset: {
            assetKey: asset.assetKey,
            name: asset.name,
            assetType: asset.assetType,
            assetCategoryType: categoryType,
            statusType: asset.statusType,
            locationLabel: asset.locationLabel,
            serialNumber: asset.serialNumber,
            assetModelKey: asset.assetModelKey,
            installDate: asset.installDate,
            ownerUserId: asset.ownerUserId,
            description: asset.description
        },
        properties: properties
    };

    res.json(createSingleResponse(responseData, '/api/v1/ast/gx'));
});

// ======================
// VENDOR & MODEL MOCK DATA
// ======================

const VENDOR_DATA = [
    { id: 1, assetVendorKey: 'VENDOR_DELL_001', name: 'Dell', code: 'DELL', country: 'USA', extra: '{"website":"https://www.dell.com"}' },
    { id: 2, assetVendorKey: 'VENDOR_SCHNEIDER_001', name: 'Schneider Electric', code: 'SCHNEIDER', country: 'France', extra: '{"website":"https://www.se.com"}' },
    { id: 3, assetVendorKey: 'VENDOR_EATON_001', name: 'Eaton', code: 'EATON', country: 'Ireland', extra: '{"website":"https://www.eaton.com"}' },
    { id: 4, assetVendorKey: 'VENDOR_EMERSON_001', name: 'Emerson', code: 'EMERSON', country: 'USA', extra: '{"website":"https://www.emerson.com"}' },
    { id: 5, assetVendorKey: 'VENDOR_DAIKIN_001', name: 'Daikin', code: 'DAIKIN', country: 'Japan', extra: '{"website":"https://www.daikin.com"}' },
    { id: 6, assetVendorKey: 'VENDOR_LS_001', name: 'LS Electric', code: 'LS', country: 'Korea', extra: '{"website":"https://www.lselectric.co.kr"}' },
    { id: 7, assetVendorKey: 'VENDOR_HONEYWELL_001', name: 'Honeywell', code: 'HONEYWELL', country: 'USA', extra: '{"website":"https://www.honeywell.com"}' },
    { id: 8, assetVendorKey: 'VENDOR_SIEMENS_001', name: 'Siemens', code: 'SIEMENS', country: 'Germany', extra: '{"website":"https://www.siemens.com"}' },
].map(v => ({ ...v, createdAt: '2026-01-15T09:00:00Z', updatedAt: new Date().toISOString() }));

const MODEL_DATA = [
    { id: 1, assetModelKey: 'MODEL_DELL_R750_001', assetVendorKey: 'VENDOR_DELL_001', vendorName: 'Dell', name: 'PowerEdge R750', code: 'R750', categoryCode: 'SERVER', specJson: '{"cpu":"Intel Xeon","ram":"128GB"}' },
    { id: 2, assetModelKey: 'MODEL_SCHNEIDER_GALAXY_001', assetVendorKey: 'VENDOR_SCHNEIDER_001', vendorName: 'Schneider Electric', name: 'Galaxy VX 500kVA', code: 'GALAXY_VX_500', categoryCode: 'UPS', specJson: '{"capacity_kva":500,"phase":"3P"}' },
    { id: 3, assetModelKey: 'MODEL_EATON_93PM_001', assetVendorKey: 'VENDOR_EATON_001', vendorName: 'Eaton', name: '93PM 200kVA', code: '93PM_200', categoryCode: 'UPS', specJson: '{"capacity_kva":200,"phase":"3P"}' },
    { id: 4, assetModelKey: 'MODEL_SCHNEIDER_PDU_001', assetVendorKey: 'VENDOR_SCHNEIDER_001', vendorName: 'Schneider Electric', name: 'Rack PDU 9000', code: 'RPDU_9000', categoryCode: 'PDU', specJson: '{"rated_a":32,"outlets":24}' },
    { id: 5, assetModelKey: 'MODEL_EMERSON_LIEBERT_001', assetVendorKey: 'VENDOR_EMERSON_001', vendorName: 'Emerson', name: 'Liebert CRV 35kW', code: 'CRV_35', categoryCode: 'CRAC', specJson: '{"cooling_kw":35,"airflow_cfm":5500}' },
    { id: 6, assetModelKey: 'MODEL_DAIKIN_SURROUND_001', assetVendorKey: 'VENDOR_DAIKIN_001', vendorName: 'Daikin', name: 'Surround Handler 25kW', code: 'SH_25', categoryCode: 'CRAC', specJson: '{"cooling_kw":25,"refrigerant":"R-410A"}' },
    { id: 7, assetModelKey: 'MODEL_HONEYWELL_TEMP_001', assetVendorKey: 'VENDOR_HONEYWELL_001', vendorName: 'Honeywell', name: 'C7110A Room Sensor', code: 'C7110A', categoryCode: 'SENSOR', specJson: '{"type":"temp_humidity","range":"-20~60C"}' },
    { id: 8, assetModelKey: 'MODEL_LS_SWBD_001', assetVendorKey: 'VENDOR_LS_001', vendorName: 'LS Electric', name: 'SUSOL MCC Panel', code: 'SUSOL_MCC', categoryCode: 'SWBD', specJson: '{"rated_v":380,"rated_a":3200}' },
    { id: 9, assetModelKey: 'MODEL_SIEMENS_ACCURA_001', assetVendorKey: 'VENDOR_SIEMENS_001', vendorName: 'Siemens', name: 'ACCURA 2350', code: 'ACCURA_2350', categoryCode: 'DIST', specJson: '{"type":"power_meter","protocol":"Modbus"}' },
].map(m => ({ ...m, createdAt: '2026-01-15T09:00:00Z', updatedAt: new Date().toISOString() }));

function filterAndSort(data, filter, sort) {
    let result = [...data];
    if (filter) {
        Object.entries(filter).forEach(([key, value]) => {
            if (!value) return;
            if (key === 'q') {
                const q = value.toLowerCase();
                result = result.filter(item =>
                    Object.values(item).some(v => typeof v === 'string' && v.toLowerCase().includes(q))
                );
            } else if (typeof value === 'string' && result.length > 0 && key in result[0]) {
                result = result.filter(item =>
                    typeof item[key] === 'string' && item[key].toLowerCase().includes(value.toLowerCase())
                );
            }
        });
    }
    if (sort && sort.length > 0) {
        const { field, direction } = sort[0];
        result.sort((a, b) => {
            const aVal = a[field] || '';
            const bVal = b[field] || '';
            return direction === 'ASC'
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });
    }
    return result;
}

// ======================
// API ENDPOINTS - Vendor API v1
// ======================

/**
 * POST /api/v1/vdr/la - 벤더 목록 조회 (페이징)
 */
app.post('/api/v1/vdr/la', (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/v1/vdr/la`);
    const { page = 0, size = 20, filter = {}, sort = [] } = req.body;
    const filtered = filterAndSort(VENDOR_DATA, filter, sort);
    res.json(createPagedResponse(filtered, page, size, '/api/v1/vdr/la'));
});

/**
 * POST /api/v1/vdr/l - 벤더 전체 목록 조회
 */
app.post('/api/v1/vdr/l', (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/v1/vdr/l`);
    const { filter = {}, sort = [] } = req.body;
    const filtered = filterAndSort(VENDOR_DATA, filter, sort);
    res.json(createListResponse(filtered, '/api/v1/vdr/l'));
});

/**
 * POST /api/v1/vdr/g - 벤더 단건 조회
 */
app.post('/api/v1/vdr/g', (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/v1/vdr/g`);
    const { assetVendorKey } = req.body;
    const vendor = VENDOR_DATA.find(v => v.assetVendorKey === assetVendorKey);
    if (!vendor) {
        return res.status(404).json(createErrorResponse('VENDOR_NOT_FOUND', `Vendor not found: ${assetVendorKey}`, '/api/v1/vdr/g'));
    }
    res.json(createSingleResponse(vendor, '/api/v1/vdr/g'));
});

// ======================
// API ENDPOINTS - Model API v1
// ======================

/**
 * POST /api/v1/mdl/la - 자산 모델 목록 조회 (페이징)
 */
app.post('/api/v1/mdl/la', (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/v1/mdl/la`);
    const { page = 0, size = 20, filter = {}, sort = [] } = req.body;
    const filtered = filterAndSort(MODEL_DATA, filter, sort);
    res.json(createPagedResponse(filtered, page, size, '/api/v1/mdl/la'));
});

/**
 * POST /api/v1/mdl/l - 자산 모델 전체 목록 조회
 */
app.post('/api/v1/mdl/l', (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/v1/mdl/l`);
    const { filter = {}, sort = [] } = req.body;
    const filtered = filterAndSort(MODEL_DATA, filter, sort);
    res.json(createListResponse(filtered, '/api/v1/mdl/l'));
});

/**
 * POST /api/v1/mdl/g - 자산 모델 단건 조회
 */
app.post('/api/v1/mdl/g', (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/v1/mdl/g`);
    const { assetModelKey } = req.body;
    const model = MODEL_DATA.find(m => m.assetModelKey === assetModelKey);
    if (!model) {
        return res.status(404).json(createErrorResponse('MODEL_NOT_FOUND', `Model not found: ${assetModelKey}`, '/api/v1/mdl/g'));
    }
    res.json(createSingleResponse(model, '/api/v1/mdl/g'));
});

// ======================
// METRIC API v1 DATA
// ======================

// 자산 타입별 메트릭 mock 데이터 생성
function generateMetricsByAssetType(assetKey) {
    const now = new Date();
    const eventedAt = now.toISOString();

    if (assetKey.startsWith('crac')) return generateCRACMetrics(eventedAt);
    if (assetKey.startsWith('ups')) return generateUPSMetricsData(eventedAt);
    if (assetKey.startsWith('pdu')) return generateDISTMetrics(eventedAt);
    // sensor (default)
    return [
        { metricCode: 'SENSOR.TEMP', eventedAt, valueType: 'NUMBER', valueNumber: 20 + Math.round(Math.random() * 10 * 10) / 10 },
        { metricCode: 'SENSOR.HUMIDITY', eventedAt, valueType: 'NUMBER', valueNumber: 40 + Math.round(Math.random() * 30 * 10) / 10 },
    ];
}

function generateCRACMetrics(eventedAt) {
    return [
        { metricCode: 'CRAC.UNIT_STATUS', eventedAt, valueType: 'BOOL', valueBool: Math.random() > 0.1 },
        { metricCode: 'CRAC.FAN_STATUS', eventedAt, valueType: 'BOOL', valueBool: Math.random() > 0.1 },
        { metricCode: 'CRAC.COOL_STATUS', eventedAt, valueType: 'BOOL', valueBool: Math.random() > 0.3 },
        { metricCode: 'CRAC.HEAT_STATUS', eventedAt, valueType: 'BOOL', valueBool: Math.random() > 0.7 },
        { metricCode: 'CRAC.HUMIDIFY_STATUS', eventedAt, valueType: 'BOOL', valueBool: Math.random() > 0.6 },
        { metricCode: 'CRAC.DEHUMIDIFY_STATUS', eventedAt, valueType: 'BOOL', valueBool: Math.random() > 0.7 },
        { metricCode: 'CRAC.LEAK_STATUS', eventedAt, valueType: 'BOOL', valueBool: Math.random() > 0.95 },
        { metricCode: 'CRAC.RETURN_TEMP', eventedAt, valueType: 'NUMBER', valueNumber: 220 + Math.round(Math.random() * 80) },
        { metricCode: 'CRAC.RETURN_HUMIDITY', eventedAt, valueType: 'NUMBER', valueNumber: 400 + Math.round(Math.random() * 300) },
        { metricCode: 'CRAC.TEMP_SET', eventedAt, valueType: 'NUMBER', valueNumber: 240 },
        { metricCode: 'CRAC.HUMIDITY_SET', eventedAt, valueType: 'NUMBER', valueNumber: 500 },
        { metricCode: 'CRAC.SUPPLY_TEMP', eventedAt, valueType: 'NUMBER', valueNumber: 150 + Math.round(Math.random() * 50) },
    ];
}

function generateUPSMetricsData(eventedAt) {
    const metrics = [];
    for (let i = 1; i <= 3; i++) {
        metrics.push({ metricCode: `UPS.INPUT_V_${i}`, eventedAt, valueType: 'NUMBER', valueNumber: 2180 + Math.round(Math.random() * 40) });
        metrics.push({ metricCode: `UPS.INPUT_F_${i}`, eventedAt, valueType: 'NUMBER', valueNumber: 599 + Math.round(Math.random() * 2) });
        metrics.push({ metricCode: `UPS.INPUT_A_${i}`, eventedAt, valueType: 'NUMBER', valueNumber: 50 + Math.round(Math.random() * 100) });
    }
    for (let i = 1; i <= 3; i++) {
        metrics.push({ metricCode: `UPS.OUTPUT_V_${i}`, eventedAt, valueType: 'NUMBER', valueNumber: 2200 + Math.round(Math.random() * 10) });
        metrics.push({ metricCode: `UPS.OUTPUT_F_${i}`, eventedAt, valueType: 'NUMBER', valueNumber: 600 });
        metrics.push({ metricCode: `UPS.OUTPUT_A_${i}`, eventedAt, valueType: 'NUMBER', valueNumber: 40 + Math.round(Math.random() * 80) });
    }
    metrics.push({ metricCode: 'UPS.BATT_V', eventedAt, valueType: 'NUMBER', valueNumber: 4800 + Math.round(Math.random() * 200) });
    metrics.push({ metricCode: 'UPS.BATT_A', eventedAt, valueType: 'NUMBER', valueNumber: 10 + Math.round(Math.random() * 50) });
    metrics.push({ metricCode: 'UPS.LOAD_PCT', eventedAt, valueType: 'NUMBER', valueNumber: 40 + Math.round(Math.random() * 40) });
    metrics.push({ metricCode: 'UPS.BATT_PCT', eventedAt, valueType: 'NUMBER', valueNumber: 70 + Math.round(Math.random() * 30) });
    metrics.push({ metricCode: 'UPS.STATUS_CODE', eventedAt, valueType: 'NUMBER', valueNumber: Math.random() > 0.9 ? 1 : 0 });
    metrics.push({ metricCode: 'UPS.INPUT_BAD_STATE', eventedAt, valueType: 'BOOL', valueBool: Math.random() > 0.95 });
    metrics.push({ metricCode: 'UPS.BATT_CHARGING', eventedAt, valueType: 'BOOL', valueBool: Math.random() > 0.5 });
    metrics.push({ metricCode: 'UPS.OUTPUT_ON_BATTERY', eventedAt, valueType: 'BOOL', valueBool: Math.random() > 0.9 });
    metrics.push({ metricCode: 'UPS.INVERTER_OFF', eventedAt, valueType: 'BOOL', valueBool: Math.random() > 0.95 });
    metrics.push({ metricCode: 'UPS.ON_BYPASS', eventedAt, valueType: 'BOOL', valueBool: Math.random() > 0.9 });
    metrics.push({ metricCode: 'UPS.BATT_FAULT', eventedAt, valueType: 'BOOL', valueBool: Math.random() > 0.95 });
    metrics.push({ metricCode: 'UPS.OUTPUT_OVERLOAD', eventedAt, valueType: 'BOOL', valueBool: Math.random() > 0.95 });
    return metrics;
}

function generateDISTMetrics(eventedAt) {
    return [
        { metricCode: 'DIST.V_LN_AVG', eventedAt, valueType: 'NUMBER', valueNumber: 220 + Math.round(Math.random() * 5) },
        { metricCode: 'DIST.V_LL_AVG', eventedAt, valueType: 'NUMBER', valueNumber: 380 + Math.round(Math.random() * 5) },
        { metricCode: 'DIST.V_FUND_AVG', eventedAt, valueType: 'NUMBER', valueNumber: 219 + Math.round(Math.random() * 3) },
        { metricCode: 'DIST.FREQUENCY_HZ', eventedAt, valueType: 'NUMBER', valueNumber: 60 },
        { metricCode: 'DIST.TEMP_C', eventedAt, valueType: 'NUMBER', valueNumber: 25 + Math.round(Math.random() * 10) },
        { metricCode: 'DIST.CURRENT_AVG_A', eventedAt, valueType: 'NUMBER', valueNumber: 30 + Math.round(Math.random() * 20) },
        { metricCode: 'DIST.CURRENT_FUND_AVG_A', eventedAt, valueType: 'NUMBER', valueNumber: 28 + Math.round(Math.random() * 15) },
        { metricCode: 'DIST.ACTIVE_POWER_TOTAL_KW', eventedAt, valueType: 'NUMBER', valueNumber: 10 + Math.round(Math.random() * 20 * 10) / 10 },
        { metricCode: 'DIST.REACTIVE_POWER_TOTAL_KVAR', eventedAt, valueType: 'NUMBER', valueNumber: 2 + Math.round(Math.random() * 5 * 10) / 10 },
        { metricCode: 'DIST.APPARENT_POWER_TOTAL_KVA', eventedAt, valueType: 'NUMBER', valueNumber: 12 + Math.round(Math.random() * 20 * 10) / 10 },
        { metricCode: 'DIST.ACTIVE_ENERGY_RECEIVED_KWH', eventedAt, valueType: 'NUMBER', valueNumber: 10000 + Math.round(Math.random() * 5000) },
        { metricCode: 'DIST.ACTIVE_ENERGY_DELIVERED_KWH', eventedAt, valueType: 'NUMBER', valueNumber: Math.round(Math.random() * 100) },
        { metricCode: 'DIST.ACTIVE_ENERGY_SUM_KWH', eventedAt, valueType: 'NUMBER', valueNumber: 10000 + Math.round(Math.random() * 5000) },
        { metricCode: 'DIST.REACTIVE_ENERGY_RECEIVED_KVARH', eventedAt, valueType: 'NUMBER', valueNumber: 2000 + Math.round(Math.random() * 1000) },
        { metricCode: 'DIST.REACTIVE_ENERGY_DELIVERED_KVARH', eventedAt, valueType: 'NUMBER', valueNumber: Math.round(Math.random() * 50) },
        { metricCode: 'DIST.REACTIVE_ENERGY_SUM_KVARH', eventedAt, valueType: 'NUMBER', valueNumber: 2000 + Math.round(Math.random() * 1000) },
        { metricCode: 'DIST.APPARENT_ENERGY_KVAH', eventedAt, valueType: 'NUMBER', valueNumber: 12000 + Math.round(Math.random() * 5000) },
        { metricCode: 'DIST.POWER_FACTOR_TOTAL', eventedAt, valueType: 'NUMBER', valueNumber: 0.85 + Math.round(Math.random() * 0.1 * 100) / 100 },
    ];
}

/**
 * POST /api/v1/mh/gl - 자산별 최신 메트릭 데이터 조회
 * 특정 자산(asset_key)의 metric_code별 최신 데이터를 조회합니다.
 * 최근 1분 이내 데이터만 조회됩니다.
 */
app.post('/api/v1/mh/gl', (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/v1/mh/gl`);

    const { assetKey } = req.body;

    if (!assetKey) {
        return res.status(400).json({
            success: false,
            data: null,
            error: {
                key: 'INVALID_REQUEST',
                message: 'assetKey is required',
                data: null
            },
            timestamp: new Date().toISOString(),
            path: '/api/v1/mh/gl'
        });
    }

    // 메트릭 데이터 생성
    const metrics = generateMetricsByAssetType(assetKey);

    res.json({
        data: metrics,
        path: '/api/v1/mh/gl',
        success: true,
        timestamp: new Date().toISOString()
    });
});

// ======================
// METRIC HISTORY STATS API v1
// ======================

/**
 * 메트릭 통계 mock row 생성
 * interval에 따라 버킷 단위로 시계열 데이터를 생성
 */
function generateMhsRow(time, assetKey, metricCode, interval, statsKeys) {
    const baseAvg = 20 + Math.random() * 10;
    const fullStats = {
        count: 60 + Math.round(Math.random() * 10),
        numeric_count: 58 + Math.round(Math.random() * 10),
        avg: Math.round(baseAvg * 10) / 10,
        min: Math.round((baseAvg - 2 - Math.random() * 3) * 10) / 10,
        max: Math.round((baseAvg + 2 + Math.random() * 3) * 10) / 10
    };

    const statsBody = statsKeys && statsKeys.length > 0
        ? Object.fromEntries(statsKeys.filter(k => k in fullStats).map(k => [k, fullStats[k]]))
        : fullStats;

    const windowStart = new Date(time);
    const intervalMs = interval === '1m' ? 60000 : 3600000;
    const windowEnd = new Date(windowStart.getTime() + intervalMs - 1);

    return {
        time: windowStart.toISOString(),
        assetKey,
        metricCode,
        interval,
        statsBody,
        windowStartAt: windowStart.toISOString(),
        windowEndAt: windowEnd.toISOString(),
        sampleCount: fullStats.count,
        endpointId: null,
        sensorExternalId: null,
        createdAt: new Date(windowStart.getTime() + intervalMs + 120000).toISOString(),
        updatedAt: new Date(windowStart.getTime() + intervalMs + 300000).toISOString()
    };
}

/**
 * POST /api/v1/mhs/l - 메트릭 통계 기간 리스트 조회
 */
app.post('/api/v1/mhs/l', (req, res) => {
    // console.log(req, res)
    console.log(`[${new Date().toISOString()}] POST /api/v1/mhs/l`);

    const { sort = [], filter = {}, statsKeys: rawStatsKeys = [] } = req.body;
    const { assetKey, interval = '1h', metricCodes: rawMetricCodes = [], timeFrom, timeTo } = filter;

    // 문자열 "[a,b]" 형태를 배열로 변환 (datasetList 템플릿 호환)
    const parseArrayParam = (v) => {
        if (Array.isArray(v)) return v;
        if (typeof v === 'string') {
            const trimmed = v.replace(/^\[|\]$/g, '').trim();
            return trimmed ? trimmed.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')) : [];
        }
        return [];
    };
    const metricCodes = parseArrayParam(rawMetricCodes);
    const statsKeys = parseArrayParam(rawStatsKeys);

    if (!assetKey || !timeFrom || !timeTo || !interval) {
        return res.status(400).json(createErrorResponse(
            'INVALID_REQUEST',
            'filter.assetKey, filter.interval, filter.timeFrom, filter.timeTo are required',
            '/api/v1/mhs/l'
        ));
    }

    const codes = metricCodes.length > 0 ? metricCodes : ['SENSOR.TEMP'];
    const intervalMs = interval === '1m' ? 60000 : 3600000;
    const from = new Date(timeFrom).getTime();
    const to = new Date(timeTo).getTime();
    const rows = [];

    for (let t = from; t <= to; t += intervalMs) {
        for (const code of codes) {
            rows.push(generateMhsRow(new Date(t).toISOString(), assetKey, code, interval, statsKeys));
        }
    }

    // sort
    if (sort.length > 0) {
        const { field, direction } = sort[0];
        rows.sort((a, b) => {
            const aVal = a[field] || '';
            const bVal = b[field] || '';
            return direction === 'ASC'
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });
    }

    res.json(createListResponse(rows, '/api/v1/mhs/l'));
});

/**
 * POST /api/v1/mhs/g - 메트릭 통계 단건 조회
 */
app.post('/api/v1/mhs/g', (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/v1/mhs/g`);

    const { filter = {}, statsKeys = [] } = req.body;
    const { time, assetKey, metricCode, interval = '1h' } = filter;

    if (!assetKey || !metricCode || !interval) {
        return res.status(400).json(createErrorResponse(
            'INVALID_REQUEST',
            'filter.assetKey, filter.metricCode, filter.interval are required',
            '/api/v1/mhs/g'
        ));
    }

    const bucketTime = time || new Date().toISOString();
    const row = generateMhsRow(bucketTime, assetKey, metricCode, interval, statsKeys);

    res.json(createSingleResponse(row, '/api/v1/mhs/g'));
});

// ======================
// SERVER START
// ======================

generateAssets();

app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  ECO Mock Server (Asset API v1 Only)`);
    console.log(`  Running on http://localhost:${PORT}`);
    console.log(`========================================`);
    console.log(`\nAsset Summary: ${ALL_ASSETS.length} total assets`);
    console.log(`\nAvailable endpoints:`);
    console.log(`  POST /api/v1/ast/l      - Asset list (all)`);
    console.log(`  POST /api/v1/ast/la     - Asset list (paged)`);
    console.log(`  POST /api/v1/ast/g      - Asset single`);
    console.log(`  POST /api/v1/ast/gx     - Asset detail (unified API)`);
    console.log(`  POST /api/v1/rel/l      - Relation list (all)`);
    console.log(`  POST /api/v1/rel/la     - Relation list (paged)`);
    console.log(`  POST /api/v1/rel/g      - Relation single`);
    console.log(`  POST /api/v1/mh/gl      - Metric latest (per asset)`);
    console.log(`  POST /api/v1/mhs/l      - Metric history stats list`);
    console.log(`  POST /api/v1/mhs/g      - Metric history stats single`);
    console.log(`  POST /api/v1/vdr/la     - Vendor list (paged)`);
    console.log(`  POST /api/v1/vdr/l      - Vendor list (all)`);
    console.log(`  POST /api/v1/vdr/g      - Vendor single`);
    console.log(`  POST /api/v1/mdl/la     - Model list (paged)`);
    console.log(`  POST /api/v1/mdl/l      - Model list (all)`);
    console.log(`  POST /api/v1/mdl/g      - Model single`);
    console.log(`\nMock Data: ${VENDOR_DATA.length} vendors, ${MODEL_DATA.length} models`);
    console.log(`\n`);
});
