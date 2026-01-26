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

function getAssetApiData() {
    return ALL_ASSETS.map((asset, index) => ({
        id: index + 1,
        assetKey: asset.id,
        assetModelId: null,
        assetModelKey: null,
        ownerUserId: null,
        serviceType: 'DCM',
        domainType: 'FACILITY',
        assetCategoryType: asset.type.toUpperCase(),
        assetType: asset.type.toUpperCase(),
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
    }));
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
// PROPERTY META & FIELD LABEL DATA (for /api/v1/ast/detail)
// ======================

const PROPERTY_META_DATA = [
    // UPS 카테고리
    { id: 1, assetCategoryType: 'UPS', fieldKey: 'rated_power_kw', description: '정격 전력 (kW)', isVisible: true, displayOrder: 1 },
    { id: 2, assetCategoryType: 'UPS', fieldKey: 'battery_capacity_ah', description: '배터리 용량 (Ah)', isVisible: true, displayOrder: 2 },
    { id: 3, assetCategoryType: 'UPS', fieldKey: 'efficiency_percent', description: '효율 (%)', isVisible: true, displayOrder: 3 },
    { id: 4, assetCategoryType: 'UPS', fieldKey: 'input_voltage_v', description: '입력 전압 (V)', isVisible: true, displayOrder: 4 },
    { id: 5, assetCategoryType: 'UPS', fieldKey: 'output_voltage_v', description: '출력 전압 (V)', isVisible: true, displayOrder: 5 },
    { id: 6, assetCategoryType: 'UPS', fieldKey: 'backup_time_min', description: '백업 시간 (분)', isVisible: true, displayOrder: 6 },
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
 * POST /api/v1/ast/detail - 자산 상세 조회 (통합 API)
 * Request: { assetKey, locale }
 * Response: { asset, properties[] }
 */
app.post('/api/v1/ast/detail', (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/v1/ast/detail`);

    const { assetKey, locale = 'ko' } = req.body;

    if (!assetKey) {
        return res.status(400).json(createErrorResponse(
            'INVALID_REQUEST',
            'assetKey is required',
            '/api/v1/ast/detail'
        ));
    }

    // 1. Asset 조회
    const assets = getAssetApiData();
    const asset = assets.find(a => a.assetKey === assetKey);

    if (!asset) {
        return res.status(404).json(createErrorResponse(
            'ASSET_NOT_FOUND',
            `Asset not found: ${assetKey}`,
            '/api/v1/ast/detail'
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

    // 4. property 값 파싱 (UPS인 경우 동적 생성)
    let propertyValues = {};
    if (categoryType === 'UPS') {
        propertyValues = generateUPSProperty(assetKey);
    } else {
        try {
            propertyValues = JSON.parse(asset.property || '{}');
        } catch (e) {
            propertyValues = {};
        }
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

    res.json(createSingleResponse(responseData, '/api/v1/ast/detail'));
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
    console.log(`  POST /api/v1/ast/detail - Asset detail (unified API)`);
    console.log(`  POST /api/v1/rel/l      - Relation list (all)`);
    console.log(`  POST /api/v1/rel/la     - Relation list (paged)`);
    console.log(`  POST /api/v1/rel/g      - Relation single`);
    console.log(`\n`);
});
