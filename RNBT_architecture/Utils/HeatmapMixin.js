/*
 * HeatmapMixin.js
 *
 * 3D Heatmap Surface Mixin (GPU Shader-based)
 *
 * 3D 씬에 온도 히트맵 서피스를 생성/관리하는 Mixin.
 * GPU Vertex/Fragment Shader에서 직접 히트맵을 연산하여
 * Canvas2D 기반 simpleheat를 대체. 센서 위치/온도를 uniform 배열로
 * 전달하고, 1D 그라디언트 텍스처(초기 1회 생성)로 컬러를 매핑.
 *
 * ─────────────────────────────────────────────────────────────
 * 기존 대비 개선점
 * ─────────────────────────────────────────────────────────────
 *
 * - Canvas2D drawImage() × N개 센서  → 0 draw call (GPU 연산)
 * - 픽셀 루프 (colorize + displacement) → 제거
 * - 매 프레임 2장 CanvasTexture 업로드  → uniform 값만 갱신
 * - 1D 그라디언트 텍스처: 초기 1회만 업로드
 *
 * ─────────────────────────────────────────────────────────────
 * 전제 조건
 * ─────────────────────────────────────────────────────────────
 *
 * - THREE (Three.js) 전역 접근 가능
 * - wemb.threeElements.scene 접근 가능
 * - Wkit.makeIterator, Wkit.fetchData 사용 가능
 * - applyShadowPopupMixin 이후 호출 (destroyPopup 체인 확장)
 *
 * ─────────────────────────────────────────────────────────────
 * 데이터 동기화
 * ─────────────────────────────────────────────────────────────
 *
 * 히트맵은 독립적 타이머 대신 renderStatusCards 콜백에 연동됩니다.
 * datasetInfo의 metricLatest 갱신 시 카드와 히트맵이 동시에 같은
 * 데이터로 업데이트되므로 표시값 불일치가 발생하지 않습니다.
 *
 * 팝업 소유 인스턴스: renderStatusCards 응답 캐시 사용 (API 중복 호출 없음)
 * 기타 인스턴스: 동일 시점에 metricLatest API 호출 (동시성 보장)
 *
 * ─────────────────────────────────────────────────────────────
 * 사용 예시
 * ─────────────────────────────────────────────────────────────
 *
 *   const { applyHeatmapMixin } = HeatmapMixin;
 *
 *   applyHeatmapMixin(this, {
 *       surfaceSize: 'auto',
 *       temperatureMetrics: ['SENSOR.TEMP', 'CRAC.RETURN_TEMP'],
 *   });
 *
 *   // 팝업 버튼 클릭 시:
 *   this.toggleHeatmap();
 *
 * ─────────────────────────────────────────────────────────────
 * 제공 메서드
 * ─────────────────────────────────────────────────────────────
 *
 * - toggleHeatmap()              : 히트맵 ON/OFF 토글
 * - updateHeatmapConfig(options) : 런타임 옵션 변경 (활성 시 즉시 반영)
 * - destroyHeatmap()             : 히트맵 리소스 정리 + 씬에서 제거
 *
 * ─────────────────────────────────────────────────────────────
 * 싱글톤 관리
 * ─────────────────────────────────────────────────────────────
 *
 * 동시에 하나의 히트맵만 활성화.
 * 새 히트맵 토글 시 기존 활성 히트맵 자동 제거.
 * ─────────────────────────────────────────────────────────────
 */

const HeatmapMixin = {};

// 전역 싱글톤: 현재 활성 히트맵 인스턴스
HeatmapMixin._activeInstance = null;

// ─────────────────────────────────────────────────────────────
// GPU 셰이더 상수
// ─────────────────────────────────────────────────────────────
const MAX_SENSORS = 64;

// ─────────────────────────────────────────────────────────────
// Vertex Shader (센서 기반 displacement 연산)
// ─────────────────────────────────────────────────────────────
const VERTEX_SHADER = `
  #define MAX_SENSORS ` + MAX_SENSORS + `

  uniform vec3 sensors[MAX_SENSORS];    // xy = UV 좌표, z = 정규화 온도 (0~1)
  uniform int sensorCount;
  uniform float radius;                 // UV 공간 영향 반경
  uniform float displacementScale;
  uniform float baseHeight;

  varying vec2 vUv;

  void main() {
    vUv = uv;

    // 각 센서의 가우시안 기여도 합산 → 변위량 결정
    float heat = 0.0;
    for (int i = 0; i < MAX_SENSORS; i++) {
      if (i >= sensorCount) break;
      float dist = distance(uv, sensors[i].xy);
      if (dist < radius) {
        float t = dist / radius;
        float falloff = exp(-4.5 * t * t);
        heat += falloff * sensors[i].z;
      }
    }
    heat = clamp(heat, 0.0, 1.0);

    vec3 newPosition = position;
    newPosition.z = baseHeight + heat * displacementScale;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

// ─────────────────────────────────────────────────────────────
// Fragment Shader (per-pixel 히트맵 컬러 연산)
// ─────────────────────────────────────────────────────────────
const FRAGMENT_SHADER = `
  #define MAX_SENSORS ` + MAX_SENSORS + `

  uniform vec3 sensors[MAX_SENSORS];
  uniform int sensorCount;
  uniform float radius;
  uniform sampler2D gradientMap;        // 1D 그라디언트 텍스처 (256x1)
  uniform float opacity;

  varying vec2 vUv;

  void main() {
    // per-pixel 히트값 연산 (vertex 보간보다 정밀한 컬러)
    float heat = 0.0;
    for (int i = 0; i < MAX_SENSORS; i++) {
      if (i >= sensorCount) break;
      float dist = distance(vUv, sensors[i].xy);
      if (dist < radius) {
        float t = dist / radius;
        float falloff = exp(-4.5 * t * t);
        heat += falloff * sensors[i].z;
      }
    }
    heat = clamp(heat, 0.0, 1.0);

    vec4 color = texture2D(gradientMap, vec2(heat, 0.5));

    float highlight = smoothstep(0.3, 0.8, heat) * 0.15;
    color.rgb += highlight;

    float alpha = heat > 0.01 ? opacity : 0.0;

    gl_FragColor = vec4(color.rgb, alpha);
  }
`;

// ─────────────────────────────────────────────────────────────
// 기본 그라디언트 (온도 프리셋: 17°C ~ 31°C)
// ─────────────────────────────────────────────────────────────
const DEFAULT_GRADIENT = {
  0.00: '#1068D9',  // ≤17°C 과냉
  0.29: '#4AA3DF',  // 18-21°C 정상(저온)
  0.57: '#2ECC71',  // 22-25°C 최적
  0.71: '#A3D977',  // 26-27°C 정상 상한
  0.93: '#F7A318',  // 28-30°C 경고
  1.00: '#E74C3C',  // ≥31°C 위험
};

// ─────────────────────────────────────────────────────────────
// applyHeatmapMixin
// ─────────────────────────────────────────────────────────────

HeatmapMixin.applyHeatmapMixin = function (instance, options) {
  const config = Object.assign(
    {
      surfaceSize: 'auto',
      temperatureRange: { min: 17, max: 31 },
      gradient: null,
      heatmapResolution: 256,         // radius 계산 호환용 (캔버스 미사용)
      segments: 64,
      displacementScale: 3,
      baseHeight: 2,
      radius: 'auto',
      blur: 30,
      opacity: 0.75,
      temperatureMetrics: ['SENSOR.TEMP', 'CRAC.RETURN_TEMP'],
      refreshInterval: 0, // ms, 0 = renderStatusCards 체인 사용 (기존 방식)
      onLoadingChange: null, // callback(isLoading: boolean) - 데이터 로딩 상태 알림
    },
    options
  );

  // Internal state (캔버스/simpleheat 제거 → gradientTexture만 보유)
  instance._heatmap = {
    visible: false,
    mesh: null,
    gradientTexture: null,
    surface: null,
    config: config,
    refreshTimer: null,
  };

  // ────────────────────────────────────────
  // 1D 그라디언트 텍스처 생성 (초기 1회, 재사용)
  // ────────────────────────────────────────

  function createGradientTexture(gradient) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1;

    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 256, 0);

    for (const stop in gradient) {
      grad.addColorStop(+stop, gradient[stop]);
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 1);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  // ────────────────────────────────────────
  // radius 계산 (UV 공간)
  //
  // 기존 simpleheat 호환 공식을 UV로 변환:
  //   pixel_r = resolution / sqrt(count) * 0.5
  //   clamped to [15, resolution * 0.4]
  //   총 영향 반경 = pixel_r + blur
  //   UV radius = 총 영향 반경 / resolution
  // ────────────────────────────────────────

  function computeRadiusUV(sensorCount) {
    const resolution = config.heatmapResolution;
    const blur = config.blur;
    let r;

    if (config.radius !== 'auto') {
      r = config.radius;
    } else {
      const count = Math.max(1, sensorCount);
      r = Math.round(resolution / Math.sqrt(count) * 0.5);
      r = Math.max(15, Math.min(Math.round(resolution * 0.4), r));
    }

    return (r + blur) / resolution;
  }

  // ────────────────────────────────────────
  // 서피스 크기 계산
  // 'auto': appendElement BoundingBox에서 산출
  // { width, depth }: 로컬 단위 × scale → 월드 단위
  // ────────────────────────────────────────

  function computeDynamicSurface() {
    const worldPos = new THREE.Vector3();
    instance.appendElement.getWorldPosition(worldPos);

    let width, depth;

    if (config.surfaceSize === 'auto') {
      const box = new THREE.Box3().setFromObject(instance.appendElement);
      const size = new THREE.Vector3();
      box.getSize(size);
      width = size.x;
      depth = size.z;
    } else {
      const scaleX = instance.appendElement.scale.x;
      const scaleZ = instance.appendElement.scale.z;
      width = config.surfaceSize.width * scaleX;
      depth = config.surfaceSize.depth * scaleZ;
    }

    return {
      centerX: worldPos.x,
      centerY: worldPos.y,
      centerZ: worldPos.z,
      width: width,
      depth: depth,
    };
  }

  // ────────────────────────────────────────
  // 센서 uniform 배열 초기화 (MAX_SENSORS개)
  // ────────────────────────────────────────

  function createSensorArray() {
    const arr = [];
    for (let i = 0; i < MAX_SENSORS; i++) {
      arr.push(new THREE.Vector3(0, 0, 0));
    }
    return arr;
  }

  // ────────────────────────────────────────
  // 3D Mesh 생성
  // ────────────────────────────────────────

  function createHeatmapMesh() {
    const { segments, displacementScale, baseHeight, opacity } = config;
    const { scene } = wemb.threeElements;

    // 센서 분포 기반 동적 서피스 크기 계산
    const surface = computeDynamicSurface();
    instance._heatmap.surface = surface;

    // 1D 그라디언트 텍스처 (1회 생성)
    const gradientTexture = createGradientTexture(config.gradient || DEFAULT_GRADIENT);
    instance._heatmap.gradientTexture = gradientTexture;

    // 센서 uniform 배열
    const sensorArray = createSensorArray();

    const geometry = new THREE.PlaneGeometry(
      surface.width,
      surface.depth,
      segments,
      segments
    );

    const material = new THREE.ShaderMaterial({
      uniforms: {
        sensors: { value: sensorArray },
        sensorCount: { value: 0 },
        radius: { value: 0.3 },
        gradientMap: { value: gradientTexture },
        displacementScale: { value: displacementScale },
        baseHeight: { value: baseHeight },
        opacity: { value: opacity },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;

    // appendElement의 월드 위치에 배치
    mesh.position.set(surface.centerX, surface.centerY, surface.centerZ);

    // 레이캐스팅 무시 (아래 3D 오브젝트 클릭 가능)
    mesh.raycast = function () {};

    instance._heatmap.mesh = mesh;
    scene.add(mesh);
  }

  // ────────────────────────────────────────
  // 월드좌표 → UV좌표 변환
  // ────────────────────────────────────────

  function worldToUV(worldX, worldZ, centerX, centerZ) {
    const surface = instance._heatmap.surface;
    const u = (worldX - centerX + surface.width / 2) / surface.width;
    // PlaneGeometry rotation.x = -PI/2 에 의해 v축이 worldZ와 반대 방향
    // (기존 CanvasTexture의 flipY=true가 자동 처리하던 부분)
    const v = 1.0 - (worldZ - centerZ + surface.depth / 2) / surface.depth;
    return [u, v];
  }

  // ────────────────────────────────────────
  // 센서 데이터 수집
  // ────────────────────────────────────────

  function collectSensorData() {
    const { temperatureMetrics } = config;
    const iter = Wkit.makeIterator(instance.page, 'threeLayer');
    const targets = [];

    for (const inst of iter) {
      if (!inst.appendElement || !inst.config) continue;

      // 온도 metricCode를 가진 인스턴스 탐색
      let targetMetricCode = null;
      let scale = 1.0;

      // statusCards.metrics에서 온도 관련 metricCode 찾기
      const metrics = inst.config.statusCards?.metrics;
      if (metrics) {
        for (const cfg of Object.values(metrics)) {
          if (temperatureMetrics.includes(cfg.metricCode)) {
            targetMetricCode = cfg.metricCode;
            scale = cfg.scale ?? 1.0;
            break;
          }
        }
      }

      if (targetMetricCode) {
        targets.push({
          instance: inst,
          metricCode: targetMetricCode,
          scale: scale,
        });
      }
    }

    // 각 대상에 대해 metricLatest 데이터 수집
    // - 팝업 소유 인스턴스: _cachedMetricLatest 캐시 사용 (카드와 동일 데이터)
    // - 기타 인스턴스: metricLatest API 호출
    const fetchPromises = targets.map(function (target) {
      let dataPromise;

      if (target.instance === instance && instance._cachedMetricLatest) {
        // 팝업 소유 인스턴스: renderStatusCards에서 캐싱된 응답 사용
        dataPromise = Promise.resolve(instance._cachedMetricLatest);
      } else {
        // 기타 인스턴스: API 호출
        dataPromise = Wkit.fetchData(instance.page, 'metricLatest', {
          baseUrl: target.instance._baseUrl,
          assetKey: target.instance._defaultAssetKey,
        }).then(function (response) {
          return response?.response;
        });
      }

      return dataPromise
        .then(function (responseData) {
          const data = responseData?.data;
          if (!data || !Array.isArray(data)) return null;

          const worldPos = new THREE.Vector3();
          target.instance.appendElement.getWorldPosition(worldPos);

          const tempMetric = data.find(function (m) {
            return m.metricCode === target.metricCode;
          });

          if (!tempMetric || tempMetric.valueNumber == null) return null;

          return {
            worldX: worldPos.x,
            worldZ: worldPos.z,
            temperature: tempMetric.valueNumber * target.scale,
          };
        })
        .catch(function () {
          return null;
        });
    });

    return Promise.all(fetchPromises).then(function (results) {
      return results.filter(Boolean);
    });
  }

  // ────────────────────────────────────────
  // 히트맵 렌더링 (uniform 갱신만 — 캔버스/텍스처 업로드 없음)
  // ────────────────────────────────────────

  function renderHeatmap(dataPoints) {
    const hm = instance._heatmap;
    if (!hm.mesh) return;

    // 서피스 중심 좌표 (mesh 위치 사용)
    const centerX = hm.mesh.position.x;
    const centerZ = hm.mesh.position.z;

    // 온도 정규화 (0~1)
    const min = config.temperatureRange.min;
    const max = config.temperatureRange.max;
    const range = max - min || 1;

    const uniforms = hm.mesh.material.uniforms;
    const sensorArray = uniforms.sensors.value;
    const count = Math.min(dataPoints.length, MAX_SENSORS);
    const radiusUV = computeRadiusUV(count);

    // 센서 데이터 → uniform 배열 갱신
    for (let i = 0; i < count; i++) {
      const point = dataPoints[i];
      const uv = worldToUV(point.worldX, point.worldZ, centerX, centerZ);
      const normalized = Math.max(0.05, Math.min(1, (point.temperature - min) / range));
      sensorArray[i].set(uv[0], uv[1], normalized);
    }

    // 미사용 슬롯 초기화 (이전 프레임 잔여 데이터 제거)
    for (let j = count; j < MAX_SENSORS; j++) {
      sensorArray[j].set(0, 0, 0);
    }

    uniforms.sensorCount.value = count;
    uniforms.radius.value = radiusUV;
  }

  // ────────────────────────────────────────
  // 히트맵 데이터 갱신
  // renderStatusCards 체인 또는 독립 타이머에서 트리거
  // ────────────────────────────────────────

  function refreshHeatmapData() {
    if (!instance._heatmap.visible || !instance._heatmap.mesh) return;

    collectSensorData().then(function (dataPoints) {
      if (!instance._heatmap.visible || !instance._heatmap.mesh) return;
      if (dataPoints.length > 0) {
        renderHeatmap(dataPoints);
      }
    });
  }

  // ────────────────────────────────────────
  // Public: updateHeatmapWithData
  // 외부에서 수집한 데이터로 히트맵 갱신 (API 중복 호출 방지)
  // ────────────────────────────────────────

  instance.updateHeatmapWithData = function (dataPoints) {
    if (!instance._heatmap.visible || !instance._heatmap.mesh) return;
    if (dataPoints.length > 0) {
      renderHeatmap(dataPoints);
    }
  };

  // ────────────────────────────────────────
  // 독립 타이머 (refreshInterval > 0일 때 사용)
  // ────────────────────────────────────────

  function startRefreshTimer() {
    stopRefreshTimer();
    if (config.refreshInterval > 0) {
      instance._heatmap.refreshTimer = setInterval(function () {
        refreshHeatmapData();
      }, config.refreshInterval);
    }
  }

  function stopRefreshTimer() {
    if (instance._heatmap.refreshTimer) {
      clearInterval(instance._heatmap.refreshTimer);
      instance._heatmap.refreshTimer = null;
    }
  }

  // ────────────────────────────────────────
  // 버튼 active 상태 동기화
  // ────────────────────────────────────────

  function syncButtonState(active) {
    const btn = instance.popupQuery?.('.heatmap-btn');
    if (btn) {
      btn.dataset.active = active ? 'true' : 'false';
    }
  }

  function notifyLoading(isLoading) {
    if (typeof config.onLoadingChange === 'function') {
      config.onLoadingChange(isLoading);
    }
  }

  // ────────────────────────────────────────
  // Public: toggleHeatmap
  // ────────────────────────────────────────

  instance.toggleHeatmap = function () {
    if (instance._heatmap.visible) {
      // OFF
      instance.destroyHeatmap();
      syncButtonState(false);
    } else {
      // 기존 활성 히트맵 제거 (싱글톤)
      if (HeatmapMixin._activeInstance && HeatmapMixin._activeInstance !== instance) {
        HeatmapMixin._activeInstance.destroyHeatmap();
        const prevBtn = HeatmapMixin._activeInstance.popupQuery?.('.heatmap-btn');
        if (prevBtn) prevBtn.dataset.active = 'false';
      }

      // ON: mesh 생성 → 데이터 수집 → 렌더링
      createHeatmapMesh();
      instance._heatmap.visible = true;
      HeatmapMixin._activeInstance = instance;
      syncButtonState(true);
      notifyLoading(true);

      collectSensorData().then(function (dataPoints) {
        notifyLoading(false);
        if (!instance._heatmap.visible || !instance._heatmap.mesh) return;
        if (dataPoints.length > 0) {
          renderHeatmap(dataPoints);
        } else {
          console.warn('[HeatmapMixin] No sensor data collected');
        }
        startRefreshTimer();
      });
    }
  };

  // ────────────────────────────────────────
  // Public: updateHeatmapConfig
  // ────────────────────────────────────────

  const UNIFORM_KEYS = ['displacementScale', 'baseHeight', 'opacity'];

  instance.updateHeatmapConfig = function (newOptions) {
    Object.assign(config, newOptions);

    if (!instance._heatmap.visible) return;

    const hm = instance._heatmap;

    const effectKeys = Object.keys(newOptions);
    if (effectKeys.length === 0) return;

    const onlyUniforms = effectKeys.every(function (key) {
      return UNIFORM_KEYS.indexOf(key) !== -1;
    });

    if (onlyUniforms && hm.mesh) {
      // Hot update: 셰이더 uniform만 즉시 반영
      const uniforms = hm.mesh.material.uniforms;
      if (newOptions.displacementScale !== undefined) uniforms.displacementScale.value = newOptions.displacementScale;
      if (newOptions.baseHeight !== undefined) uniforms.baseHeight.value = newOptions.baseHeight;
      if (newOptions.opacity !== undefined) uniforms.opacity.value = newOptions.opacity;
    } else {
      // Full rebuild: destroy → 재생성 → 데이터 재수집
      instance.destroyHeatmap();
      createHeatmapMesh();
      instance._heatmap.visible = true;
      HeatmapMixin._activeInstance = instance;
      syncButtonState(true);
      notifyLoading(true);

      collectSensorData().then(function (dataPoints) {
        notifyLoading(false);
        if (!instance._heatmap.visible || !instance._heatmap.mesh) return;
        if (dataPoints.length > 0) {
          renderHeatmap(dataPoints);
        }
        startRefreshTimer();
      });
    }
  };

  // ────────────────────────────────────────
  // Public: destroyHeatmap
  // ────────────────────────────────────────

  instance.destroyHeatmap = function () {
    stopRefreshTimer();

    const hm = instance._heatmap;

    if (hm.mesh) {
      const scene = wemb.threeElements.scene;

      // geometry dispose
      if (hm.mesh.geometry) hm.mesh.geometry.dispose();

      // material dispose
      if (hm.mesh.material) hm.mesh.material.dispose();

      scene.remove(hm.mesh);
      hm.mesh = null;
    }

    // 그라디언트 텍스처 dispose
    if (hm.gradientTexture) {
      hm.gradientTexture.dispose();
      hm.gradientTexture = null;
    }

    hm.surface = null;
    hm.visible = false;
    instance._cachedMetricLatest = null;

    if (HeatmapMixin._activeInstance === instance) {
      HeatmapMixin._activeInstance = null;
    }
  };

  // ────────────────────────────────────────
  // renderStatusCards 체인 확장
  // (카드 데이터와 히트맵 데이터 동기화)
  // ────────────────────────────────────────

  if (instance.renderStatusCards) {
    const originalRenderStatusCards = instance.renderStatusCards;
    instance.renderStatusCards = function (responseData) {
      // 원본 카드 렌더링 먼저 실행
      originalRenderStatusCards.call(instance, responseData);

      // metricLatest 응답 캐싱 (collectSensorData에서 재사용)
      instance._cachedMetricLatest = responseData.response;

      // 히트맵 활성 시 동기 갱신 트리거
      if (instance._heatmap && instance._heatmap.visible && instance._heatmap.mesh) {
        refreshHeatmapData();
      }
    };
  }

  // ────────────────────────────────────────
  // destroyPopup 체인 확장
  // ────────────────────────────────────────

  if (instance.destroyPopup) {
    const originalDestroyPopup = instance.destroyPopup;
    instance.destroyPopup = function () {
      instance.destroyHeatmap();
      originalDestroyPopup.call(instance);
    };
  }
};
