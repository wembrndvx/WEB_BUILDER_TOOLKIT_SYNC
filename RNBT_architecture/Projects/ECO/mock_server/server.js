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

/**
 * 하위 자산들의 상태를 집계하여 부모 상태 결정
 * critical > warning > normal 우선순위
 */
function calculateAggregateStatus(node) {
    if (!node.children || node.children.length === 0) {
        return node.status || 'normal';
    }

    let hasCritical = false;
    let hasWarning = false;

    for (const child of node.children) {
        const childStatus = calculateAggregateStatus(child);
        if (childStatus === 'critical') hasCritical = true;
        if (childStatus === 'warning') hasWarning = true;
    }

    if (hasCritical) return 'critical';
    if (hasWarning) return 'warning';
    return 'normal';
}

// ======================
// HIERARCHY DATA STRUCTURE
// ======================
// 핵심 원칙: 모든 것은 "자산(Asset)"
// - canHaveChildren: true → Tree에 표시되는 컨테이너 자산
// - canHaveChildren: false → Table에만 표시되는 말단 자산
// - 자산은 개별로 존재하거나 다른 자산에 포함될 수 있음

// Hierarchy & Assets Cache
let HIERARCHY_CACHE = null;
let ALL_ASSETS = [];  // 모든 자산 (canHaveChildren 관계없이)

// ======================
// HIERARCHY DATA GENERATORS
// ======================

// 대량 데이터 생성 설정
const DATA_CONFIG = {
    buildings: 25,           // 건물 수
    floorsPerBuilding: 5,    // 건물당 층 수
    roomsPerFloor: 4,        // 층당 방 수
    racksPerRoom: 3,         // 방당 랙 수
    serversPerRack: 8,       // 랙당 서버 수
    // 방당 추가 장비
    pdusPerRoom: 2,
    upsPerRoom: 1,
    cracsPerRoom: 2,
    sensorsPerRoom: 4
};

// 건물 이름 생성기
const BUILDING_NAMES = [
    '본관', '별관 A', '별관 B', '신관', '구관',
    '동관', '서관', '남관', '북관', '중앙관',
    'IDC-A', 'IDC-B', 'IDC-C', 'IDC-D', 'IDC-E',
    'DC Tower A', 'DC Tower B', 'DC Tower C',
    '데이터센터 1', '데이터센터 2', '데이터센터 3',
    '통합관제동', '전산동', '네트워크동', '백업센터'
];

// 방 이름 템플릿
const ROOM_TEMPLATES = [
    '서버실', '전산실', 'IDC룸', '네트워크실',
    'UPS실', '항온항습실', '전력실', '통합관제실',
    '스토리지실', '백업실', '보안관제실', '운영실'
];

/**
 * 대규모 자산 계층 생성 (5,000+ assets)
 *
 * 구조:
 * Building (25) > Floor (5) > Room (4) > Rack (3) > Server (8)
 *                                     > PDU, UPS, CRAC, Sensor
 *
 * 예상 자산 수:
 * - 건물: 25
 * - 층: 25 * 5 = 125
 * - 방: 125 * 4 = 500
 * - 랙: 500 * 3 = 1,500
 * - 서버: 1,500 * 8 = 12,000
 * - PDU: 500 * 2 = 1,000
 * - UPS: 500 * 1 = 500
 * - CRAC: 500 * 2 = 1,000
 * - 센서: 500 * 4 = 2,000
 * 총: 약 18,650+ 자산
 */
function generateHierarchy() {
    ALL_ASSETS = [];

    const items = [];
    let serverIdx = 1, pduIdx = 1, upsIdx = 1, cracIdx = 1, sensorIdx = 1, rackIdx = 1;

    for (let b = 1; b <= DATA_CONFIG.buildings; b++) {
        const buildingId = `building-${String(b).padStart(3, '0')}`;
        const buildingName = BUILDING_NAMES[b - 1] || `Building ${b}`;

        const floors = [];

        for (let f = 1; f <= DATA_CONFIG.floorsPerBuilding; f++) {
            const floorId = `floor-${String(b).padStart(3, '0')}-${String(f).padStart(2, '0')}`;
            const floorName = `${f}층`;

            const rooms = [];

            for (let r = 1; r <= DATA_CONFIG.roomsPerFloor; r++) {
                const roomId = `room-${String(b).padStart(3, '0')}-${String(f).padStart(2, '0')}-${String(r).padStart(2, '0')}`;
                const roomTemplate = ROOM_TEMPLATES[(f * DATA_CONFIG.roomsPerFloor + r) % ROOM_TEMPLATES.length];
                const roomName = `${roomTemplate} ${String.fromCharCode(64 + r)}`;

                const roomChildren = [];

                // Racks with Servers
                for (let rk = 1; rk <= DATA_CONFIG.racksPerRoom; rk++) {
                    const rackId = `rack-${String(rackIdx++).padStart(4, '0')}`;
                    const rackName = `Rack ${String.fromCharCode(64 + rk)}-${String(rk).padStart(2, '0')}`;

                    const servers = [];
                    for (let s = 1; s <= DATA_CONFIG.serversPerRack; s++) {
                        const serverId = `server-${String(serverIdx++).padStart(5, '0')}`;
                        servers.push(createAsset(serverId, `Server ${serverId.split('-')[1]}`, 'server', rackId, false));
                    }

                    // PDU in rack (일부 랙에만)
                    if (rk === 1) {
                        const pduId = `pdu-${String(pduIdx++).padStart(4, '0')}`;
                        servers.push(createAsset(pduId, `PDU ${pduId.split('-')[1]} (In-Rack)`, 'pdu', rackId, false));
                    }

                    roomChildren.push(createAsset(rackId, rackName, 'rack', roomId, true, servers));
                }

                // Standalone PDUs
                for (let p = 1; p <= DATA_CONFIG.pdusPerRoom - 1; p++) {
                    const pduId = `pdu-${String(pduIdx++).padStart(4, '0')}`;
                    roomChildren.push(createAsset(pduId, `PDU ${pduId.split('-')[1]}`, 'pdu', roomId, false));
                }

                // UPS
                for (let u = 1; u <= DATA_CONFIG.upsPerRoom; u++) {
                    const upsId = `ups-${String(upsIdx++).padStart(4, '0')}`;
                    roomChildren.push(createAsset(upsId, `UPS ${upsId.split('-')[1]}`, 'ups', roomId, false));
                }

                // CRAC
                for (let c = 1; c <= DATA_CONFIG.cracsPerRoom; c++) {
                    const cracId = `crac-${String(cracIdx++).padStart(4, '0')}`;
                    roomChildren.push(createAsset(cracId, `CRAC ${cracId.split('-')[1]}`, 'crac', roomId, false));
                }

                // Sensors
                const sensorTypes = ['Temp', 'Humidity', 'Power', 'Air Flow'];
                for (let se = 1; se <= DATA_CONFIG.sensorsPerRoom; se++) {
                    const sensorId = `sensor-${String(sensorIdx++).padStart(5, '0')}`;
                    const sensorType = sensorTypes[(se - 1) % sensorTypes.length];
                    roomChildren.push(createAsset(sensorId, `${sensorType} Sensor ${sensorId.split('-')[1]}`, 'sensor', roomId, false));
                }

                rooms.push(createAsset(roomId, roomName, 'room', floorId, true, roomChildren));
            }

            floors.push(createAsset(floorId, floorName, 'floor', buildingId, true, rooms));
        }

        items.push(createAsset(buildingId, buildingName, 'building', null, true, floors));
    }

    // 독립 공간 추가 (기존 케이스 유지)
    items.push(
        createAsset('room-independent-01', '외부 창고', 'room', null, true, [
            createAsset('storage-001', 'Storage 001', 'storage', 'room-independent-01', false),
            createAsset(`sensor-${String(sensorIdx++).padStart(5, '0')}`, 'Temp Sensor', 'sensor', 'room-independent-01', false),
        ]),
        createAsset('room-independent-02', '야외 발전기실', 'room', null, true, [
            createAsset(`ups-${String(upsIdx++).padStart(4, '0')}`, 'Outdoor UPS', 'ups', 'room-independent-02', false),
            createAsset(`pdu-${String(pduIdx++).padStart(4, '0')}`, 'Outdoor PDU', 'pdu', 'room-independent-02', false),
            createAsset(`sensor-${String(sensorIdx++).padStart(5, '0')}`, 'Power Meter', 'sensor', 'room-independent-02', false),
        ])
    );

    return items;
}

/**
 * 자산 생성 헬퍼 함수
 * @param {string} id - 자산 ID
 * @param {string} name - 자산 이름
 * @param {string} type - 자산 유형
 * @param {string|null} parentId - 부모 자산 ID
 * @param {boolean} canHaveChildren - 컨테이너 여부 (Tree 표시 여부)
 * @param {Array} children - 하위 자산 배열
 */
function createAsset(id, name, type, parentId, canHaveChildren, children = []) {
    const asset = {
        id,
        name,
        type,
        parentId,
        canHaveChildren,
        hasChildren: children.length > 0,
        status: getRandomStatus(),
        children
    };

    // 모든 자산을 ALL_ASSETS에 등록 (Tree 노드 포함)
    ALL_ASSETS.push({
        id,
        name,
        type,
        parentId,
        canHaveChildren,
        status: asset.status
    });

    return asset;
}

function initializeHierarchy() {
    ALL_ASSETS = [];

    const items = generateHierarchy();

    // 상태 집계 (하위 → 상위)
    items.forEach(item => {
        item.status = calculateAggregateStatus(item);
    });

    // 통계 집계
    const stats = countAssetsByType(items);

    HIERARCHY_CACHE = {
        items,
        summary: {
            totalAssets: ALL_ASSETS.length,
            containers: stats.containers,
            terminals: stats.terminals,
            byType: stats.byType
        }
    };

    console.log(`[Hierarchy] Initialized: ${ALL_ASSETS.length} total assets`);
    console.log(`  - Containers (canHaveChildren=true): ${stats.containers}`);
    console.log(`  - Terminals (canHaveChildren=false): ${stats.terminals}`);
    console.log(`  - By Type:`, stats.byType);
}

/**
 * 자산 유형별 통계
 */
function countAssetsByType(items) {
    const byType = {};
    let containers = 0;
    let terminals = 0;

    ALL_ASSETS.forEach(asset => {
        byType[asset.type] = (byType[asset.type] || 0) + 1;
        if (asset.canHaveChildren) {
            containers++;
        } else {
            terminals++;
        }
    });

    return { byType, containers, terminals };
}

/**
 * 재귀적으로 노드 찾기 (모든 깊이 지원)
 */
function findNodeById(nodeId, items = null) {
    if (!HIERARCHY_CACHE && !items) return null;

    const searchItems = items || HIERARCHY_CACHE.items;

    for (const item of searchItems) {
        if (item.id === nodeId) return item;
        if (item.children && item.children.length > 0) {
            const found = findNodeById(nodeId, item.children);
            if (found) return found;
        }
    }
    return null;
}

/**
 * 노드 경로 생성 (부모 → 현재)
 * @param {string} nodeId - 노드 ID
 * @param {string} locale - 언어 코드 (ko, en, ja)
 */
function getNodePath(nodeId, locale = 'ko') {
    if (!HIERARCHY_CACHE) return '';

    const node = findNodeById(nodeId);
    if (!node) return '';

    const translatedNode = applyI18nToAsset(node, locale);
    const path = [translatedNode.name];
    let current = node;

    while (current.parentId) {
        const parent = findNodeById(current.parentId);
        if (parent) {
            const translatedParent = applyI18nToAsset(parent, locale);
            path.unshift(translatedParent.name);
            current = parent;
        } else {
            break;
        }
    }

    return path.join(' > ');
}

/**
 * depth 제한에 따라 트리 구조 필터링
 * - 모든 자산을 Tree에 포함 (canHaveChildren 관계없이)
 * @param {Array} items - 트리 아이템 배열
 * @param {number} maxDepth - 최대 depth (1: 루트만, 2: 루트+1레벨, ...)
 * @param {number} currentDepth - 현재 depth
 * @returns {Array} depth 제한된 트리 (모든 자산)
 */
function limitTreeDepth(items, maxDepth, currentDepth = 1) {
    if (!items || items.length === 0) return [];

    return items.map(item => {
        const allChildren = item.children || [];

        const result = {
            id: item.id,
            name: item.name,
            type: item.type,
            canHaveChildren: item.canHaveChildren,
            hasChildren: allChildren.length > 0,
            parentId: item.parentId,
            status: item.status
        };

        // depth 범위 내에서만 children 포함
        if (currentDepth < maxDepth && allChildren.length > 0) {
            result.children = limitTreeDepth(allChildren, maxDepth, currentDepth + 1);
        } else {
            // depth 초과시 빈 배열 (hasChildren으로 Lazy Loading 가능 여부 판단)
            result.children = [];
        }

        return result;
    });
}

/**
 * 특정 노드의 직속 하위 자산 조회 (Lazy Loading용)
 * - 모든 하위 자산 반환 (canHaveChildren 관계없이)
 * @param {string} nodeId - 부모 노드 ID
 * @returns {Array} 직속 하위 자산 목록
 */
function getNodeChildren(nodeId) {
    const node = findNodeById(nodeId);
    if (!node || !node.children) return [];

    // 모든 자산 반환
    return node.children.map(child => {
        const allChildren = child.children || [];
        return {
            id: child.id,
            name: child.name,
            type: child.type,
            canHaveChildren: child.canHaveChildren,
            hasChildren: allChildren.length > 0,
            parentId: nodeId,
            status: child.status
        };
    });
}

/**
 * 특정 노드 하위의 모든 자산 조회 (재귀)
 * - canHaveChildren 관계없이 모든 하위 자산 반환
 * @param {string} nodeId - 부모 노드 ID
 * @returns {Array} 모든 하위 자산 목록
 */
function getNodeAssets(nodeId) {
    const node = findNodeById(nodeId);
    if (!node) return [];

    const assets = [];

    function collectAssets(item) {
        // 현재 노드도 자산으로 포함 (루트 노드 제외)
        if (item.id !== nodeId) {
            assets.push({
                id: item.id,
                name: item.name,
                type: item.type,
                parentId: item.parentId,
                canHaveChildren: item.canHaveChildren,
                status: item.status
            });
        }
        // 하위 자산 재귀 수집
        if (item.children && item.children.length > 0) {
            item.children.forEach(child => collectAssets(child));
        }
    }

    collectAssets(node);
    return assets;
}

// ======================
// UPS MOCK DATA GENERATORS
// ======================

function generateUPS(id, locale = 'ko') {
    const load = Math.round((30 + Math.random() * 50 + (Math.random() > 0.9 ? 30 : 0)) * 10) / 10;
    const batteryLevel = Math.round((80 + Math.random() * 20) * 10) / 10;
    const batteryHealth = Math.round((85 + Math.random() * 15) * 10) / 10;

    let status = 'normal';
    if (load >= 90 || batteryLevel <= 15) status = 'critical';
    else if (load >= 70 || batteryLevel <= 30) status = 'warning';

    const modes = ['online', 'online', 'online', 'bypass', 'battery'];
    const mode = modes[Math.floor(Math.random() * modes.length)];

    // Find parentId from ALL_ASSETS
    const asset = ALL_ASSETS.find(a => a.id === id);

    // 필드 데이터 (fields 배열 생성용)
    const fieldData = {
        load,
        batteryLevel,
        batteryHealth,
        inputVoltage: Math.round((218 + Math.random() * 4) * 10) / 10,
        outputVoltage: Math.round((219 + Math.random() * 2) * 10) / 10,
        runtime: Math.floor(batteryLevel * 0.6),
        temperature: Math.round((28 + Math.random() * 10) * 10) / 10,
        mode
    };

    // 상태 라벨
    const statusLabels = I18N_DATA.statuses[locale] || I18N_DATA.statuses['ko'];
    const typeLabels = I18N_DATA.types[locale] || I18N_DATA.types['ko'];

    return {
        id,
        name: `UPS ${id.split('-')[1]}`,
        type: 'ups',
        typeLabel: typeLabels['ups'],
        parentId: asset?.parentId || null,
        status,
        statusLabel: statusLabels[status],
        fields: buildFieldsArray('ups', fieldData, locale),
        threshold: {
            loadWarning: 70,
            loadCritical: 90,
            batteryWarning: 30,
            batteryCritical: 15
        },
        lastUpdated: new Date().toISOString()
    };
}

function generateUPSHistory(upsId, period = '24h') {
    const now = new Date();
    const points = period === '24h' ? 24 : period === '7d' ? 168 : 720;
    const interval = 60;

    const timestamps = [];
    const loadData = [];
    const batteryData = [];

    for (let i = points - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - i * interval * 60000);
        timestamps.push(time.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));

        const baseLoad = 50 + Math.sin(i / 4) * 15;
        const noiseLoad = (Math.random() - 0.5) * 10;
        loadData.push(Math.round(Math.max(20, Math.min(95, baseLoad + noiseLoad)) * 10) / 10);

        const baseBattery = 95 + Math.sin(i / 12) * 5;
        const noiseBattery = (Math.random() - 0.5) * 3;
        batteryData.push(Math.round(Math.max(60, Math.min(100, baseBattery + noiseBattery)) * 10) / 10);
    }

    return {
        upsId,
        period,
        timestamps,
        load: loadData,
        battery: batteryData,
        thresholds: {
            loadWarning: 70,
            loadCritical: 90
        }
    };
}

// ======================
// PDU MOCK DATA GENERATORS
// ======================

function generatePDU(id, locale = 'ko') {
    const totalPower = Math.round((8 + Math.random() * 10) * 10) / 10;
    const voltage = 220;
    const totalCurrent = Math.round((totalPower * 1000 / voltage) * 10) / 10;
    const circuitCount = 24;
    const activeCircuits = 12 + Math.floor(Math.random() * 10);

    let status = 'normal';
    if (totalPower >= 18) status = 'critical';
    else if (totalPower >= 15) status = 'warning';

    const asset = ALL_ASSETS.find(a => a.id === id);

    // 필드 데이터 (fields 배열 생성용)
    const fieldData = {
        totalPower,
        totalCurrent,
        voltage,
        circuitCount,
        activeCircuits,
        powerFactor: Math.round((0.9 + Math.random() * 0.1) * 100) / 100
    };

    // 상태 라벨
    const statusLabels = I18N_DATA.statuses[locale] || I18N_DATA.statuses['ko'];
    const typeLabels = I18N_DATA.types[locale] || I18N_DATA.types['ko'];

    return {
        id,
        name: `PDU ${id.split('-')[1]}`,
        type: 'pdu',
        typeLabel: typeLabels['pdu'],
        parentId: asset?.parentId || null,
        status,
        statusLabel: statusLabels[status],
        fields: buildFieldsArray('pdu', fieldData, locale),
        threshold: {
            powerWarning: 15,
            powerCritical: 18
        },
        lastUpdated: new Date().toISOString()
    };
}

function generatePDUCircuits(pduId) {
    const circuitNames = [
        'Server Rack A', 'Server Rack B', 'Network Switch', 'Storage Array',
        'Cooling Unit', 'Lighting', 'Monitoring', 'UPS Feed', 'HVAC',
        'Security System', 'Fire Suppression', 'Backup Power'
    ];

    const count = 18 + Math.floor(Math.random() * 6);
    const circuits = [];

    for (let i = 0; i < count; i++) {
        const current = Math.round(Math.random() * 15 * 10) / 10;
        const power = Math.round((current * 220 / 1000) * 100) / 100;
        const isActive = current > 0.5;

        circuits.push({
            id: i + 1,
            name: `${circuitNames[i % circuitNames.length]} ${Math.floor(i / circuitNames.length) + 1}`,
            current,
            power,
            status: isActive ? 'active' : 'inactive',
            breaker: isActive ? 'on' : 'off'
        });
    }

    circuits.sort((a, b) => b.power - a.power);

    return {
        pduId,
        circuits,
        totalCount: circuits.length
    };
}

function generatePDUHistory(pduId, period = '24h') {
    const now = new Date();
    const points = period === '24h' ? 24 : period === '7d' ? 168 : 720;
    const interval = 60;

    const timestamps = [];
    const powerData = [];
    const currentData = [];

    for (let i = points - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - i * interval * 60000);
        timestamps.push(time.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));

        const basePower = 12 + Math.sin(i / 6) * 3;
        const noisePower = (Math.random() - 0.5) * 2;
        const power = Math.round(Math.max(5, Math.min(18, basePower + noisePower)) * 10) / 10;
        powerData.push(power);
        currentData.push(Math.round((power * 1000 / 220) * 10) / 10);
    }

    return {
        pduId,
        period,
        timestamps,
        power: powerData,
        current: currentData
    };
}

// ======================
// CRAC MOCK DATA GENERATORS
// ======================

function generateCRAC(id, locale = 'ko') {
    const supplyTemp = Math.round((16 + Math.random() * 4) * 10) / 10;
    const returnTemp = Math.round((22 + Math.random() * 6) * 10) / 10;
    const humidity = Math.round((40 + Math.random() * 20) * 10) / 10;

    let status = 'normal';
    if (returnTemp >= 32 || humidity < 30 || humidity > 70) status = 'critical';
    else if (returnTemp >= 28 || humidity < 40 || humidity > 60) status = 'warning';

    const modes = ['cooling', 'cooling', 'cooling', 'heating', 'dehumidifying', 'standby'];
    const compressorStates = ['running', 'running', 'running', 'idle', 'fault'];
    const mode = modes[Math.floor(Math.random() * modes.length)];
    const compressorStatus = compressorStates[Math.floor(Math.random() * compressorStates.length)];

    const asset = ALL_ASSETS.find(a => a.id === id);

    // 필드 데이터 (fields 배열 생성용)
    const fieldData = {
        supplyTemp,
        returnTemp,
        setpoint: 18.0,
        humidity,
        humiditySetpoint: 50,
        fanSpeed: Math.round((60 + Math.random() * 40) * 10) / 10,
        compressorStatus,
        coolingCapacity: Math.round((70 + Math.random() * 30) * 10) / 10,
        mode
    };

    // 상태 라벨
    const statusLabels = I18N_DATA.statuses[locale] || I18N_DATA.statuses['ko'];
    const typeLabels = I18N_DATA.types[locale] || I18N_DATA.types['ko'];

    return {
        id,
        name: `CRAC ${id.split('-')[1]}`,
        type: 'crac',
        typeLabel: typeLabels['crac'],
        parentId: asset?.parentId || null,
        status,
        statusLabel: statusLabels[status],
        fields: buildFieldsArray('crac', fieldData, locale),
        threshold: {
            tempWarning: 28,
            tempCritical: 32,
            humidityLow: 30,
            humidityHigh: 70
        },
        lastUpdated: new Date().toISOString()
    };
}

function generateCRACHistory(cracId, period = '24h') {
    const now = new Date();
    const points = period === '24h' ? 24 : period === '7d' ? 168 : 720;
    const interval = 60;

    const timestamps = [];
    const supplyTempData = [];
    const returnTempData = [];
    const humidityData = [];

    for (let i = points - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - i * interval * 60000);
        timestamps.push(time.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));

        const baseSupply = 18 + Math.sin(i / 8) * 1;
        supplyTempData.push(Math.round((baseSupply + (Math.random() - 0.5) * 2) * 10) / 10);

        const baseReturn = 24 + Math.sin(i / 6) * 2;
        returnTempData.push(Math.round((baseReturn + (Math.random() - 0.5) * 3) * 10) / 10);

        const baseHumidity = 50 + Math.sin(i / 10) * 5;
        humidityData.push(Math.round(Math.max(35, Math.min(65, baseHumidity + (Math.random() - 0.5) * 8)) * 10) / 10);
    }

    return {
        cracId,
        period,
        timestamps,
        supplyTemp: supplyTempData,
        returnTemp: returnTempData,
        humidity: humidityData
    };
}

// ======================
// SENSOR MOCK DATA GENERATORS
// ======================

function generateSensor(id, locale = 'ko') {
    const temperature = Math.round((20 + Math.random() * 10) * 10) / 10;
    const humidity = Math.round((35 + Math.random() * 30) * 10) / 10;
    const dewpoint = Math.round((temperature - ((100 - humidity) / 5)) * 10) / 10;

    let status = 'normal';
    if (temperature >= 32 || humidity < 30 || humidity > 70) status = 'critical';
    else if (temperature >= 28 || humidity < 40 || humidity > 60) status = 'warning';

    const asset = ALL_ASSETS.find(a => a.id === id);

    // 필드 데이터 (fields 배열 생성용)
    const fieldData = {
        temperature,
        humidity,
        dewpoint
    };

    // 상태 라벨
    const statusLabels = I18N_DATA.statuses[locale] || I18N_DATA.statuses['ko'];
    const typeLabels = I18N_DATA.types[locale] || I18N_DATA.types['ko'];

    return {
        id,
        name: `Sensor ${id.split('-')[1]}`,
        type: 'sensor',
        typeLabel: typeLabels['sensor'],
        parentId: asset?.parentId || null,
        status,
        statusLabel: statusLabels[status],
        fields: buildFieldsArray('sensor', fieldData, locale),
        threshold: {
            tempWarning: 28,
            tempCritical: 32,
            humidityLow: 30,
            humidityHigh: 70
        },
        lastUpdated: new Date().toISOString()
    };
}

function generateSensorHistory(sensorId, period = '24h') {
    const now = new Date();
    const points = period === '24h' ? 24 : period === '7d' ? 168 : 720;
    const interval = 60;

    const timestamps = [];
    const temperatures = [];
    const humidityData = [];

    for (let i = points - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - i * interval * 60000);
        timestamps.push(time.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));

        const baseTemp = 24 + Math.sin(i / 6) * 2;
        temperatures.push(Math.round((baseTemp + (Math.random() - 0.5) * 3) * 10) / 10);

        const baseHumidity = 50 + Math.sin(i / 8) * 5;
        humidityData.push(Math.round(Math.max(35, Math.min(65, baseHumidity + (Math.random() - 0.5) * 8)) * 10) / 10);
    }

    return {
        sensorId,
        period,
        timestamps,
        temperatures,
        humidity: humidityData
    };
}

// ======================
// I18N FIELD LABELS (필드 메타데이터)
// ======================

const I18N_FIELD_LABELS = {
    ups: {
        load: { ko: '부하율', en: 'Load', ja: '負荷率' },
        batteryLevel: { ko: '배터리 잔량', en: 'Battery Level', ja: 'バッテリー残量' },
        batteryHealth: { ko: '배터리 상태', en: 'Battery Health', ja: 'バッテリー状態' },
        inputVoltage: { ko: '입력 전압', en: 'Input Voltage', ja: '入力電圧' },
        outputVoltage: { ko: '출력 전압', en: 'Output Voltage', ja: '出力電圧' },
        runtime: { ko: '예상 런타임', en: 'Est. Runtime', ja: '予想稼働時間' },
        temperature: { ko: '온도', en: 'Temperature', ja: '温度' },
        mode: { ko: '운전 모드', en: 'Mode', ja: '運転モード' }
    },
    pdu: {
        totalPower: { ko: '총 전력', en: 'Total Power', ja: '総電力' },
        totalCurrent: { ko: '총 전류', en: 'Total Current', ja: '総電流' },
        voltage: { ko: '전압', en: 'Voltage', ja: '電圧' },
        circuitCount: { ko: '회로 수', en: 'Circuit Count', ja: '回路数' },
        activeCircuits: { ko: '활성 회로', en: 'Active Circuits', ja: 'アクティブ回路' },
        powerFactor: { ko: '역률', en: 'Power Factor', ja: '力率' }
    },
    crac: {
        supplyTemp: { ko: '공급 온도', en: 'Supply Temp', ja: '供給温度' },
        returnTemp: { ko: '환기 온도', en: 'Return Temp', ja: '還気温度' },
        setpoint: { ko: '설정 온도', en: 'Setpoint', ja: '設定温度' },
        humidity: { ko: '습도', en: 'Humidity', ja: '湿度' },
        humiditySetpoint: { ko: '습도 설정', en: 'Humidity Setpoint', ja: '湿度設定' },
        fanSpeed: { ko: '팬 속도', en: 'Fan Speed', ja: 'ファン速度' },
        compressorStatus: { ko: '압축기 상태', en: 'Compressor', ja: 'コンプレッサー' },
        coolingCapacity: { ko: '냉각 용량', en: 'Cooling Capacity', ja: '冷却能力' },
        mode: { ko: '운전 모드', en: 'Mode', ja: '運転モード' }
    },
    sensor: {
        temperature: { ko: '온도', en: 'Temperature', ja: '温度' },
        humidity: { ko: '습도', en: 'Humidity', ja: '湿度' },
        dewpoint: { ko: '이슬점', en: 'Dewpoint', ja: '露点' }
    }
};

// 필드 단위 정의
const FIELD_UNITS = {
    ups: {
        load: '%',
        batteryLevel: '%',
        batteryHealth: '%',
        inputVoltage: 'V',
        outputVoltage: 'V',
        runtime: 'min',
        temperature: '°C',
        mode: null
    },
    pdu: {
        totalPower: 'kW',
        totalCurrent: 'A',
        voltage: 'V',
        circuitCount: null,
        activeCircuits: null,
        powerFactor: null
    },
    crac: {
        supplyTemp: '°C',
        returnTemp: '°C',
        setpoint: '°C',
        humidity: '%',
        humiditySetpoint: '%',
        fanSpeed: '%',
        compressorStatus: null,
        coolingCapacity: '%',
        mode: null
    },
    sensor: {
        temperature: '°C',
        humidity: '%',
        dewpoint: '°C'
    }
};

// 모드 값 라벨 (enum 타입용)
const I18N_MODE_LABELS = {
    ups: {
        mode: {
            online: { ko: '온라인', en: 'Online', ja: 'オンライン' },
            bypass: { ko: '바이패스', en: 'Bypass', ja: 'バイパス' },
            battery: { ko: '배터리', en: 'Battery', ja: 'バッテリー' }
        }
    },
    crac: {
        mode: {
            cooling: { ko: '냉방', en: 'Cooling', ja: '冷房' },
            heating: { ko: '난방', en: 'Heating', ja: '暖房' },
            dehumidifying: { ko: '제습', en: 'Dehumidifying', ja: '除湿' },
            standby: { ko: '대기', en: 'Standby', ja: '待機' }
        },
        compressorStatus: {
            running: { ko: '가동중', en: 'Running', ja: '稼働中' },
            idle: { ko: '대기중', en: 'Idle', ja: '待機中' },
            fault: { ko: '고장', en: 'Fault', ja: '故障' }
        }
    }
};

/**
 * 필드 메타데이터를 포함한 fields 배열 생성
 * @param {string} assetType - 자산 유형 (ups, pdu, crac, sensor)
 * @param {Object} data - 원본 데이터 객체
 * @param {string} locale - 언어 코드 (ko, en, ja)
 * @returns {Array} 필드 메타데이터 배열
 */
function buildFieldsArray(assetType, data, locale = 'ko') {
    const fieldLabels = I18N_FIELD_LABELS[assetType] || {};
    const fieldUnits = FIELD_UNITS[assetType] || {};
    const modeLabels = I18N_MODE_LABELS[assetType] || {};

    const fields = [];
    let order = 1;

    for (const key of Object.keys(fieldLabels)) {
        if (!(key in data)) continue;

        const value = data[key];
        const label = fieldLabels[key]?.[locale] || fieldLabels[key]?.['ko'] || key;
        const unit = fieldUnits[key] || null;

        const field = {
            key,
            label,
            value,
            order: order++
        };

        if (unit) {
            field.unit = unit;
        }

        // enum 타입 값의 라벨 처리
        if (modeLabels[key] && modeLabels[key][value]) {
            field.valueLabel = modeLabels[key][value][locale] || modeLabels[key][value]['ko'] || value;
        }

        fields.push(field);
    }

    return fields;
}

// ======================
// I18N DATA (자산 데이터 전용)
// ======================

const I18N_DATA = {
    locales: [
        { code: 'ko', name: '한국어', default: true },
        { code: 'en', name: 'English' },
        { code: 'ja', name: '日本語' }
    ],

    // 자산 이름 (locale별)
    names: {
        // 건물
        'building-001': { ko: '본관', en: 'Main Building', ja: '本館' },
        'building-002': { ko: '별관 A', en: 'Annex A', ja: '別館A' },
        'building-003': { ko: '별관 B', en: 'Annex B', ja: '別館B' },
        // 층
        'floor-001-01': { ko: '1층', en: '1st Floor', ja: '1階' },
        'floor-001-02': { ko: '2층', en: '2nd Floor', ja: '2階' },
        'floor-002-01': { ko: '1층', en: '1st Floor', ja: '1階' },
        'floor-003-01': { ko: '1층', en: '1st Floor', ja: '1階' },
        'floor-003-02': { ko: '2층', en: '2nd Floor', ja: '2階' },
        // 방
        'room-001-01-01': { ko: '서버실 A', en: 'Server Room A', ja: 'サーバールームA' },
        'room-001-01-02': { ko: '네트워크실', en: 'Network Room', ja: 'ネットワーク室' },
        'room-001-02-01': { ko: 'UPS실', en: 'UPS Room', ja: 'UPS室' },
        'room-002-01-01': { ko: '전산실', en: 'Computer Room', ja: '電算室' },
        'room-002-01-02': { ko: '항온항습실', en: 'HVAC Room', ja: '空調室' },
        'room-003-01-01': { ko: '통합관제실', en: 'Control Room', ja: '統合管制室' },
        // 독립 공간 (root level rooms)
        'room-independent-01': { ko: '외부 창고', en: 'External Warehouse', ja: '外部倉庫' },
        'room-independent-02': { ko: '야외 발전기실', en: 'Outdoor Generator Room', ja: '屋外発電機室' }
    },

    // 타입 라벨
    types: {
        ko: {
            building: '건물', floor: '층', room: '방', rack: '랙', cabinet: '캐비넷',
            server: '서버', storage: '스토리지', switch: '스위치', router: '라우터',
            ups: 'UPS', pdu: 'PDU', crac: '항온항습기', sensor: '센서', circuit: '회로'
        },
        en: {
            building: 'Building', floor: 'Floor', room: 'Room', rack: 'Rack', cabinet: 'Cabinet',
            server: 'Server', storage: 'Storage', switch: 'Switch', router: 'Router',
            ups: 'UPS', pdu: 'PDU', crac: 'CRAC', sensor: 'Sensor', circuit: 'Circuit'
        },
        ja: {
            building: 'ビル', floor: 'フロア', room: '部屋', rack: 'ラック', cabinet: 'キャビネット',
            server: 'サーバー', storage: 'ストレージ', switch: 'スイッチ', router: 'ルーター',
            ups: 'UPS', pdu: 'PDU', crac: '空調機', sensor: 'センサー', circuit: '回路'
        }
    },

    // 상태 라벨
    statuses: {
        ko: { normal: '정상', warning: '경고', critical: '위험' },
        en: { normal: 'Normal', warning: 'Warning', critical: 'Critical' },
        ja: { normal: '正常', warning: '警告', critical: '危険' }
    }
};

/**
 * 자산에 다국어 라벨 적용
 * @param {Object} asset - 원본 자산
 * @param {string} locale - 언어 코드 (ko, en, ja)
 * @returns {Object} 다국어 적용된 자산
 */
function applyI18nToAsset(asset, locale = 'ko') {
    const typeLabels = I18N_DATA.types[locale] || I18N_DATA.types['ko'];
    const statusLabels = I18N_DATA.statuses[locale] || I18N_DATA.statuses['ko'];
    const nameI18n = I18N_DATA.names[asset.id];

    return {
        ...asset,
        name: nameI18n ? (nameI18n[locale] || nameI18n['ko'] || asset.name) : asset.name,
        typeLabel: typeLabels[asset.type] || asset.type,
        statusLabel: statusLabels[asset.status] || asset.status
    };
}

/**
 * 트리 구조에 다국어 적용 (재귀)
 */
function applyI18nToTree(items, locale = 'ko') {
    return items.map(item => {
        const translated = applyI18nToAsset(item, locale);
        if (item.children && item.children.length > 0) {
            translated.children = applyI18nToTree(item.children, locale);
        }
        return translated;
    });
}

// ======================
// SUMMARY GENERATOR
// ======================

function generateAssetsSummary(assets) {
    const byType = {};
    const byStatus = { normal: 0, warning: 0, critical: 0 };

    assets.forEach(asset => {
        byType[asset.type] = (byType[asset.type] || 0) + 1;
        byStatus[asset.status] = (byStatus[asset.status] || 0) + 1;
    });

    return {
        total: assets.length,
        byType,
        byStatus
    };
}

// ======================
// API ENDPOINTS - I18N
// ======================

/**
 * GET /api/i18n/locales
 * 지원 locale 목록 조회
 */
app.get('/api/i18n/locales', (req, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/i18n/locales`);
    res.json({
        data: {
            available: I18N_DATA.locales,
            default: I18N_DATA.locales.find(l => l.default)?.code || 'ko'
        }
    });
});

// ======================
// API ENDPOINTS - Hierarchy
// ======================

/**
 * GET /api/hierarchy?depth=n&locale=ko
 * 계층 트리 조회 (초기 로딩)
 * - depth: 반환할 트리 깊이 (기본: 2)
 * - locale: 언어 코드 (ko, en, ja)
 */
app.get('/api/hierarchy', (req, res) => {
    if (!HIERARCHY_CACHE) initializeHierarchy();

    const depth = parseInt(req.query.depth) || 2;
    const locale = req.query.locale || 'ko';
    const limitedItems = limitTreeDepth(HIERARCHY_CACHE.items, depth);
    const translatedItems = applyI18nToTree(limitedItems, locale);

    console.log(`[${new Date().toISOString()}] GET /api/hierarchy?depth=${depth}&locale=${locale}`);

    res.json({
        data: {
            items: translatedItems,
            summary: {
                ...HIERARCHY_CACHE.summary,
                depth
            }
        },
        meta: { locale }
    });
});

/**
 * GET /api/hierarchy/:assetId/children?locale=ko
 * 노드 하위 컨테이너 조회 (Lazy Loading)
 * - locale: 언어 코드 (ko, en, ja)
 */
app.get('/api/hierarchy/:assetId/children', (req, res) => {
    const { assetId } = req.params;
    const locale = req.query.locale || 'ko';

    if (!HIERARCHY_CACHE) initializeHierarchy();

    const children = getNodeChildren(assetId);
    const translatedChildren = children.map(child => applyI18nToAsset(child, locale));

    console.log(`[${new Date().toISOString()}] GET /api/hierarchy/${assetId}/children?locale=${locale} - ${children.length} children`);

    res.json({
        data: {
            parentId: assetId,
            children: translatedChildren
        },
        meta: { locale }
    });
});

/**
 * GET /api/hierarchy/:assetId/assets?locale=ko
 * 노드 하위의 모든 자산 조회 (Table용)
 * - locale: 언어 코드 (ko, en, ja)
 */
app.get('/api/hierarchy/:assetId/assets', (req, res) => {
    const { assetId } = req.params;
    const locale = req.query.locale || 'ko';

    if (!HIERARCHY_CACHE) initializeHierarchy();

    const node = findNodeById(assetId);
    if (!node) {
        return res.status(404).json({ error: 'Asset not found', assetId });
    }

    const assets = getNodeAssets(assetId);
    const translatedAssets = assets.map(asset => applyI18nToAsset(asset, locale));
    const translatedNode = applyI18nToAsset(node, locale);
    const assetPath = getNodePath(assetId, locale);
    const summary = generateAssetsSummary(assets);

    console.log(`[${new Date().toISOString()}] GET /api/hierarchy/${assetId}/assets?locale=${locale} - ${assets.length} assets`);

    res.json({
        data: {
            assetId,
            assetName: translatedNode.name,
            assetPath,
            assetType: node.type,
            assetTypeLabel: translatedNode.typeLabel,
            assets: translatedAssets,
            summary
        },
        meta: { locale }
    });
});

// ======================
// API ENDPOINTS - UPS
// ======================

app.get('/api/ups/:id', (req, res) => {
    if (!HIERARCHY_CACHE) initializeHierarchy();
    const { id } = req.params;
    const locale = req.query.locale || 'ko';
    const ups = generateUPS(id, locale);
    console.log(`[${new Date().toISOString()}] GET /api/ups/${id}?locale=${locale}`);
    res.json({ data: ups, meta: { locale } });
});

app.get('/api/ups/:id/history', (req, res) => {
    const { id } = req.params;
    const { period = '24h' } = req.query;
    const history = generateUPSHistory(id, period);
    console.log(`[${new Date().toISOString()}] GET /api/ups/${id}/history?period=${period}`);
    res.json({ data: history });
});

// ======================
// API ENDPOINTS - PDU
// ======================

app.get('/api/pdu/:id', (req, res) => {
    if (!HIERARCHY_CACHE) initializeHierarchy();
    const { id } = req.params;
    const locale = req.query.locale || 'ko';
    const pdu = generatePDU(id, locale);
    console.log(`[${new Date().toISOString()}] GET /api/pdu/${id}?locale=${locale}`);
    res.json({ data: pdu, meta: { locale } });
});

app.get('/api/pdu/:id/circuits', (req, res) => {
    const { id } = req.params;
    const circuits = generatePDUCircuits(id);
    console.log(`[${new Date().toISOString()}] GET /api/pdu/${id}/circuits`);
    res.json({ data: circuits });
});

app.get('/api/pdu/:id/history', (req, res) => {
    const { id } = req.params;
    const { period = '24h' } = req.query;
    const history = generatePDUHistory(id, period);
    console.log(`[${new Date().toISOString()}] GET /api/pdu/${id}/history?period=${period}`);
    res.json({ data: history });
});

// ======================
// API ENDPOINTS - CRAC
// ======================

app.get('/api/crac/:id', (req, res) => {
    if (!HIERARCHY_CACHE) initializeHierarchy();
    const { id } = req.params;
    const locale = req.query.locale || 'ko';
    const crac = generateCRAC(id, locale);
    console.log(`[${new Date().toISOString()}] GET /api/crac/${id}?locale=${locale}`);
    res.json({ data: crac, meta: { locale } });
});

app.get('/api/crac/:id/history', (req, res) => {
    const { id } = req.params;
    const { period = '24h' } = req.query;
    const history = generateCRACHistory(id, period);
    console.log(`[${new Date().toISOString()}] GET /api/crac/${id}/history?period=${period}`);
    res.json({ data: history });
});

// ======================
// API ENDPOINTS - Sensor
// ======================

app.get('/api/sensor/:id', (req, res) => {
    if (!HIERARCHY_CACHE) initializeHierarchy();
    const { id } = req.params;
    const locale = req.query.locale || 'ko';
    const sensor = generateSensor(id, locale);
    console.log(`[${new Date().toISOString()}] GET /api/sensor/${id}?locale=${locale}`);
    res.json({ data: sensor, meta: { locale } });
});

app.get('/api/sensor/:id/history', (req, res) => {
    const { id } = req.params;
    const { period = '24h' } = req.query;
    const history = generateSensorHistory(id, period);
    console.log(`[${new Date().toISOString()}] GET /api/sensor/${id}/history?period=${period}`);
    res.json({ data: history });
});

// ======================
// SERVER START
// ======================

// Initialize hierarchy on startup
initializeHierarchy();

app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  ECO Mock Server`);
    console.log(`  Environmental Control & Operations`);
    console.log(`  Running on http://localhost:${PORT}`);
    console.log(`========================================`);
    console.log(`\n핵심 원칙: 모든 것은 자산(Asset)`);
    console.log(`  - canHaveChildren: true → Tree에 표시 (컨테이너)`);
    console.log(`  - canHaveChildren: false → Table에만 표시 (말단)`);
    console.log(`\nAsset Summary:`);
    console.log(`  Total Assets: ${HIERARCHY_CACHE.summary.totalAssets}`);
    console.log(`  Containers: ${HIERARCHY_CACHE.summary.containers}`);
    console.log(`  Terminals: ${HIERARCHY_CACHE.summary.terminals}`);
    console.log(`  By Type:`, HIERARCHY_CACHE.summary.byType);
    console.log(`\nAvailable endpoints:`);
    console.log(`  GET /api/hierarchy?depth=n&locale=ko       - Hierarchy tree (depth limited)`);
    console.log(`  GET /api/hierarchy/:assetId/children       - Asset children (Lazy Loading)`);
    console.log(`  GET /api/hierarchy/:assetId/assets         - All assets under asset (for Table)`);
    console.log(`  GET /api/ups/:assetId?locale=ko            - UPS status with fields metadata`);
    console.log(`  GET /api/ups/:assetId/history              - UPS load/battery history`);
    console.log(`  GET /api/pdu/:assetId?locale=ko            - PDU status with fields metadata`);
    console.log(`  GET /api/pdu/:assetId/circuits             - PDU circuit list`);
    console.log(`  GET /api/pdu/:assetId/history              - PDU power/current history`);
    console.log(`  GET /api/crac/:assetId?locale=ko           - CRAC status with fields metadata`);
    console.log(`  GET /api/crac/:assetId/history             - CRAC temperature/humidity history`);
    console.log(`  GET /api/sensor/:assetId?locale=ko         - Sensor status with fields metadata`);
    console.log(`  GET /api/sensor/:assetId/history           - Sensor temperature/humidity history`);
    console.log(`\n`);
});
