/**
 * ActionPanel - 대시보드 액션 버튼 패널
 *
 * 기능:
 * 1. "온습도현황" / "온도분포도" 탭 전환
 * 2. 온습도현황(humidity): 각 자산에 온/습도 데이터 라벨 표시 (CSS2DObject 플로팅 텍스트)
 * 3. 온도분포도(temperature): 온도 기반 히트맵 (SENSOR.TEMP, CRAC.RETURN_TEMP)
 * 4. 중심 인스턴스는 this._centerComponentName으로 지정 (ins.name 매칭, 런타임 설정)
 *
 * 속성 (런타임 설정):
 * - _centerComponentName: 히트맵 중심이 될 3D 컴포넌트의 name (ins.name)
 * - _refreshInterval: 데이터 갱신 주기 (ms, 기본 30000)
 */

const { bindEvents, makeIterator, fetchData } = Wkit;
const { applyHeatmapMixin } = HeatmapMixin;
const MC = wemb.configManager.assetMetricCodes;

// ======================
// HEATMAP PRESET (온도분포도용)
// ======================

const HEATMAP_PRESET = {
  temperatureMetrics: [MC.SENSOR.TEMP, MC.CRAC.RETURN_TEMP],
  gradient: null,
  temperatureRange: { min: 17, max: 31 },
};

// ======================
// DATA LABEL CONFIG (온습도현황용)
// ======================

const LABEL_METRICS = {
  temperature: {
    metricCodes: [MC.SENSOR.TEMP, MC.CRAC.RETURN_TEMP],
    unit: '\u00B0C',
    color: '#3b82f6',
  },
  humidity: {
    metricCodes: [MC.SENSOR.HUMIDITY, MC.CRAC.RETURN_HUMIDITY],
    unit: '%',
    color: '#22c55e',
  },
};

const LABEL_STYLE = {
  background: 'rgba(19, 21, 33, 0.88)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '8px',
  padding: '7px 14px',
  color: '#f8fafc',
  fontSize: '13px',
  fontFamily: "'Pretendard', sans-serif",
  fontWeight: '500',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  lineHeight: '1.4',
  textAlign: 'center',
};

// ======================
// PROMISE POOL (동시성 제한 유틸)
// ======================

/**
 * 최대 동시 실행 수를 제한하며 비동기 작업 배열을 실행한다.
 * 각 작업 완료 시 onSettled 콜백을 즉시 호출하여 점진적 렌더링을 지원한다.
 *
 * @param {Array<function(): Promise>} tasks - 실행할 비동기 작업 팩토리 배열
 * @param {number} concurrency - 최대 동시 실행 수
 * @param {function(*, number): void} onSettled - 각 작업 완료 시 콜백 (결과, 인덱스)
 * @returns {Promise<void>} 모든 작업 완료 시 resolve
 */
function promisePool(tasks, concurrency, onSettled) {
  if (tasks.length === 0) return Promise.resolve();

  let nextIndex = 0;
  let settledCount = 0;
  const total = tasks.length;

  return new Promise(function (resolve) {
    function runNext() {
      if (nextIndex >= total) return;
      const idx = nextIndex++;
      tasks[idx]()
        .then(function (result) {
          if (onSettled) onSettled(result, idx);
        })
        .catch(function () {
          if (onSettled) onSettled(null, idx);
        })
        .finally(function () {
          settledCount++;
          if (settledCount === total) {
            resolve();
          } else {
            runNext();
          }
        });
    }

    // 초기 동시 실행
    const initialCount = Math.min(concurrency, total);
    for (let i = 0; i < initialCount; i++) {
      runNext();
    }
  });
}

const FETCH_CONCURRENCY = 6;

initComponent.call(this);

function initComponent() {
  // ======================
  // 1. STATE
  // ======================
  this._activeModes = { humidity: false, temperature: false };
  this._centerComponentName = ''; // 히트맵 중심 3D 컴포넌트 이름 (런타임 설정)
  this._refreshInterval = 30000; // 데이터 갱신 주기 (ms)
  this._centerInstance = null; // 중심 3D 인스턴스 참조
  this._heatmapApplied = false; // heatmap mixin 적용 여부
  this._internalHandlers = {};

  // 데이터 라벨 상태
  this._dataLabels = []; // [{ instance, css2dObject }]
  this._dataRefreshId = null;

  // ======================
  // 2. CUSTOM EVENTS
  // ======================
  this.customEvents = {};
  bindEvents(this, this.customEvents);

  // ======================
  // 3. INTERNAL HANDLERS
  // ======================
  setupInternalHandlers.call(this);

  // ======================
  // 4. INITIAL STATE
  // ======================
  syncTabUI.call(this);

  console.log('[ActionPanel] Registered');
}

// ======================
// INTERNAL EVENT HANDLERS
// ======================

function setupInternalHandlers() {
  const root = this.appendElement;
  const ctx = this;

  this._internalHandlers = {
    btnClick: function (e) {
      const btn = e.target.closest('.action-btn');
      if (!btn) return;

      const action = btn.dataset.action;
      if (!action) return;

      handleTabSwitch.call(ctx, action);
    },
  };

  const panel = root.querySelector('.action-panel');
  if (panel) panel.addEventListener('click', this._internalHandlers.btnClick);
}

// ======================
// TAB SWITCH
// ======================

function handleTabSwitch(action) {
  if (this._activeModes[action]) {
    // 활성 → 비활성 (독립 토글)
    this._activeModes[action] = false;
    syncTabUI.call(this);
    deactivateMode.call(this, action);
  } else {
    // 비활성 → 활성 (다른 모드와 독립적으로 활성화)
    this._activeModes[action] = true;
    syncTabUI.call(this);
    activateMode.call(this, action);
  }
}

function deactivateMode(action) {
  if (action === 'humidity') {
    deactivateDataLabels.call(this);
  } else if (action === 'temperature') {
    deactivateHeatmap.call(this);
  }
}

function activateMode(action) {
  if (action === 'humidity') {
    activateDataLabels.call(this);
  } else if (action === 'temperature') {
    activateHeatmap.call(this);
  }
}

/**
 * 히트맵 OFF
 * - 삭제하지 않고 숨김 처리 (Stale-While-Revalidate 캐시 유지)
 */
function deactivateHeatmap() {
  if (
    this._centerInstance &&
    this._centerInstance._heatmap &&
    this._centerInstance._heatmap.visible
  ) {
    this._centerInstance._heatmap.visible = false;
  }
  stopDataTimerIfIdle.call(this);
}

function syncTabUI() {
  const root = this.appendElement;
  const btns = root.querySelectorAll('.action-btn');

  btns.forEach(
    function (btn) {
      if (this._activeModes[btn.dataset.action]) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }.bind(this)
  );
}

// ======================
// HEATMAP CONTROL (온도분포도)
// ======================

/**
 * 히트맵 활성화
 * - 최초: mixin 적용 → toggleHeatmap ON
 * - 이후: updateHeatmapConfig로 프리셋 전환
 */
function activateHeatmap() {
  if (!this._centerInstance) {
    this._centerInstance = findCenterInstance.call(this);
  }

  if (!this._centerInstance) {
    console.warn('[ActionPanel] Center instance not found:', this._centerComponentName);
    return;
  }

  if (!this._heatmapApplied) {
    const ctx = this;
    applyHeatmapMixin(
      this._centerInstance,
      Object.assign(
        {
          refreshInterval: 0, // ActionPanel 통합 타이머가 갱신 담당
          onLoadingChange: function (isLoading) {
            syncLoadingUI.call(ctx, 'temperature', isLoading);
          },
        },
        HEATMAP_PRESET
      )
    );
    this._heatmapApplied = true;
    console.log('[ActionPanel] HeatmapMixin applied to:', this._centerComponentName);

    this._centerInstance.toggleHeatmap();
  } else {
    this._centerInstance.updateHeatmapConfig(HEATMAP_PRESET);

    // Stale-While-Revalidate: 숨겨진 히트맵 즉시 복원
    if (!this._centerInstance._heatmap.visible) {
      this._centerInstance._heatmap.visible = true;
    }
  }

  // 통합 타이머 시작 (이미 실행 중이면 무시)
  ensureDataTimer.call(this);
}

// ======================
// DATA LABEL CONTROL (온습도현황)
// ======================

/**
 * 데이터 라벨 활성화
 * - 캐시(숨긴 라벨)가 있으면 즉시 복원 + 백그라운드에서 최신 데이터 갱신
 * - 캐시가 없으면 로딩 UI 표시 후 fetch
 */
function activateDataLabels() {
  const ctx = this;
  const hasCache = this._dataLabels.length > 0;

  if (hasCache) {
    // Stale-While-Revalidate: 캐시 즉시 복원
    this._dataLabels.forEach(function (entry) {
      entry.css2dObject.visible = true;
    });

    // 백그라운드에서 최신 데이터로 갱신 (로딩 UI 없음)
    fetchAndRenderLabels.call(this);
  } else {
    // 캐시 없음: 로딩 UI 표시 후 fetch
    syncLoadingUI.call(this, 'humidity', true);

    fetchAndRenderLabels.call(this, function () {
      syncLoadingUI.call(ctx, 'humidity', false);
    });
  }

  // 통합 타이머 시작 (이미 실행 중이면 무시)
  ensureDataTimer.call(this);
}

/**
 * 데이터 라벨 비활성화
 * - 삭제하지 않고 숨김 처리 (Stale-While-Revalidate 캐시 유지)
 */
function deactivateDataLabels() {
  this._dataLabels.forEach(function (entry) {
    entry.css2dObject.visible = false;
  });
  stopDataTimerIfIdle.call(this);
}

/**
 * metricCodes 배열에 매칭되는 metricCode 탐색
 */
function findMetricConfig(metrics, metricCodes) {
  for (const cfg of Object.values(metrics)) {
    if (metricCodes.includes(cfg.metricCode)) {
      return { metricCode: cfg.metricCode, scale: cfg.scale ?? 1.0 };
    }
  }
  return null;
}

/**
 * 3D 레이어 순회 → metricLatest 수집 → 라벨 생성/갱신
 * promisePool로 동시성 제한 + 응답 도착 즉시 점진적 렌더링
 */
function fetchAndRenderLabels(callback) {
  const ctx = this;
  const iter = makeIterator(this.page, 'threeLayer');
  const targets = [];

  for (const inst of iter) {
    if (!inst.appendElement || !inst.config) continue;
    if (!inst._baseUrl || !inst._defaultAssetKey) continue;

    const metrics = inst.config.statusCards?.metrics;
    if (!metrics) continue;

    // 온도 또는 습도 metricCode를 가진 인스턴스만 수집
    const tempCfg = findMetricConfig(metrics, LABEL_METRICS.temperature.metricCodes);
    const humidCfg = findMetricConfig(metrics, LABEL_METRICS.humidity.metricCodes);

    if (tempCfg || humidCfg) {
      targets.push({
        instance: inst,
        tempCfg: tempCfg,
        humidCfg: humidCfg,
      });
    }
  }

  if (targets.length === 0) {
    if (callback) callback();
    return;
  }

  // 각 대상에 대해 metricLatest 호출 (동시성 제한 + 점진적 렌더링)
  const tasks = targets.map(function (target) {
    return function () {
      return fetchData(ctx.page, 'metricLatest', {
        baseUrl: target.instance._baseUrl,
        assetKey: target.instance._defaultAssetKey,
      })
        .then(function (response) {
          const data = response?.response?.data;
          if (!data || !Array.isArray(data)) return null;

          // metricCode → value 매핑
          const metricMap = {};
          data.forEach(function (m) {
            metricMap[m.metricCode] =
              m.valueType === 'NUMBER' ? m.valueNumber : m.valueString;
          });

          // 라벨 파트 조합
          const parts = [];

          if (target.tempCfg) {
            const raw = metricMap[target.tempCfg.metricCode];
            if (raw != null) {
              parts.push({
                text: (raw * target.tempCfg.scale).toFixed(1) + LABEL_METRICS.temperature.unit,
                color: LABEL_METRICS.temperature.color,
              });
            }
          }

          if (target.humidCfg) {
            const raw = metricMap[target.humidCfg.metricCode];
            if (raw != null) {
              parts.push({
                text: (raw * target.humidCfg.scale).toFixed(1) + LABEL_METRICS.humidity.unit,
                color: LABEL_METRICS.humidity.color,
              });
            }
          }

          if (parts.length === 0) return null;

          return {
            instance: target.instance,
            parts: parts,
          };
        })
        .catch(function () {
          return null;
        });
    };
  });

  promisePool(tasks, FETCH_CONCURRENCY, function (result) {
    // 각 응답 도착 즉시 라벨 렌더링
    if (result) {
      updateOrCreateLabel.call(ctx, result.instance, result.parts);
    }
  }).then(function () {
    if (callback) callback();
  });
}

/**
 * 인스턴스에 대한 라벨 생성 또는 텍스트 업데이트
 */
function updateOrCreateLabel(inst, parts) {
  // 기존 라벨 찾기
  let existing = null;
  for (let i = 0; i < this._dataLabels.length; i++) {
    if (this._dataLabels[i].instance === inst) {
      existing = this._dataLabels[i];
      break;
    }
  }

  // 라벨 HTML 생성
  const html = parts
    .map(function (p) {
      return '<span style="color:' + p.color + '">' + p.text + '</span>';
    })
    .join('<span style="color:#666;margin:0 4px">|</span>');

  if (existing) {
    // 기존 라벨 텍스트 업데이트
    existing.css2dObject.element.innerHTML = html;
  } else {
    // 새 라벨 생성
    const labelDiv = document.createElement('div');
    labelDiv.className = 'action-data-label';
    labelDiv.innerHTML = html;

    // 스타일 적용
    Object.keys(LABEL_STYLE).forEach(function (key) {
      labelDiv.style[key] = LABEL_STYLE[key];
    });

    const css2dObject = new THREE.CSS2DObject(labelDiv);

    // 라벨 위치: 오브젝트 바운딩박스 상단 위
    const box = new THREE.Box3().setFromObject(inst.appendElement);
    const center = box.getCenter(new THREE.Vector3());
    const topY = box.max.y;

    // appendElement 기준 로컬 좌표로 변환
    const parentInverse = new THREE.Matrix4()
      .copy(inst.appendElement.matrixWorld)
      .invert();
    const labelPos = new THREE.Vector3(center.x, topY + 0.3, center.z);
    labelPos.applyMatrix4(parentInverse);

    css2dObject.position.copy(labelPos);
    inst.appendElement.add(css2dObject);

    this._dataLabels.push({
      instance: inst,
      css2dObject: css2dObject,
    });
  }
}

// ======================
// SHARED DATA REFRESH (통합 데이터 갱신)
// ======================

/**
 * 통합 타이머 시작 (어느 모드든 활성 상태일 때)
 */
function ensureDataTimer() {
  if (this._dataRefreshId) return;
  const ctx = this;
  this._dataStopped = false;
  const scheduleNext = function () {
    if (ctx._dataStopped) return;
    ctx._dataRefreshId = setTimeout(function () {
      refreshAllActiveData.call(ctx).finally(scheduleNext);
    }, ctx._refreshInterval || 30000);
  };
  scheduleNext();
}

/**
 * 모든 모드 비활성 시 타이머 정지
 */
function stopDataTimerIfIdle() {
  if (this._activeModes.humidity || this._activeModes.temperature) return;
  if (this._dataRefreshId) {
    this._dataStopped = true;
    clearTimeout(this._dataRefreshId);
    this._dataRefreshId = null;
  }
}

/**
 * 통합 데이터 갱신 콜백
 * metricLatest API를 인스턴스당 1회 호출 → 활성 모드에 분배
 * - 라벨: 응답 도착 즉시 점진적 렌더링
 * - 히트맵: 전체 포인트가 모여야 하므로 모든 fetch 완료 후 1회 갱신
 */
function refreshAllActiveData() {
  const ctx = this;
  const humidityActive = this._activeModes.humidity;
  const temperatureActive =
    this._activeModes.temperature &&
    this._centerInstance &&
    this._centerInstance._heatmap &&
    this._centerInstance._heatmap.visible;

  if (!humidityActive && !temperatureActive) return Promise.resolve();

  const iter = makeIterator(this.page, 'threeLayer');
  const targets = [];

  for (const inst of iter) {
    if (!inst.appendElement || !inst.config) continue;
    if (!inst._baseUrl || !inst._defaultAssetKey) continue;

    const metrics = inst.config.statusCards?.metrics;
    if (!metrics) continue;

    // 라벨용 메트릭 탐색 (humidity 활성 시만)
    const tempCfg = humidityActive
      ? findMetricConfig(metrics, LABEL_METRICS.temperature.metricCodes)
      : null;
    const humidCfg = humidityActive
      ? findMetricConfig(metrics, LABEL_METRICS.humidity.metricCodes)
      : null;

    // 히트맵용 메트릭 탐색 (temperature 활성 시만)
    let heatmapMetricCode = null;
    let heatmapScale = 1.0;
    if (temperatureActive) {
      for (const cfg of Object.values(metrics)) {
        if (HEATMAP_PRESET.temperatureMetrics.includes(cfg.metricCode)) {
          heatmapMetricCode = cfg.metricCode;
          heatmapScale = cfg.scale ?? 1.0;
          break;
        }
      }
    }

    if (tempCfg || humidCfg || heatmapMetricCode) {
      targets.push({
        instance: inst,
        tempCfg: tempCfg,
        humidCfg: humidCfg,
        heatmapMetricCode: heatmapMetricCode,
        heatmapScale: heatmapScale,
      });
    }
  }

  if (targets.length === 0) return Promise.resolve();

  // 히트맵 포인트를 누적할 배열 (전체 완료 후 1회 갱신)
  const pendingHeatmapPoints = [];

  const tasks = targets.map(function (target) {
    return function () {
      return fetchData(ctx.page, 'metricLatest', {
        baseUrl: target.instance._baseUrl,
        assetKey: target.instance._defaultAssetKey,
      })
        .then(function (response) {
          return { target: target, data: response?.response?.data };
        })
        .catch(function () {
          return null;
        });
    };
  });

  return promisePool(tasks, FETCH_CONCURRENCY, function (result) {
    if (!result || !result.data || !Array.isArray(result.data)) return;

    const t = result.target;
    const metricMap = {};
    result.data.forEach(function (m) {
      metricMap[m.metricCode] =
        m.valueType === 'NUMBER' ? m.valueNumber : m.valueString;
    });

    // 온습도현황 라벨: 즉시 렌더링
    if (humidityActive) {
      const parts = [];
      if (t.tempCfg) {
        const raw = metricMap[t.tempCfg.metricCode];
        if (raw != null) {
          parts.push({
            text:
              (raw * t.tempCfg.scale).toFixed(1) +
              LABEL_METRICS.temperature.unit,
            color: LABEL_METRICS.temperature.color,
          });
        }
      }
      if (t.humidCfg) {
        const raw = metricMap[t.humidCfg.metricCode];
        if (raw != null) {
          parts.push({
            text:
              (raw * t.humidCfg.scale).toFixed(1) +
              LABEL_METRICS.humidity.unit,
            color: LABEL_METRICS.humidity.color,
          });
        }
      }
      if (parts.length > 0) {
        updateOrCreateLabel.call(ctx, t.instance, parts);
      }
    }

    // 온도분포도 히트맵: 포인트 누적 (전체 완료 후 일괄 갱신)
    if (temperatureActive && t.heatmapMetricCode) {
      const tempMetric = result.data.find(function (m) {
        return m.metricCode === t.heatmapMetricCode;
      });
      if (tempMetric && tempMetric.valueNumber != null) {
        const worldPos = new THREE.Vector3();
        t.instance.appendElement.getWorldPosition(worldPos);

        pendingHeatmapPoints.push({
          worldX: worldPos.x,
          worldZ: worldPos.z,
          temperature: tempMetric.valueNumber * t.heatmapScale,
        });
      }
    }
  }).then(function () {
    // 히트맵: 모든 fetch 완료 후 1회 갱신
    if (temperatureActive && pendingHeatmapPoints.length > 0) {
      ctx._centerInstance.updateHeatmapWithData(pendingHeatmapPoints);
    }
  });
}

// ======================
// LOADING UI
// ======================

function syncLoadingUI(action, isLoading) {
  const root = this.appendElement;
  const btn = root.querySelector('.action-btn[data-action="' + action + '"]');
  if (!btn) return;

  if (isLoading) {
    btn.classList.add('loading');
  } else {
    btn.classList.remove('loading');
  }
}

// ======================
// HELPERS
// ======================

/**
 * threeLayer에서 name이 centerComponentName과 일치하는 인스턴스 검색
 */
function findCenterInstance() {
  const targetName = this._centerComponentName;
  if (!targetName) return null;

  const iter = makeIterator(this.page, 'threeLayer');

  for (const inst of iter) {
    if (inst.name === targetName) {
      return inst;
    }
  }

  return null;
}
