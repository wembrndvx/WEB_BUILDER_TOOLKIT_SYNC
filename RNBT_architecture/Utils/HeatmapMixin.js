/*
 * HeatmapMixin.js
 *
 * 3D Heatmap Surface Mixin
 *
 * 3D 씬에 온도 히트맵 서피스를 생성/관리하는 Mixin.
 * simpleheat로 2D 히트맵을 생성하고, THREE.ShaderMaterial로
 * displacement + color 텍스처를 적용한 3D PlaneGeometry를 씬에 추가.
 *
 * ─────────────────────────────────────────────────────────────
 * 전제 조건
 * ─────────────────────────────────────────────────────────────
 *
 * - THREE (Three.js) 전역 접근 가능
 * - wemb.threeElements.scene 접근 가능
 * - simpleheat는 내부에 인라인 포함 (외부 의존성 없음)
 * - Wkit.makeIterator, Wkit.fetchData 사용 가능
 * - applyShadowPopupMixin 이후 호출 (destroyPopup 체인 확장)
 *
 * ─────────────────────────────────────────────────────────────
 * 사용 예시
 * ─────────────────────────────────────────────────────────────
 *
 *   const { applyHeatmapMixin } = HeatmapMixin;
 *
 *   applyHeatmapMixin(this, {
 *       surfaceSize: { width: 20, depth: 20 },
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
// simpleheat (인라인 포함)
// https://github.com/mourner/simpleheat
// ─────────────────────────────────────────────────────────────

function simpleheat(canvas) {
  if (!(this instanceof simpleheat)) return new simpleheat(canvas);
  this._canvas = canvas = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
  this._ctx = canvas.getContext('2d');
  this._width = canvas.width;
  this._height = canvas.height;
  this._max = 1;
  this._data = [];
}

simpleheat.prototype = {
  defaultRadius: 25,
  defaultGradient: {
    0.4: 'blue',
    0.6: 'cyan',
    0.7: 'lime',
    0.8: 'yellow',
    1.0: 'red',
  },

  data: function (data) { this._data = data; return this; },
  max: function (max) { this._max = max; return this; },
  add: function (point) { this._data.push(point); return this; },
  clear: function () { this._data = []; return this; },

  radius: function (r, blur) {
    blur = blur === undefined ? 15 : blur;
    var circle = this._circle = this._createCanvas();
    var ctx = circle.getContext('2d');
    var r2 = this._r = r + blur;

    circle.width = circle.height = r2 * 2;
    ctx.shadowOffsetX = ctx.shadowOffsetY = r2 * 2;
    ctx.shadowBlur = blur;
    ctx.shadowColor = 'black';

    ctx.beginPath();
    ctx.arc(-r2, -r2, r, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();

    return this;
  },

  resize: function () {
    this._width = this._canvas.width;
    this._height = this._canvas.height;
  },

  gradient: function (grad) {
    var canvas = this._createCanvas();
    var ctx = canvas.getContext('2d');
    var gradient = ctx.createLinearGradient(0, 0, 0, 256);

    canvas.width = 1;
    canvas.height = 256;

    for (var i in grad) {
      gradient.addColorStop(+i, grad[i]);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1, 256);

    this._grad = ctx.getImageData(0, 0, 1, 256).data;
    return this;
  },

  draw: function (minOpacity) {
    if (!this._circle) this.radius(this.defaultRadius);
    if (!this._grad) this.gradient(this.defaultGradient);

    var ctx = this._ctx;
    ctx.clearRect(0, 0, this._width, this._height);

    for (var i = 0, len = this._data.length; i < len; i++) {
      var p = this._data[i];
      ctx.globalAlpha = Math.min(Math.max(p[2] / this._max, minOpacity === undefined ? 0.05 : minOpacity), 1);
      ctx.drawImage(this._circle, p[0] - this._r, p[1] - this._r);
    }

    var colored = ctx.getImageData(0, 0, this._width, this._height);
    this._colorize(colored.data, this._grad);
    ctx.putImageData(colored, 0, 0);

    return this;
  },

  _colorize: function (pixels, gradient) {
    for (var i = 0, len = pixels.length; i < len; i += 4) {
      var j = pixels[i + 3] * 4;
      if (j) {
        pixels[i] = gradient[j];
        pixels[i + 1] = gradient[j + 1];
        pixels[i + 2] = gradient[j + 2];
      }
    }
  },

  _createCanvas: function () {
    if (typeof document !== 'undefined') {
      return document.createElement('canvas');
    }
  },
};

// ─────────────────────────────────────────────────────────────
// Vertex Shader
// ─────────────────────────────────────────────────────────────
const VERTEX_SHADER = `
  uniform sampler2D displacementMap;
  uniform float displacementScale;
  uniform float baseHeight;

  varying vec2 vUv;
  varying float vDisplacement;

  void main() {
    vUv = uv;

    vec4 dispColor = texture2D(displacementMap, uv);
    float displacement = dispColor.r * displacementScale;
    vDisplacement = displacement;

    vec3 newPosition = position;
    newPosition.z = baseHeight + displacement;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

// ─────────────────────────────────────────────────────────────
// Fragment Shader
// ─────────────────────────────────────────────────────────────
const FRAGMENT_SHADER = `
  uniform sampler2D colorMap;
  uniform float opacity;

  varying vec2 vUv;
  varying float vDisplacement;

  void main() {
    vec4 color = texture2D(colorMap, vUv);

    float highlight = smoothstep(0.3, 0.8, vDisplacement / 4.0) * 0.15;
    color.rgb += highlight;

    float alpha = color.a > 0.1 ? opacity : 0.0;

    gl_FragColor = vec4(color.rgb, alpha);
  }
`;

// ─────────────────────────────────────────────────────────────
// 기본 그라디언트 (18°C ~ 30°C)
// ─────────────────────────────────────────────────────────────
const DEFAULT_GRADIENT = {
  0.0: '#0044ff',
  0.2: '#00aaff',
  0.4: '#00ffaa',
  0.6: '#aaff00',
  0.8: '#ffaa00',
  1.0: '#ff0000',
};

// ─────────────────────────────────────────────────────────────
// applyHeatmapMixin
// ─────────────────────────────────────────────────────────────

HeatmapMixin.applyHeatmapMixin = function (instance, options) {
  const config = Object.assign(
    {
      surfaceSize: { width: 20, depth: 20 },
      temperatureRange: { min: 18, max: 30 },
      heatmapResolution: 256,
      segments: 64,
      displacementScale: 3,
      baseHeight: 0.5,
      radius: 60,
      blur: 25,
      opacity: 0.75,
      temperatureMetrics: ['SENSOR.TEMP', 'CRAC.RETURN_TEMP'],
    },
    options
  );

  // Internal state
  instance._heatmap = {
    visible: false,
    mesh: null,
    colorCanvas: null,
    displacementCanvas: null,
    heat: null,
    colorTexture: null,
    displacementTexture: null,
    config: config,
  };

  // ────────────────────────────────────────
  // 숨겨진 캔버스 + simpleheat 초기화
  // ────────────────────────────────────────

  function initHeatmapCanvas() {
    const { heatmapResolution, radius, blur, temperatureRange } = config;

    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = heatmapResolution;
    colorCanvas.height = heatmapResolution;

    const displacementCanvas = document.createElement('canvas');
    displacementCanvas.width = heatmapResolution;
    displacementCanvas.height = heatmapResolution;

    const heat = simpleheat(colorCanvas);
    heat.radius(radius, blur);
    heat.max(temperatureRange.max);
    heat.gradient(DEFAULT_GRADIENT);

    instance._heatmap.colorCanvas = colorCanvas;
    instance._heatmap.displacementCanvas = displacementCanvas;
    instance._heatmap.heat = heat;
  }

  // ────────────────────────────────────────
  // 3D Mesh 생성
  // ────────────────────────────────────────

  function createHeatmapMesh() {
    const { surfaceSize, segments, displacementScale, baseHeight, opacity } = config;
    const { scene } = wemb.threeElements;

    initHeatmapCanvas();

    const colorTexture = new THREE.CanvasTexture(instance._heatmap.colorCanvas);
    const displacementTexture = new THREE.CanvasTexture(instance._heatmap.displacementCanvas);

    instance._heatmap.colorTexture = colorTexture;
    instance._heatmap.displacementTexture = displacementTexture;

    const geometry = new THREE.PlaneGeometry(
      surfaceSize.width,
      surfaceSize.depth,
      segments,
      segments
    );

    const material = new THREE.ShaderMaterial({
      uniforms: {
        colorMap: { value: colorTexture },
        displacementMap: { value: displacementTexture },
        displacementScale: { value: displacementScale },
        opacity: { value: opacity },
        baseHeight: { value: baseHeight },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;

    // 컴포넌트 위치에 배치
    const worldPos = new THREE.Vector3();
    instance.appendElement.getWorldPosition(worldPos);
    mesh.position.set(worldPos.x, 0, worldPos.z);

    // 레이캐스팅 무시 (아래 3D 오브젝트 클릭 가능)
    mesh.raycast = function () {};

    instance._heatmap.mesh = mesh;
    scene.add(mesh);
  }

  // ────────────────────────────────────────
  // 월드좌표 → 캔버스좌표 변환
  // ────────────────────────────────────────

  function worldToCanvas(worldX, worldZ, centerX, centerZ) {
    const { surfaceSize, heatmapResolution } = config;
    const halfW = surfaceSize.width / 2;
    const halfD = surfaceSize.depth / 2;

    const canvasX = ((worldX - centerX + halfW) / surfaceSize.width) * heatmapResolution;
    const canvasY = ((worldZ - centerZ + halfD) / surfaceSize.depth) * heatmapResolution;
    return [canvasX, canvasY];
  }

  // ────────────────────────────────────────
  // Displacement 맵 생성 (컬러 → grayscale)
  // ────────────────────────────────────────

  function generateDisplacementMap() {
    const hm = instance._heatmap;
    const colorCtx = hm.colorCanvas.getContext('2d');
    const dispCtx = hm.displacementCanvas.getContext('2d');
    const w = hm.colorCanvas.width;
    const h = hm.colorCanvas.height;

    const colorData = colorCtx.getImageData(0, 0, w, h);
    const dispImageData = dispCtx.createImageData(w, h);

    for (let i = 0; i < colorData.data.length; i += 4) {
      const r = colorData.data[i];
      const g = colorData.data[i + 1];
      const b = colorData.data[i + 2];
      const a = colorData.data[i + 3];

      const intensity = a / 255;
      const heatValue = (r * 0.5 + g * 0.3 - b * 0.2) / 255;
      const displacement = Math.max(0, Math.min(1, intensity * (0.3 + heatValue * 0.7)));

      const gray = Math.floor(displacement * 255);
      dispImageData.data[i] = gray;
      dispImageData.data[i + 1] = gray;
      dispImageData.data[i + 2] = gray;
      dispImageData.data[i + 3] = 255;
    }

    dispCtx.putImageData(dispImageData, 0, 0);
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

    // 각 대상에 대해 metricLatest fetch
    const fetchPromises = targets.map(function (target) {
      return Wkit.fetchData(instance.page, 'metricLatest', {
        baseUrl: target.instance._baseUrl,
        assetKey: target.instance._defaultAssetKey,
      })
        .then(function (response) {
          const data = response?.response?.data;
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
  // 히트맵 렌더링
  // ────────────────────────────────────────

  function renderHeatmap(dataPoints) {
    const hm = instance._heatmap;
    if (!hm.mesh || !hm.heat) return;

    // 서피스 중심 좌표
    const centerX = hm.mesh.position.x;
    const centerZ = hm.mesh.position.z;

    // 월드좌표 → 캔버스좌표 변환
    const canvasData = dataPoints.map(function (point) {
      const coords = worldToCanvas(point.worldX, point.worldZ, centerX, centerZ);
      return [coords[0], coords[1], point.temperature];
    });

    // simpleheat 렌더링
    hm.heat.clear();
    hm.heat.data(canvasData);
    hm.heat.draw(0.05);

    // displacement 맵 생성
    generateDisplacementMap();

    // 텍스처 업데이트
    hm.colorTexture.needsUpdate = true;
    hm.displacementTexture.needsUpdate = true;
  }

  // ────────────────────────────────────────
  // 버튼 active 상태 동기화
  // ────────────────────────────────────────

  function syncButtonState(active) {
    var btn = instance.popupQuery?.('.heatmap-btn');
    if (btn) {
      btn.dataset.active = active ? 'true' : 'false';
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
        // 이전 인스턴스의 버튼 상태도 업데이트
        var prevBtn = HeatmapMixin._activeInstance.popupQuery?.('.heatmap-btn');
        if (prevBtn) prevBtn.dataset.active = 'false';
      }

      // ON
      createHeatmapMesh();
      instance._heatmap.visible = true;
      HeatmapMixin._activeInstance = instance;
      syncButtonState(true);

      // 데이터 수집 & 렌더링
      collectSensorData().then(function (dataPoints) {
        if (dataPoints.length > 0) {
          renderHeatmap(dataPoints);
        } else {
          console.warn('[HeatmapMixin] No sensor data collected');
        }
      });
    }
  };

  // ────────────────────────────────────────
  // Public: updateHeatmapConfig
  // ────────────────────────────────────────

  var UNIFORM_KEYS = ['displacementScale', 'baseHeight', 'opacity'];

  instance.updateHeatmapConfig = function (newOptions) {
    Object.assign(config, newOptions);

    if (!instance._heatmap.visible) return;

    var hm = instance._heatmap;

    // uniform-only 변경인지 판별
    var onlyUniforms = Object.keys(newOptions).every(function (key) {
      return UNIFORM_KEYS.indexOf(key) !== -1;
    });

    if (onlyUniforms && hm.mesh) {
      // Hot update: 셰이더 uniform만 즉시 반영
      var uniforms = hm.mesh.material.uniforms;
      if (newOptions.displacementScale !== undefined) uniforms.displacementScale.value = newOptions.displacementScale;
      if (newOptions.baseHeight !== undefined) uniforms.baseHeight.value = newOptions.baseHeight;
      if (newOptions.opacity !== undefined) uniforms.opacity.value = newOptions.opacity;
    } else {
      // Full rebuild: 메시 재생성 + 데이터 재수집
      instance.destroyHeatmap();

      createHeatmapMesh();
      instance._heatmap.visible = true;
      HeatmapMixin._activeInstance = instance;
      syncButtonState(true);

      collectSensorData().then(function (dataPoints) {
        if (dataPoints.length > 0) {
          renderHeatmap(dataPoints);
        }
      });
    }
  };

  // ────────────────────────────────────────
  // Public: destroyHeatmap
  // ────────────────────────────────────────

  instance.destroyHeatmap = function () {
    var hm = instance._heatmap;

    if (hm.mesh) {
      var scene = wemb.threeElements.scene;

      // geometry dispose
      if (hm.mesh.geometry) hm.mesh.geometry.dispose();

      // material dispose
      if (hm.mesh.material) hm.mesh.material.dispose();

      // texture dispose
      if (hm.colorTexture) {
        hm.colorTexture.dispose();
        hm.colorTexture = null;
      }
      if (hm.displacementTexture) {
        hm.displacementTexture.dispose();
        hm.displacementTexture = null;
      }

      scene.remove(hm.mesh);
      hm.mesh = null;
    }

    hm.colorCanvas = null;
    hm.displacementCanvas = null;
    hm.heat = null;
    hm.visible = false;

    if (HeatmapMixin._activeInstance === instance) {
      HeatmapMixin._activeInstance = null;
    }
  };

  // ────────────────────────────────────────
  // destroyPopup 체인 확장
  // ────────────────────────────────────────

  if (instance.destroyPopup) {
    var originalDestroyPopup = instance.destroyPopup;
    instance.destroyPopup = function () {
      instance.destroyHeatmap();
      originalDestroyPopup.call(instance);
    };
  }
};
