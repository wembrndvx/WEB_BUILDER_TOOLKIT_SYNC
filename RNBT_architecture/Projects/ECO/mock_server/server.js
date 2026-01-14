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

/**
 * 통합 자산 계층 생성
 *
 * 다양한 케이스를 다룸:
 * 1. Building > Floor > Room (공간 계층)
 * 2. Room > Rack > Server (장비 계층)
 * 3. Room > PDU (개별 존재)
 * 4. Rack > PDU (포함 관계)
 * 5. 독립 자산 (센서, CRAC 등)
 *
 * 모든 항목은 동일한 Asset 구조:
 * - id, name, type, parentId
 * - canHaveChildren: boolean (Tree 표시 여부)
 * - hasChildren: boolean (Lazy Loading용)
 * - children: [] (하위 자산)
 */
function generateHierarchy() {
    ALL_ASSETS = [];

    const items = [
        // ========================================
        // 케이스 1: 본관 - 전통적인 공간 계층
        // Building > Floor > Room > Rack > Server
        // ========================================
        createAsset('building-001', '본관', 'building', null, true, [
            createAsset('floor-001-01', '1층', 'floor', 'building-001', true, [
                createAsset('room-001-01-01', '서버실 A', 'room', 'floor-001-01', true, [
                    // Rack은 컨테이너 (Server를 포함)
                    createAsset('rack-001', 'Rack A-01', 'rack', 'room-001-01-01', true, [
                        createAsset('server-001', 'Server 001', 'server', 'rack-001', false),
                        createAsset('server-002', 'Server 002', 'server', 'rack-001', false),
                        createAsset('server-003', 'Server 003', 'server', 'rack-001', false),
                    ]),
                    createAsset('rack-002', 'Rack A-02', 'rack', 'room-001-01-01', true, [
                        createAsset('server-004', 'Server 004', 'server', 'rack-002', false),
                        createAsset('server-005', 'Server 005', 'server', 'rack-002', false),
                        // PDU가 Rack 안에 포함된 케이스
                        createAsset('pdu-001', 'PDU 001 (In-Rack)', 'pdu', 'rack-002', false),
                    ]),
                    // PDU가 Room에 직접 존재하는 케이스 (Rack 밖)
                    createAsset('pdu-002', 'PDU 002 (Standalone)', 'pdu', 'room-001-01-01', false),
                    // CRAC, Sensor는 말단 자산
                    createAsset('crac-001', 'CRAC 001', 'crac', 'room-001-01-01', false),
                    createAsset('sensor-001', 'Sensor 001', 'sensor', 'room-001-01-01', false),
                ]),
                createAsset('room-001-01-02', '네트워크실', 'room', 'floor-001-01', true, [
                    // 네트워크 장비 전용 Rack
                    createAsset('rack-003', 'Network Rack 01', 'rack', 'room-001-01-02', true, [
                        createAsset('switch-001', 'Switch 001', 'switch', 'rack-003', false),
                        createAsset('switch-002', 'Switch 002', 'switch', 'rack-003', false),
                        createAsset('router-001', 'Router 001', 'router', 'rack-003', false),
                    ]),
                    createAsset('ups-001', 'UPS 001', 'ups', 'room-001-01-02', false),
                    createAsset('sensor-002', 'Sensor 002', 'sensor', 'room-001-01-02', false),
                ]),
            ]),
            createAsset('floor-001-02', '2층', 'floor', 'building-001', true, [
                createAsset('room-001-02-01', 'UPS실', 'room', 'floor-001-02', true, [
                    // UPS는 말단 자산 (다른 것을 포함하지 않음)
                    createAsset('ups-002', 'UPS 002', 'ups', 'room-001-02-01', false),
                    createAsset('ups-003', 'UPS 003', 'ups', 'room-001-02-01', false),
                    createAsset('ups-004', 'UPS 004', 'ups', 'room-001-02-01', false),
                    createAsset('sensor-003', 'Sensor 003', 'sensor', 'room-001-02-01', false),
                ]),
            ]),
        ]),

        // ========================================
        // 케이스 2: 별관 A - PDU가 컨테이너 역할
        // Room > PDU > Circuit (PDU가 회로를 포함)
        // ========================================
        createAsset('building-002', '별관 A', 'building', null, true, [
            createAsset('floor-002-01', '1층', 'floor', 'building-002', true, [
                createAsset('room-002-01-01', '전산실', 'room', 'floor-002-01', true, [
                    // PDU가 컨테이너 역할 (회로/분기를 포함)
                    createAsset('pdu-003', 'PDU 003 (Main)', 'pdu', 'room-002-01-01', true, [
                        createAsset('circuit-001', 'Circuit A1', 'circuit', 'pdu-003', false),
                        createAsset('circuit-002', 'Circuit A2', 'circuit', 'pdu-003', false),
                        createAsset('circuit-003', 'Circuit B1', 'circuit', 'pdu-003', false),
                    ]),
                    // 일반 PDU (말단)
                    createAsset('pdu-004', 'PDU 004', 'pdu', 'room-002-01-01', false),
                    createAsset('crac-002', 'CRAC 002', 'crac', 'room-002-01-01', false),
                ]),
                createAsset('room-002-01-02', '항온항습실', 'room', 'floor-002-01', true, [
                    createAsset('crac-003', 'CRAC 003', 'crac', 'room-002-01-02', false),
                    createAsset('crac-004', 'CRAC 004', 'crac', 'room-002-01-02', false),
                    createAsset('sensor-004', 'Sensor 004', 'sensor', 'room-002-01-02', false),
                    createAsset('sensor-005', 'Sensor 005', 'sensor', 'room-002-01-02', false),
                ]),
            ]),
        ]),

        // ========================================
        // 케이스 3: 별관 B - 혼합 구조
        // 깊은 계층 + 평면 구조 공존
        // ========================================
        createAsset('building-003', '별관 B', 'building', null, true, [
            createAsset('floor-003-01', '1층', 'floor', 'building-003', true, [
                createAsset('room-003-01-01', '통합관제실', 'room', 'floor-003-01', true, [
                    // 캐비넷(컨테이너) 안에 여러 장비
                    createAsset('cabinet-001', 'Cabinet 001', 'cabinet', 'room-003-01-01', true, [
                        createAsset('server-006', 'Server 006', 'server', 'cabinet-001', false),
                        createAsset('storage-001', 'Storage 001', 'storage', 'cabinet-001', false),
                        createAsset('pdu-005', 'PDU 005', 'pdu', 'cabinet-001', false),
                    ]),
                    // 독립 센서들
                    createAsset('sensor-006', 'Temp Sensor', 'sensor', 'room-003-01-01', false),
                    createAsset('sensor-007', 'Humidity Sensor', 'sensor', 'room-003-01-01', false),
                    createAsset('sensor-008', 'Power Meter', 'sensor', 'room-003-01-01', false),
                ]),
            ]),
            createAsset('floor-003-02', '2층', 'floor', 'building-003', true, [
                // 빈 층 (하위 자산 없음, 하지만 canHaveChildren=true)
                // hasChildren=false로 설정됨
            ]),
        ]),
    ];

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
        title: 'ECO 자산 관리',
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

function generateUPS(id) {
    const load = Math.round((30 + Math.random() * 50 + (Math.random() > 0.9 ? 30 : 0)) * 10) / 10;
    const batteryLevel = Math.round((80 + Math.random() * 20) * 10) / 10;
    const batteryHealth = Math.round((85 + Math.random() * 15) * 10) / 10;

    let status = 'normal';
    if (load >= 90 || batteryLevel <= 15) status = 'critical';
    else if (load >= 70 || batteryLevel <= 30) status = 'warning';

    const modes = ['online', 'online', 'online', 'bypass', 'battery'];

    // Find roomId from ALL_ASSETS
    const asset = ALL_ASSETS.find(a => a.id === id);

    return {
        id,
        name: `UPS ${id.split('-')[1]}`,
        roomId: asset?.roomId || null,
        inputVoltage: Math.round((218 + Math.random() * 4) * 10) / 10,
        outputVoltage: Math.round((219 + Math.random() * 2) * 10) / 10,
        load,
        batteryLevel,
        batteryHealth,
        runtime: Math.floor(batteryLevel * 0.6),
        temperature: Math.round((28 + Math.random() * 10) * 10) / 10,
        status,
        mode: modes[Math.floor(Math.random() * modes.length)],
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

function generatePDU(id) {
    const totalPower = Math.round((8 + Math.random() * 10) * 10) / 10;
    const voltage = 220;
    const totalCurrent = Math.round((totalPower * 1000 / voltage) * 10) / 10;
    const circuitCount = 24;
    const activeCircuits = 12 + Math.floor(Math.random() * 10);

    let status = 'normal';
    if (totalPower >= 18) status = 'critical';
    else if (totalPower >= 15) status = 'warning';

    const asset = ALL_ASSETS.find(a => a.id === id);

    return {
        id,
        name: `PDU ${id.split('-')[1]}`,
        roomId: asset?.roomId || null,
        totalPower,
        totalCurrent,
        voltage,
        circuitCount,
        activeCircuits,
        powerFactor: Math.round((0.9 + Math.random() * 0.1) * 100) / 100,
        status,
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

function generateCRAC(id) {
    const supplyTemp = Math.round((16 + Math.random() * 4) * 10) / 10;
    const returnTemp = Math.round((22 + Math.random() * 6) * 10) / 10;
    const humidity = Math.round((40 + Math.random() * 20) * 10) / 10;

    let status = 'normal';
    if (returnTemp >= 32 || humidity < 30 || humidity > 70) status = 'critical';
    else if (returnTemp >= 28 || humidity < 40 || humidity > 60) status = 'warning';

    const modes = ['cooling', 'cooling', 'cooling', 'heating', 'dehumidifying', 'standby'];
    const compressorStates = ['running', 'running', 'running', 'idle', 'fault'];

    const asset = ALL_ASSETS.find(a => a.id === id);

    return {
        id,
        name: `CRAC ${id.split('-')[1]}`,
        roomId: asset?.roomId || null,
        supplyTemp,
        returnTemp,
        setpoint: 18.0,
        humidity,
        humiditySetpoint: 50,
        fanSpeed: Math.round((60 + Math.random() * 40) * 10) / 10,
        compressorStatus: compressorStates[Math.floor(Math.random() * compressorStates.length)],
        coolingCapacity: Math.round((70 + Math.random() * 30) * 10) / 10,
        status,
        mode: modes[Math.floor(Math.random() * modes.length)],
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

function generateSensor(id) {
    const temperature = Math.round((20 + Math.random() * 10) * 10) / 10;
    const humidity = Math.round((35 + Math.random() * 30) * 10) / 10;
    const dewpoint = Math.round((temperature - ((100 - humidity) / 5)) * 10) / 10;

    let status = 'normal';
    if (temperature >= 32 || humidity < 30 || humidity > 70) status = 'critical';
    else if (temperature >= 28 || humidity < 40 || humidity > 60) status = 'warning';

    const asset = ALL_ASSETS.find(a => a.id === id);

    return {
        id,
        name: `Sensor ${id.split('-')[1]}`,
        roomId: asset?.roomId || null,
        temperature,
        humidity,
        dewpoint,
        status,
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
        'room-003-01-01': { ko: '통합관제실', en: 'Control Room', ja: '統合管制室' }
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
            title: HIERARCHY_CACHE.title,
            items: translatedItems,
            summary: {
                ...HIERARCHY_CACHE.summary,
                depth
            },
            meta: { locale }
        }
    });
});

/**
 * GET /api/hierarchy/:nodeId/children?locale=ko
 * 노드 하위 컨테이너 조회 (Lazy Loading)
 * - locale: 언어 코드 (ko, en, ja)
 */
app.get('/api/hierarchy/:nodeId/children', (req, res) => {
    const { nodeId } = req.params;
    const locale = req.query.locale || 'ko';

    if (!HIERARCHY_CACHE) initializeHierarchy();

    const children = getNodeChildren(nodeId);
    const translatedChildren = children.map(child => applyI18nToAsset(child, locale));

    console.log(`[${new Date().toISOString()}] GET /api/hierarchy/${nodeId}/children?locale=${locale} - ${children.length} children`);

    res.json({
        data: {
            parentId: nodeId,
            children: translatedChildren
        },
        meta: { locale }
    });
});

/**
 * GET /api/hierarchy/:nodeId/assets?locale=ko
 * 노드 하위의 모든 자산 조회 (Table용)
 * - locale: 언어 코드 (ko, en, ja)
 */
app.get('/api/hierarchy/:nodeId/assets', (req, res) => {
    const { nodeId } = req.params;
    const locale = req.query.locale || 'ko';

    if (!HIERARCHY_CACHE) initializeHierarchy();

    const node = findNodeById(nodeId);
    if (!node) {
        return res.status(404).json({ error: 'Node not found', nodeId });
    }

    const assets = getNodeAssets(nodeId);
    const translatedAssets = assets.map(asset => applyI18nToAsset(asset, locale));
    const translatedNode = applyI18nToAsset(node, locale);
    const nodePath = getNodePath(nodeId, locale);
    const summary = generateAssetsSummary(assets);

    console.log(`[${new Date().toISOString()}] GET /api/hierarchy/${nodeId}/assets?locale=${locale} - ${assets.length} assets`);

    res.json({
        data: {
            nodeId,
            nodeName: translatedNode.name,
            nodePath,
            nodeType: node.type,
            nodeTypeLabel: translatedNode.typeLabel,
            assets: translatedAssets,
            summary
        },
        meta: { locale }
    });
});

// ======================
// API ENDPOINTS - Assets (Updated)
// ======================

app.get('/api/assets/summary', (req, res) => {
    if (!HIERARCHY_CACHE) initializeHierarchy();
    const summary = generateAssetsSummary(ALL_ASSETS);
    console.log(`[${new Date().toISOString()}] GET /api/assets/summary`);
    res.json({ data: { summary } });
});

app.get('/api/assets', (req, res) => {
    if (!HIERARCHY_CACHE) initializeHierarchy();

    const { type, parentId, canHaveChildren } = req.query;
    let filteredAssets = [...ALL_ASSETS];

    if (type) {
        const types = type.split(',');
        filteredAssets = filteredAssets.filter(asset => types.includes(asset.type));
    }

    if (parentId) {
        filteredAssets = filteredAssets.filter(asset => asset.parentId === parentId);
    }

    if (canHaveChildren !== undefined) {
        const isContainer = canHaveChildren === 'true';
        filteredAssets = filteredAssets.filter(asset => asset.canHaveChildren === isContainer);
    }

    const summary = generateAssetsSummary(filteredAssets);
    console.log(`[${new Date().toISOString()}] GET /api/assets - ${filteredAssets.length} assets`);
    res.json({ data: { assets: filteredAssets, summary } });
});

app.get('/api/asset/:id', (req, res) => {
    if (!HIERARCHY_CACHE) initializeHierarchy();

    const { id } = req.params;
    const asset = ALL_ASSETS.find(a => a.id === id);

    console.log(`[${new Date().toISOString()}] GET /api/asset/${id} - ${asset ? 'found' : 'not found'}`);

    if (!asset) {
        return res.status(404).json({ error: 'Asset not found', id });
    }
    res.json({ data: asset });
});

app.post('/api/assets/validate', (req, res) => {
    if (!HIERARCHY_CACHE) initializeHierarchy();

    const { ids } = req.body;

    if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ error: 'ids array is required' });
    }

    const validIds = [];
    const invalidIds = [];

    ids.forEach(id => {
        if (ALL_ASSETS.find(a => a.id === id)) {
            validIds.push(id);
        } else {
            invalidIds.push(id);
        }
    });

    console.log(`[${new Date().toISOString()}] POST /api/assets/validate - ${ids.length} ids, ${validIds.length} valid`);
    res.json({ data: { validIds, invalidIds } });
});

// ======================
// API ENDPOINTS - UPS
// ======================

app.get('/api/ups/:id', (req, res) => {
    if (!HIERARCHY_CACHE) initializeHierarchy();
    const { id } = req.params;
    const ups = generateUPS(id);
    console.log(`[${new Date().toISOString()}] GET /api/ups/${id}`);
    res.json({ data: ups });
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
    const pdu = generatePDU(id);
    console.log(`[${new Date().toISOString()}] GET /api/pdu/${id}`);
    res.json({ data: pdu });
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
    const crac = generateCRAC(id);
    console.log(`[${new Date().toISOString()}] GET /api/crac/${id}`);
    res.json({ data: crac });
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
    const sensor = generateSensor(id);
    console.log(`[${new Date().toISOString()}] GET /api/sensor/${id}`);
    res.json({ data: sensor });
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
    console.log(`  GET /api/hierarchy?depth=n           - Hierarchy tree (depth limited, containers only)`);
    console.log(`  GET /api/hierarchy/:nodeId/children  - Node children (Lazy Loading, containers only)`);
    console.log(`  GET /api/hierarchy/:nodeId/assets    - All assets under node (for Table)`);
    console.log(`  GET /api/assets                      - All assets`);
    console.log(`  GET /api/assets?type=ups             - Filter by type`);
    console.log(`  GET /api/asset/:id                   - Single asset`);
    console.log(`  POST /api/assets/validate            - Batch validate`);
    console.log(`  GET /api/ups/:id                     - UPS status`);
    console.log(`  GET /api/pdu/:id                     - PDU status`);
    console.log(`  GET /api/crac/:id                    - CRAC status`);
    console.log(`  GET /api/sensor/:id                  - Sensor status`);
    console.log(`\n`);
});
