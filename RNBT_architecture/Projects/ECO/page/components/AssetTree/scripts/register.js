/**
 * AssetTree - 배치된 3D 장비의 위치 계층 트리 컴포넌트
 *
 * 기능:
 * 1. threeLayer에서 배치된 3D 인스턴스 수집
 * 2. assetList + relationList API로 자산 정보 및 관계(LOCATED_IN) 동적 조회
 * 3. 관계 데이터에서 부모 체인을 따라 ancestorKeys 동적 구성
 * 4. Building → Floor → Room → Equipment 트리 렌더링
 * 5. 장비 노드 클릭 시 해당 3D 인스턴스의 showDetail() 호출
 */

const { bindEvents, fetchData, makeIterator } = Wkit;

initComponent.call(this);

function initComponent() {
  // ======================
  // 1. STATE
  // ======================
  this._baseUrl = wemb.configManager.assetApiUrl.replace(/^https?:\/\//, '');
  this._assetCache = new Map();      // assetKey → { name, assetType, statusType }
  this._treeData = [];               // 렌더링용 트리 구조
  this._instanceMap = new Map();     // assetKey → 3D instance 참조 (클릭용)
  this._expandedNodes = new Set();
  this._searchTerm = '';
  this._internalHandlers = {};
  this._cameraAnim = null; // 진행 중인 카메라 애니메이션 참조

  // ======================
  // 2. BINDINGS
  // ======================
  this.collectAndBuild = collectAndBuild.bind(this);
  this.renderTree = renderTree.bind(this);

  // ======================
  // 3. CUSTOM EVENTS
  // ======================
  this.customEvents = {
    click: {
      '.refresh-btn': '@refreshClicked',
    },
  };
  bindEvents(this, this.customEvents);

  // ======================
  // 4. INTERNAL HANDLERS
  // ======================
  setupInternalHandlers.call(this);

  // ======================
  // 5. INITIAL DATA COLLECTION
  // ======================
  this.collectAndBuild();

  console.log('[AssetTree] Registered');
}

// ======================
// DATA COLLECTION + TREE BUILD
// ======================

/**
 * 3D 인스턴스 수집 → assetList + relationList API 조회 → 트리 빌드
 */
async function collectAndBuild() {
  const root = this.appendElement;
  const emptyEl = root.querySelector('.tree-empty');
  const containerEl = root.querySelector('.tree-container');

  // 1. threeLayer에서 배치된 3D 인스턴스 수집
  const iter = makeIterator(this.page, 'threeLayer');
  const placedItems = [];      // { assetKey, instance }

  for (const inst of iter) {
    const assetInfo = inst.setter?.assetInfo;
    if (!assetInfo || !assetInfo.assetKey) continue;

    placedItems.push({ assetKey: assetInfo.assetKey, instance: inst });
    this._instanceMap.set(assetInfo.assetKey, inst);
  }

  console.log('[AssetTree] Placed items:', placedItems.length);

  // 배치된 장비 없음
  if (placedItems.length === 0) {
    this._treeData = [];
    if (emptyEl) emptyEl.hidden = false;
    if (containerEl) containerEl.style.display = 'none';
    return;
  }

  if (emptyEl) emptyEl.hidden = true;
  if (containerEl) containerEl.style.display = '';

  // 2. assetList + relationList API 동시 호출
  let parentMap;

  try {
    const results = await Promise.all([
      fetchData(this.page, 'assetList', { baseUrl: this._baseUrl }),
      fetchData(this.page, 'relationList', {
        baseUrl: this._baseUrl,
      }),
    ]);

    // 자산 캐시
    const assets = results[0]?.response?.data || [];
    assets.forEach((asset) => {
      this._assetCache.set(asset.assetKey, {
        name: asset.name,
        assetType: asset.assetType,
        statusType: asset.statusType,
      });
    });

    // 관계 처리: parentMap (childKey → parentKey)
    const relations = results[1]?.response?.data || [];
    parentMap = new Map();
    relations.forEach((rel) => {
      parentMap.set(rel.fromAssetKey, rel.toAssetKey);
    });

    console.log('[AssetTree] Assets:', this._assetCache.size, '/ Relations:', relations.length);
  } catch (error) {
    console.error('[AssetTree] Failed to fetch data:', error);
    return;
  }

  // 3. 각 배치 장비의 ancestorKeys를 관계 데이터에서 동적 구성
  const enrichedItems = placedItems.map((item) => {
    const ancestorKeys = buildAncestorKeys(item.assetKey, parentMap);
    const cached = this._assetCache.get(item.assetKey);

    return {
      assetKey: item.assetKey,
      name: cached?.name || item.assetKey,
      assetType: cached?.assetType || 'EQUIPMENT',
      statusType: cached?.statusType || 'ACTIVE',
      ancestorKeys,
      instance: item.instance,
    };
  });

  // 4. 트리 빌드
  buildTree.call(this, enrichedItems);
}

/**
 * 관계 데이터에서 부모 체인을 따라 올라가며 ancestorKeys 배열 구성
 * 결과: [root, ..., directParent] (top → bottom 순서)
 */
function buildAncestorKeys(assetKey, parentMap) {
  const ancestors = [];
  let current = assetKey;
  const visited = new Set(); // 순환 참조 방지

  while (parentMap.has(current)) {
    const parent = parentMap.get(current);
    if (visited.has(parent)) break;
    visited.add(parent);
    ancestors.unshift(parent);
    current = parent;
  }

  return ancestors;
}

// ======================
// TREE BUILD
// ======================

/**
 * ancestorKeys를 사용하여 트리 구조 조립
 *
 * 각 배치 인스턴스의 경로:
 *   [...ancestorKeys, assetKey]
 *   예: ['building-001', 'floor-001', 'room-001', 'ups-001']
 *
 * 트리 노드 구조:
 *   { assetKey, name, assetType, statusType, isPlaced, children: [] }
 */
function buildTree(placedItems) {
  const rootMap = new Map(); // assetKey → node (루트 레벨)

  placedItems.forEach(({ assetKey, ancestorKeys }) => {
    const path = [...ancestorKeys, assetKey];
    let currentLevel = rootMap;

    path.forEach((key) => {
      if (!currentLevel.has(key)) {
        const cached = this._assetCache.get(key);
        const isPlaced = this._instanceMap.has(key);

        currentLevel.set(key, {
          assetKey: key,
          name: cached?.name || key,
          assetType: cached?.assetType || (isPlaced ? 'EQUIPMENT' : 'LOCATION'),
          statusType: cached?.statusType || 'ACTIVE',
          isPlaced,
          children: new Map(),
        });
      } else if (this._instanceMap.has(key)) {
        // 이미 ancestor로 생성된 노드가 실제 배치 자산이면 플래그 갱신
        currentLevel.get(key).isPlaced = true;
      }

      currentLevel = currentLevel.get(key).children;
    });
  });

  // Map → Array 변환 (재귀)
  function mapToArray(nodeMap) {
    const arr = [];
    nodeMap.forEach((node) => {
      const childArray = mapToArray(node.children);
      arr.push({
        assetKey: node.assetKey,
        name: node.name,
        assetType: node.assetType,
        statusType: node.statusType,
        isPlaced: node.isPlaced,
        children: childArray,
      });
    });
    // 이름순 정렬
    arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }

  this._treeData = mapToArray(rootMap);
  console.log('[AssetTree] Tree built:', this._treeData.length, 'root nodes');

  this.renderTree();
}

// ======================
// INTERNAL EVENT HANDLERS
// ======================

function setupInternalHandlers() {
  const root = this.appendElement;
  const ctx = this;

  this._internalHandlers = {
    treeClick: (e) => handleTreeClick.call(ctx, e),
    treeDblClick: (e) => handleTreeDblClick.call(ctx, e),
    searchInput: (e) => {
      ctx._searchTerm = e.target.value;
      ctx.renderTree();
    },
    refreshClick: () => {
      ctx._assetCache.clear();
      ctx._instanceMap.clear();
      ctx._expandedNodes.clear();
      ctx._treeData = [];
      ctx.collectAndBuild();
    },
  };

  const treeContainer = root.querySelector('.tree-container');
  if (treeContainer) treeContainer.addEventListener('click', this._internalHandlers.treeClick);
  if (treeContainer) treeContainer.addEventListener('dblclick', this._internalHandlers.treeDblClick);

  const searchInput = root.querySelector('.tree-search-input');
  if (searchInput) searchInput.addEventListener('input', this._internalHandlers.searchInput);

  const refreshBtn = root.querySelector('.refresh-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', this._internalHandlers.refreshClick);
}

function handleTreeClick(e) {
  const nodeContent = e.target.closest('.node-content');
  if (!nodeContent) return;

  const nodeEl = nodeContent.closest('.tree-node');
  if (!nodeEl) return;

  const assetKey = nodeEl.dataset.nodeId;
  toggleNode.call(this, assetKey);
}

function handleTreeDblClick(e) {
  const nodeContent = e.target.closest('.node-content');
  if (!nodeContent) return;

  const nodeEl = nodeContent.closest('.tree-node');
  if (!nodeEl) return;

  if (nodeEl.dataset.isPlaced !== 'true') return;

  const assetKey = nodeEl.dataset.nodeId;
  handleEquipmentClick.call(this, assetKey);
}

function handleEquipmentClick(assetKey) {
  const inst = this._instanceMap.get(assetKey);
  if (!inst || !inst.appendElement) {
    console.warn('[AssetTree] No 3D instance for:', assetKey);
    return;
  }
  focusCameraOnAsset.call(this, inst);
}

/**
 * anime.js로 카메라를 타겟 3D 인스턴스로 이동
 */
function focusCameraOnAsset(inst) {
  const camera = wemb.threeElements.camera;
  const controls = wemb.threeElements.mainControls;

  // 타겟 월드 좌표
  const targetPos = new THREE.Vector3();
  inst.appendElement.getWorldPosition(targetPos);

  // 바운딩박스로 적절한 시야 거리 계산
  const box = new THREE.Box3().setFromObject(inst.appendElement);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const viewDist = Math.max(maxDim * 3, 2); // 최소 거리 2

  // 현재 카메라 방향 유지하되 타겟으로 접근
  const dir = new THREE.Vector3()
    .subVectors(camera.position, controls.target)
    .normalize();
  const cameraPos = targetPos.clone().add(dir.multiplyScalar(viewDist));

  // 현재 상태 저장
  const startCamPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const tweenObj = { t: 0 };

  // 진행 중인 애니메이션 취소
  if (this._cameraAnim) {
    this._cameraAnim.pause();
    this._cameraAnim = null;
  }

  this._cameraAnim = anime.animate(tweenObj, {
    t: 1,
    duration: 800,
    ease: 'inOutQuad',
    onUpdate: function () {
      camera.position.lerpVectors(startCamPos, cameraPos, tweenObj.t);
      controls.target.lerpVectors(startTarget, targetPos, tweenObj.t);
    },
    onComplete: function () {
      console.log('[AssetTree] Camera focused on:', inst._defaultAssetKey || '');
    },
  });
}

function toggleNode(assetKey) {
  if (this._expandedNodes.has(assetKey)) {
    this._expandedNodes.delete(assetKey);
  } else {
    this._expandedNodes.add(assetKey);
  }

  // 부분 업데이트: 해당 노드의 toggle/children만 변경
  const nodeEl = this.appendElement.querySelector(`[data-node-id="${assetKey}"]`);
  if (!nodeEl) return;

  const toggle = nodeEl.querySelector(':scope > .node-content > .node-toggle');
  const children = nodeEl.querySelector(':scope > .node-children');
  const isExpanded = this._expandedNodes.has(assetKey);

  if (toggle) toggle.classList.toggle('expanded', isExpanded);
  if (children) children.classList.toggle('expanded', isExpanded);
}

// ======================
// TREE RENDER
// ======================

function renderTree() {
  const rootEl = this.appendElement.querySelector('.tree-root');
  if (!rootEl) return;

  rootEl.innerHTML = '';
  const searchTerm = this._searchTerm.toLowerCase().trim();

  this._treeData.forEach((item) => {
    const nodeEl = createTreeNode.call(this, item, searchTerm);
    if (nodeEl) rootEl.appendChild(nodeEl);
  });
}

function createTreeNode(item, searchTerm) {
  const { assetKey, assetType, statusType, name, isPlaced, children = [] } = item;
  const hasChildren = children.length > 0;
  const isExpanded = this._expandedNodes.has(assetKey);

  // 검색 필터
  const matchesSearch = !searchTerm || name.toLowerCase().includes(searchTerm);
  const hasMatchingDescendants = hasChildren && checkDescendants(children, searchTerm);

  if (searchTerm && !matchesSearch && !hasMatchingDescendants) {
    return null;
  }

  const li = document.createElement('li');
  li.className = 'tree-node';
  li.dataset.nodeId = assetKey;
  li.dataset.isPlaced = isPlaced;

  // Node Content
  const content = document.createElement('div');
  content.className = 'node-content';
  if (isPlaced) content.classList.add('placed');

  // Toggle
  const toggle = document.createElement('span');
  toggle.className = 'node-toggle';
  if (hasChildren) {
    if (isExpanded || (searchTerm && hasMatchingDescendants)) toggle.classList.add('expanded');
  } else {
    toggle.classList.add('leaf');
  }

  // Icon
  const icon = document.createElement('span');
  icon.className = 'node-icon';
  icon.dataset.type = assetType.toLowerCase();

  // Label
  const label = document.createElement('span');
  label.className = 'node-label';
  label.textContent = name;

  content.appendChild(toggle);
  content.appendChild(icon);
  content.appendChild(label);

  // Child Count (컨테이너 노드만)
  if (hasChildren) {
    const count = document.createElement('span');
    count.className = 'node-child-count';
    count.textContent = `(${children.length})`;
    content.appendChild(count);
  }

  // Status Dot
  const statusDot = document.createElement('span');
  statusDot.className = `node-status ${statusTypeToDataAttr(statusType)}`;
  content.appendChild(statusDot);

  li.appendChild(content);

  // Children
  if (hasChildren) {
    const childrenUl = document.createElement('ul');
    childrenUl.className = 'node-children';
    if (isExpanded || (searchTerm && hasMatchingDescendants)) {
      childrenUl.classList.add('expanded');
    }

    children.forEach((child) => {
      const childEl = createTreeNode.call(this, child, searchTerm);
      if (childEl) childrenUl.appendChild(childEl);
    });

    li.appendChild(childrenUl);
  }

  return li;
}

function checkDescendants(children, searchTerm) {
  if (!searchTerm) return false;
  return children.some((child) => {
    if (child.name.toLowerCase().includes(searchTerm)) return true;
    return child.children && checkDescendants(child.children, searchTerm);
  });
}

// ======================
// HELPERS
// ======================

function statusTypeToDataAttr(statusType) {
  const map = {
    ACTIVE: 'normal',
    WARNING: 'warning',
    CRITICAL: 'critical',
    INACTIVE: 'inactive',
    MAINTENANCE: 'maintenance',
  };
  return map[statusType] || 'normal';
}
