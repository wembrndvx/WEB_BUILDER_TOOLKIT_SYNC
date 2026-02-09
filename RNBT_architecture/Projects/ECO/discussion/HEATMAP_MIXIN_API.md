# HeatmapMixin API Reference

3D 씬에 온도 히트맵 서피스를 생성/관리하는 Mixin.
simpleheat(인라인 포함)로 2D 히트맵을 생성하고, THREE.ShaderMaterial로 3D PlaneGeometry에 적용.

---

## 개요

팝업 내 버튼 클릭 시 클릭한 인스턴스 위치를 중심으로 주변 온도 분포를 히트맵 서피스로 토글 표시.

```
팝업 히트맵 버튼 클릭 → toggleHeatmap() → mesh 생성 (인스턴스 위치 중심) → 센서 데이터 수집 → 렌더링
```

---

## 전제 조건

- `applyShadowPopupMixin` 이후에 호출 (`destroyPopup` 체인 확장)
- `applyEChartsMixin` 이후에 호출 (체인 순서 보장)
- THREE (Three.js) 전역 접근 가능
- `wemb.threeElements.scene` 접근 가능
- simpleheat는 Mixin 내부에 인라인 포함 (외부 의존성 없음)

---

## 빠른 시작

### 1단계: Mixin 임포트 및 적용

```javascript
const { applyHeatmapMixin } = HeatmapMixin;

// applyShadowPopupMixin, applyEChartsMixin 이후에 호출
applyHeatmapMixin(this, {
    surfaceSize: { width: 20, depth: 20 },
    temperatureMetrics: ['SENSOR.TEMP', 'CRAC.RETURN_TEMP'],
});
```

### 2단계: 팝업 이벤트에 버튼 핸들러 추가

```javascript
const popupCreatedConfig = {
    events: {
        click: {
            '.close-btn': () => this.hideDetail(),
            '.heatmap-btn': () => this.toggleHeatmap(),  // 히트맵 토글
        },
    },
};
```

### 3단계: HTML에 버튼 추가

```html
<button class="heatmap-btn" type="button" aria-label="Heatmap" data-active="false">
    <!-- SVG 아이콘 -->
</button>
```

버튼의 `data-active` 속성은 Mixin이 자동으로 `"true"` / `"false"` 토글.

---

## applyHeatmapMixin 옵션

```javascript
applyHeatmapMixin(instance, options)
```

### 전체 옵션 (기본값 포함)

```javascript
applyHeatmapMixin(this, {
    surfaceSize:        { width: 20, depth: 20 },
    temperatureRange:   { min: 17, max: 31 },
    gradient:           null,            // null = DEFAULT_GRADIENT (온도 프리셋)
    heatmapResolution:  256,
    segments:           64,
    displacementScale:  3,
    baseHeight:         0.5,
    radius:             60,
    blur:               25,
    opacity:            0.75,
    temperatureMetrics: ['SENSOR.TEMP', 'CRAC.RETURN_TEMP'],
    refreshInterval:    5000,
});
```

---

### 옵션 상세

#### `surfaceSize` — 서피스 크기 (월드 단위)

| 속성 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `width` | number | `20` | X축 크기 |
| `depth` | number | `20` | Z축 크기 |

PlaneGeometry의 월드 단위 크기. 서피스 위치는 클릭한 인스턴스의 `getWorldPosition()` 중심 (Y=0, 바닥 위).

```javascript
surfaceSize: { width: 20, depth: 20 }   // 기본
surfaceSize: { width: 40, depth: 40 }   // 넓은 영역
surfaceSize: { width: 10, depth: 10 }   // 좁은 영역
```

---

#### `temperatureRange` — 값 매핑 범위

| 속성 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `min` | number | `17` | 최저값 (gradient 0.0) |
| `max` | number | `31` | 최고값 (gradient 1.0) |

데이터 값을 `(value - min) / (max - min)`으로 정규화하여 gradient의 0.0~1.0에 매핑.
범위 밖 값은 0.0 또는 1.0으로 클램핑됨.

```javascript
// 온도 (기본 — DEFAULT_GRADIENT와 매칭)
temperatureRange: { min: 17, max: 31 }

// 습도 (humidity gradient와 함께 사용)
temperatureRange: { min: 20, max: 71 }
```

---

#### `gradient` — 색상 그라디언트

| 타입 | 기본값 | 설명 |
|------|--------|------|
| object 또는 `null` | `null` | `null`이면 DEFAULT_GRADIENT (온도 프리셋) 사용 |

simpleheat의 색상 매핑. 키는 0.0~1.0 위치, 값은 CSS 색상.

**온도 프리셋 (DEFAULT_GRADIENT, 기본)**:

```javascript
// gradient: null 또는 생략 시 이 프리셋 사용
gradient: {
    0.00: '#1068D9',   // ≤17°C 과냉
    0.29: '#4AA3DF',   // 18-21°C 정상(저온)
    0.57: '#2ECC71',   // 22-25°C 최적
    0.71: '#A3D977',   // 26-27°C 정상 상한
    0.93: '#F7A318',   // 28-30°C 경고
    1.00: '#E74C3C',   // ≥31°C 위험
}
```

**습도 프리셋**:

```javascript
gradient: {
    0.00: '#154360',   // ≤20%  과건조 (정전기 위험)
    0.37: '#5DADE2',   // 21-39% 건조 주의
    0.69: '#27AE60',   // 40-55% 최적
    0.78: '#A9DFBF',   // 56-60% 정상 상한
    0.98: '#F39C12',   // 61-70% 고습 경고
    1.00: '#C0392B',   // ≥71%  위험 (결로 가능)
}
// temperatureRange: { min: 20, max: 71 } 과 함께 사용
```

> gradient stop 위치 = `(경계값 - min) / (max - min)`

---

#### `heatmapResolution` — 히트맵 캔버스 해상도

| 타입 | 기본값 | 범위 |
|------|--------|------|
| number | `256` | 64 ~ 1024 권장 |

simpleheat가 그리는 내부 캔버스의 px 크기 (정사각형).
텍스처 해상도에 직접 영향.

```javascript
heatmapResolution: 128   // 저해상도 (빠름, 거친 표현)
heatmapResolution: 256   // 기본 (균형)
heatmapResolution: 512   // 고해상도 (정밀, GPU 부하 증가)
```

> `segments`와 함께 조정. resolution만 올려도 segments가 낮으면 displacement가 거칠 수 있음.

---

#### `segments` — PlaneGeometry 세그먼트 수

| 타입 | 기본값 | 범위 |
|------|--------|------|
| number | `64` | 16 ~ 128 권장 |

PlaneGeometry의 분할 수 (widthSegments, heightSegments 동일 적용).
displacement 맵의 정점 밀도를 결정.

```javascript
segments: 32    // 거친 표면 (빠름, 성능 우선)
segments: 64    // 기본 (균형)
segments: 128   // 부드러운 표면 (정밀, 정점 수: 128*128 = 16,384)
```

> 높을수록 displacement가 부드럽지만, 정점 수가 제곱으로 증가.

---

#### `displacementScale` — 수직 변위 스케일

| 타입 | 기본값 | 범위 |
|------|--------|------|
| number | `3` | 0 ~ 10 권장 |

Vertex Shader에서 Y축 방향으로 표면을 올리는 정도.
온도가 높은 곳이 위로 더 솟아오르는 시각적 효과.

```javascript
displacementScale: 0     // 완전 평면 (displacement 없음)
displacementScale: 1     // 미세한 기복
displacementScale: 3     // 기본 (적당한 기복)
displacementScale: 8     // 극적인 기복 (고온 영역이 크게 솟음)
```

> Vertex Shader: `newPosition.z = baseHeight + displacement * displacementScale`

---

#### `baseHeight` — 서피스 기준 높이

| 타입 | 기본값 | 범위 |
|------|--------|------|
| number | `0.5` | 0 ~ 5 권장 |

Vertex Shader에서 모든 정점의 기본 Z 오프셋 (월드 Y축).
서피스가 바닥에서 얼마나 떠 있는지 결정.

```javascript
baseHeight: 0      // 바닥에 밀착
baseHeight: 0.5    // 기본 (바닥에서 약간 띄움)
baseHeight: 2      // 바닥에서 많이 띄움
```

> mesh.position.y는 0으로 고정, baseHeight는 셰이더에서 적용.

---

#### `radius` — simpleheat 확산 반경

| 타입 | 기본값 | 범위 |
|------|--------|------|
| number | `60` | 10 ~ 150 권장 |

각 데이터 포인트의 열 확산 범위 (캔버스 px 단위).
하나의 센서 온도값이 주변으로 퍼지는 정도.

```javascript
radius: 20    // 좁은 확산 (점 형태, 센서 위치만 표시)
radius: 60    // 기본 (적당한 확산)
radius: 120   // 넓은 확산 (서피스 전체가 색상으로 채워짐)
```

시각적 효과:
```
radius 작음              radius 큼
  ·  ·  ·               ████████████
  ·  ·  ·      →        ████████████
  ·  ·  ·               ████████████
 (점 형태)              (면 형태)
```

> `heatmapResolution`에 대한 상대값. resolution=256일 때 radius=60이면 캔버스의 ~23% 확산.

---

#### `blur` — simpleheat 블러

| 타입 | 기본값 | 범위 |
|------|--------|------|
| number | `25` | 5 ~ 60 권장 |

simpleheat의 각 포인트 원형 그라디언트 가장자리 블러 (canvas shadowBlur).
확산 경계의 부드러움을 결정.

```javascript
blur: 5      // 날카로운 경계 (확산 가장자리가 뚜렷)
blur: 25     // 기본 (부드러운 경계)
blur: 50     // 매우 부드러운 경계 (전체가 뭉개짐)
```

> `radius`와 조합: 실제 그리기 반경 = `radius + blur`. 너무 크면 캔버스 밖으로 넘칠 수 있음.

---

#### `opacity` — 서피스 투명도

| 타입 | 기본값 | 범위 |
|------|--------|------|
| number | `0.75` | 0.0 ~ 1.0 |

Fragment Shader에서 적용되는 서피스 전체 투명도.

```javascript
opacity: 0.3    // 반투명 (아래 바닥이 잘 보임)
opacity: 0.75   // 기본
opacity: 1.0    // 불투명
```

> 히트맵 데이터가 없는 영역(alpha < 0.1)은 투명도와 무관하게 완전 투명 처리됨.

---

#### `temperatureMetrics` — 수집 대상 metricCode

| 타입 | 기본값 |
|------|--------|
| string[] | `['SENSOR.TEMP', 'CRAC.RETURN_TEMP']` |

`Wkit.makeIterator`로 모든 3D 인스턴스를 순회할 때, 각 인스턴스의 `config.statusCards.metrics`에서 이 배열에 포함된 `metricCode`를 가진 인스턴스만 데이터 수집 대상으로 선택.

```javascript
// 센서 온도만
temperatureMetrics: ['SENSOR.TEMP']

// 센서 + CRAC 환기 온도
temperatureMetrics: ['SENSOR.TEMP', 'CRAC.RETURN_TEMP']

// 습도 기반 히트맵으로 변환하고 싶다면
temperatureMetrics: ['SENSOR.HUMIDITY']
```

---

#### `refreshInterval` — 자동 데이터 갱신 주기

| 타입 | 기본값 | 범위 |
|------|--------|------|
| number | `5000` | 0 = 비활성, 1000 이상 권장 |

히트맵 활성(ON) 상태에서 센서 데이터를 주기적으로 재수집하여 히트맵을 갱신하는 간격 (ms).
`0`으로 설정하면 자동 갱신을 비활성화 (최초 1회 렌더링만).

```javascript
refreshInterval: 5000     // 기본 (5초마다 갱신, 카드 새로고침과 동일 주기)
refreshInterval: 10000    // 10초마다 갱신 (부하 감소)
refreshInterval: 0        // 자동 갱신 비활성화 (최초 1회만)
```

갱신 흐름:
```
toggleHeatmap() ON
  → 최초 collectSensorData + renderHeatmap
  → setInterval(refreshInterval)
    → collectSensorData → renderHeatmap (반복)
  ...
toggleHeatmap() OFF / destroyHeatmap()
  → clearInterval
```

> `updateHeatmapConfig({ refreshInterval: 10000 })` 호출 시 기존 인터벌을 중지하고 새 주기로 재시작.

---

## 제공 메서드

| 메서드 | 설명 |
|--------|------|
| `toggleHeatmap()` | 히트맵 ON/OFF 토글. 데이터 수집 + 렌더링 자동 실행 |
| `updateHeatmapConfig(options)` | 런타임에 옵션 변경. 히트맵 활성 시 즉시 반영 |
| `destroyHeatmap()` | 히트맵 리소스 정리 + 씬에서 제거 |

### toggleHeatmap()

```javascript
this.toggleHeatmap();
```

**ON 시**:
1. 기존 활성 히트맵 제거 (싱글톤 — 동시에 하나만 존재)
2. PlaneGeometry + ShaderMaterial mesh 생성 (클릭한 인스턴스 위치 중심)
3. 모든 3D 인스턴스에서 `temperatureMetrics` 데이터 수집 (metricLatest API)
4. simpleheat → colorTexture + displacementTexture 생성
5. 자동 갱신 인터벌 시작 (`refreshInterval > 0`인 경우)
6. 버튼 `data-active="true"` 설정

**OFF 시**:
1. 자동 갱신 인터벌 중지
2. mesh, geometry, material, texture 모두 dispose
3. 씬에서 제거
4. 버튼 `data-active="false"` 설정

### destroyHeatmap()

```javascript
this.destroyHeatmap();
```

리소스 정리 전용. 자동 갱신 인터벌 중지 포함.
`destroyPopup()` 체인에 자동 포함되어 팝업 닫기 시 자동 호출됨.

### updateHeatmapConfig(options)

```javascript
this.updateHeatmapConfig({ radius: 80, blur: 40 });
```

런타임에 옵션을 변경. 변경 대상에 따라 반영 방식이 다름:

| 반영 방식 | 옵션 | 설명 |
|-----------|------|------|
| **즉시 반영** (셰이더 uniform) | `displacementScale`, `baseHeight`, `opacity` | GPU 값만 변경. 메시 재생성 없음 |
| **인터벌 재시작** | `refreshInterval` | 기존 인터벌 중지 → 새 주기로 재시작. 메시 변경 없음 |
| **재생성** (메시 + 데이터 재수집) | 그 외 모든 옵션 | destroy → 재생성 → 데이터 수집 → 렌더링 → 인터벌 재시작 |

히트맵이 꺼진 상태에서 호출하면 config만 업데이트하고 다음 `toggleHeatmap()` 시 반영.

```javascript
// 즉시 반영 (셰이더 uniform만 변경 → 깜빡임 없음)
this.updateHeatmapConfig({ opacity: 0.5 });
this.updateHeatmapConfig({ displacementScale: 5, baseHeight: 1 });

// 재생성 (메시 재구성 필요)
this.updateHeatmapConfig({ radius: 100, blur: 50 });
this.updateHeatmapConfig({ surfaceSize: { width: 30, depth: 30 } });

// 인터벌만 변경 (메시 재생성 없음)
this.updateHeatmapConfig({ refreshInterval: 10000 });
this.updateHeatmapConfig({ refreshInterval: 0 });  // 자동 갱신 중지

// 혼합 시 재생성으로 처리 (uniform + non-uniform)
this.updateHeatmapConfig({ opacity: 0.5, radius: 80 });
```

---

## 싱글톤 관리

동시에 하나의 히트맵만 활성화됨.

```
센서A 히트맵 ON → 센서B 히트맵 ON → 센서A 히트맵 자동 OFF + 센서B 히트맵 ON
```

`HeatmapMixin._activeInstance`로 추적. 새 히트맵 토글 시 이전 인스턴스의 히트맵을 자동 제거하고 버튼 상태도 업데이트.

---

## 내부 동작 흐름

### 데이터 수집 (`collectSensorData`)

```
Wkit.makeIterator(page, 'threeLayer')
  → 모든 3D 인스턴스 순회
  → inst.config.statusCards.metrics에서 temperatureMetrics 매칭
  → 매칭된 인스턴스별 Wkit.fetchData(page, 'metricLatest', { baseUrl, assetKey })
  → Promise.all 수집
  → [{ worldX, worldZ, temperature }] 반환
```

### 렌더링 (`renderHeatmap`)

```
dataPoints → worldToCanvas() 좌표 변환
  → simpleheat.data(canvasData).draw(0.05)
  → generateDisplacementMap() (R*0.5 + G*0.3 - B*0.2 기반)
  → colorTexture.needsUpdate = true
  → displacementTexture.needsUpdate = true
```

### 셰이더

**Vertex Shader**: displacement 텍스처에서 Z 오프셋 계산
```glsl
newPosition.z = baseHeight + texture2D(displacementMap, uv).r * displacementScale;
```

**Fragment Shader**: color 텍스처 + 높이 기반 하이라이트
```glsl
color.rgb += smoothstep(0.3, 0.8, vDisplacement / 4.0) * 0.15;
alpha = color.a > 0.1 ? opacity : 0.0;
```

---

## 레이캐스팅

히트맵 mesh는 레이캐스팅을 무시:
```javascript
mesh.raycast = function () {};
```

히트맵 아래의 3D 오브젝트를 정상적으로 클릭할 수 있음.

---

## 리소스 정리

`destroyPopup()` 호출 시 자동 정리 (체인 확장):

- 자동 갱신 인터벌 clearInterval
- PlaneGeometry dispose
- ShaderMaterial dispose
- colorTexture, displacementTexture dispose
- 씬에서 mesh 제거
- 내부 캔버스, simpleheat 인스턴스 해제

```javascript
// beforeDestroy에서 (자동으로 연결됨)
this.destroyPopup();
// → destroyHeatmap() → destroyPopup(원본)
```

---

## 옵션 조합 가이드

### 넓은 영역 + 부드러운 히트맵

```javascript
applyHeatmapMixin(this, {
    surfaceSize: { width: 40, depth: 40 },
    radius: 100,
    blur: 40,
    segments: 128,
    heatmapResolution: 512,
    displacementScale: 5,
});
```

### 좁은 영역 + 날카로운 포인트

```javascript
applyHeatmapMixin(this, {
    surfaceSize: { width: 10, depth: 10 },
    radius: 25,
    blur: 10,
    segments: 32,
    heatmapResolution: 128,
    displacementScale: 2,
});
```

### 평면 히트맵 (displacement 없음)

```javascript
applyHeatmapMixin(this, {
    displacementScale: 0,
    baseHeight: 0.1,
    segments: 16,        // displacement 없으므로 낮아도 됨
});
```

---

## 관련 문서

- [POPUP_MIXIN_API.md](/RNBT_architecture/docs/POPUP_MIXIN_API.md) - Shadow DOM 팝업, ECharts, Tabulator
- [WKIT_API.md](/RNBT_architecture/docs/WKIT_API.md) - makeIterator, fetchData
- [Projects/ECO/page/components/TempHumiditySensor](/RNBT_architecture/Projects/ECO/page/components/TempHumiditySensor) - Sensor 구현 예제
- [Projects/ECO/page/components/CRAC](/RNBT_architecture/Projects/ECO/page/components/CRAC) - CRAC 구현 예제
