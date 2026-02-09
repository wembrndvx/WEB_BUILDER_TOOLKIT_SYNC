# Heatmap Config API — Test Results

테스트 실행일: 2026-02-09
테스트 파일: `test-heatmap-config-api.html`

## 요약

| 항목 | 값 |
|------|---:|
| **Total** | 43 |
| **Pass** | 43 |
| **Fail** | 0 |

---

## Category A: OFF 상태 config 업데이트 — 13 tests

히트맵 OFF 상태에서 `updateHeatmapConfig` 호출 시, config만 저장되고 mesh 생성/rebuild 없음.

### A-1. displacementScale 변경 → config 반영

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
inst.updateHeatmapConfig({ displacementScale: 7 });
```

**검증**:
- `inst._heatmap.config.displacementScale === 7`
- `inst._heatmap.visible === false` (유지)
- `inst._heatmapCallCount.createMesh === 0` (호출 없음)

---

### A-2. baseHeight 변경 → config 반영

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
inst.updateHeatmapConfig({ baseHeight: 2 });
```

**검증**:
- `inst._heatmap.config.baseHeight === 2`

---

### A-3. opacity 변경 → config 반영

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
inst.updateHeatmapConfig({ opacity: 0.3 });
```

**검증**:
- `inst._heatmap.config.opacity === 0.3`

---

### A-4. radius 변경 → config 반영

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
inst.updateHeatmapConfig({ radius: 100 });
```

**검증**:
- `inst._heatmap.config.radius === 100`
- `inst._heatmapCallCount.createMesh === 0` (rebuild 없음)

---

### A-5. blur 변경 → config 반영

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
inst.updateHeatmapConfig({ blur: 50 });
```

**검증**:
- `inst._heatmap.config.blur === 50`

---

### A-6. surfaceSize 변경 → config 반영

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
inst.updateHeatmapConfig({ surfaceSize: { width: 30, depth: 30 } });
```

**검증**:
- `inst._heatmap.config.surfaceSize === { width: 30, depth: 30 }`

---

### A-7. segments 변경 → config 반영

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
inst.updateHeatmapConfig({ segments: 128 });
```

**검증**:
- `inst._heatmap.config.segments === 128`

---

### A-8. heatmapResolution 변경 → config 반영

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
inst.updateHeatmapConfig({ heatmapResolution: 512 });
```

**검증**:
- `inst._heatmap.config.heatmapResolution === 512`

---

### A-9. temperatureRange 변경 → config 반영

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
inst.updateHeatmapConfig({ temperatureRange: { min: 15, max: 35 } });
```

**검증**:
- `inst._heatmap.config.temperatureRange === { min: 15, max: 35 }`

---

### A-10. temperatureMetrics 변경 → config 반영

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
inst.updateHeatmapConfig({ temperatureMetrics: ['SENSOR.HUMIDITY'] });
```

**검증**:
- `inst._heatmap.config.temperatureMetrics === ['SENSOR.HUMIDITY']`

---

### A-11. gradient 변경 → config 반영

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
const customGradient = { 0.0: '#0000ff', 0.5: '#00ff00', 1.0: '#ff0000' };
inst.updateHeatmapConfig({ gradient: customGradient });
```

**검증**:
- `inst._heatmap.config.gradient === customGradient`
- `inst._heatmapCallCount.createMesh === 0` (rebuild 없음)

---

### A-12. 복수 옵션 동시 변경 → 모두 반영

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
inst.updateHeatmapConfig({ radius: 80, blur: 40, opacity: 0.5, displacementScale: 5 });
```

**검증**:
- `inst._heatmap.config.radius === 80`
- `inst._heatmap.config.blur === 40`
- `inst._heatmap.config.opacity === 0.5`
- `inst._heatmap.config.displacementScale === 5`

---

### A-13. 빈 객체 전달 → 기존값 유지

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
inst.updateHeatmapConfig({});
```

**검증**:
- `inst._heatmap.config.radius` 기존값 유지
- `inst._heatmap.config.opacity` 기존값 유지

---

## Category B: ON + uniform hot update — 5 tests

히트맵 ON 상태에서 uniform-only 키(`displacementScale`, `baseHeight`, `opacity`) 변경 시, mesh 재생성 없이 셰이더 uniform만 즉시 반영.

### B-1. displacementScale → uniform 즉시 반영

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
inst.updateHeatmapConfig({ displacementScale: 8 });
```

**검증**:
- `mesh.material.uniforms.displacementScale.value === 8`
- `inst._heatmap.config.displacementScale === 8`
- mesh 객체 동일 (rebuild 없음)
- `destroyHeatmap` 호출 없음

---

### B-2. baseHeight → uniform 즉시 반영

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
inst.updateHeatmapConfig({ baseHeight: 3 });
```

**검증**:
- `mesh.material.uniforms.baseHeight.value === 3`
- `inst._heatmap.config.baseHeight === 3`

---

### B-3. opacity → uniform 즉시 반영

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
inst.updateHeatmapConfig({ opacity: 0.2 });
```

**검증**:
- `mesh.material.uniforms.opacity.value === 0.2`
- `inst._heatmap.config.opacity === 0.2`

---

### B-4. 복수 uniform 동시 변경 → 모두 즉시 반영

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
inst.updateHeatmapConfig({ displacementScale: 10, baseHeight: 2, opacity: 0.9 });
```

**검증**:
- `uniforms.displacementScale.value === 10`
- `uniforms.baseHeight.value === 2`
- `uniforms.opacity.value === 0.9`
- mesh 객체 동일 (rebuild 없음)

---

### B-5. uniform 변경 후 visible 유지

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
inst.updateHeatmapConfig({ opacity: 0.5 });
```

**검증**:
- `inst._heatmap.visible === true`
- `HeatmapMixin._activeInstance === inst`

---

## Category C: ON + rebuild — 12 tests

히트맵 ON 상태에서 non-uniform 키 변경 시, `destroyHeatmap()` → `createHeatmapMesh()` → `collectSensorData()` 전체 재생성.

### C-1. radius 변경 → destroy + rebuild

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
inst.updateHeatmapConfig({ radius: 100 });
```

**검증**:
- `destroyHeatmap` 호출됨 (destroy count +1)
- `createHeatmapMesh` 호출됨 (createMesh count +1)
- `inst._heatmap.config.radius === 100`
- `inst._heatmap.visible === true` (유지)

---

### C-2. blur 변경 → destroy + rebuild

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
inst.updateHeatmapConfig({ blur: 50 });
```

**검증**:
- `destroyHeatmap` 호출됨
- `inst._heatmap.config.blur === 50`

---

### C-3. surfaceSize 변경 → destroy + rebuild

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
inst.updateHeatmapConfig({ surfaceSize: { width: 40, depth: 40 } });
```

**검증**:
- `destroyHeatmap` 호출됨
- `inst._heatmap.config.surfaceSize === { width: 40, depth: 40 }`
- 새 mesh의 `geometry._width === 40`, `geometry._depth === 40`

---

### C-4. segments 변경 → destroy + rebuild

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
inst.updateHeatmapConfig({ segments: 128 });
```

**검증**:
- `destroyHeatmap` 호출됨
- 새 mesh의 `geometry._ws === 128`

---

### C-5. heatmapResolution 변경 → destroy + rebuild

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
inst.updateHeatmapConfig({ heatmapResolution: 512 });
```

**검증**:
- `destroyHeatmap` 호출됨
- 새 `colorCanvas.width === 512`

---

### C-6. temperatureRange 변경 → destroy + rebuild

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
inst.updateHeatmapConfig({ temperatureRange: { min: 10, max: 40 } });
```

**검증**:
- `destroyHeatmap` 호출됨
- `inst._heatmap.config.temperatureRange === { min: 10, max: 40 }`

---

### C-7. temperatureMetrics 변경 → destroy + rebuild

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
inst.updateHeatmapConfig({ temperatureMetrics: ['SENSOR.HUMIDITY'] });
```

**검증**:
- `destroyHeatmap` 호출됨
- `inst._heatmap.config.temperatureMetrics === ['SENSOR.HUMIDITY']`

---

### C-8. gradient 변경 → destroy + rebuild

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
const customGradient = { 0.0: '#0000ff', 0.5: '#00ff00', 1.0: '#ff0000' };
inst.updateHeatmapConfig({ gradient: customGradient });
```

**검증**:
- `destroyHeatmap` 호출됨
- `inst._heatmap.config.gradient === customGradient`

---

### C-9. 혼합 (uniform + non-uniform) → rebuild로 처리

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
inst.updateHeatmapConfig({ opacity: 0.5, radius: 80 });
```

**검증**:
- `destroyHeatmap` 호출됨 (non-uniform `radius` 포함 → rebuild)
- `inst._heatmap.config.opacity === 0.5`
- `inst._heatmap.config.radius === 80`
- 새 mesh의 `uniforms.opacity.value === 0.5` (rebuild 후 config에서 읽음)

---

### C-10. rebuild 후 activeInstance 유지

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
inst.updateHeatmapConfig({ radius: 120 });
```

**검증**:
- `HeatmapMixin._activeInstance === inst`
- `inst._heatmap.visible === true`

---

### C-11. rebuild 후 scene에 mesh 존재

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
inst.updateHeatmapConfig({ segments: 32 });
```

**검증**:
- `scene._children`에 새 mesh 포함

---

## Category D: OFF→toggle 반영 — 4 tests

OFF 상태에서 config 변경 후, 다음 `toggleHeatmap()` 시 변경된 config로 생성.

### D-1. OFF에서 radius 변경 → toggle 시 새 값 적용

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
inst.updateHeatmapConfig({ radius: 120 });
activateHeatmap(inst);
```

**검증**:
- `inst._heatmap.config.radius === 120`

---

### D-2. OFF에서 surfaceSize 변경 → toggle 시 geometry 크기 반영

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
inst.updateHeatmapConfig({ surfaceSize: { width: 50, depth: 50 } });
activateHeatmap(inst);
```

**검증**:
- `mesh.geometry._width === 50`
- `mesh.geometry._depth === 50`

---

### D-3. OFF에서 gradient 변경 → toggle 시 적용

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
const customGradient = { 0.0: '#0000ff', 0.5: '#00ff00', 1.0: '#ff0000' };
inst.updateHeatmapConfig({ gradient: customGradient });
activateHeatmap(inst);
```

**검증**:
- `inst._heatmap.config.gradient === customGradient`

---

### D-4. OFF에서 opacity 변경 → toggle 시 uniform 반영

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
inst.updateHeatmapConfig({ opacity: 0.4 });
activateHeatmap(inst);
```

**검증**:
- `mesh.material.uniforms.opacity.value === 0.4`

---

## Category E: 싱글톤 관리 — 2 tests

동시에 하나의 히트맵만 활성화. 새 인스턴스 토글 시 이전 인스턴스 자동 제거.

### E-1. 새 인스턴스 toggle → 이전 인스턴스 자동 destroy

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
const inst1 = createMock('Sensor1');
const inst2 = createMock('Sensor2');
activateHeatmap(inst1);
activateHeatmap(inst2);
```

**검증**:
- `HeatmapMixin._activeInstance === inst2`
- `inst1._heatmap.visible === false`
- `inst1._heatmap.mesh === null`

---

### E-2. toggle OFF → activeInstance null

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
inst.toggleHeatmap(); // OFF
```

**검증**:
- `HeatmapMixin._activeInstance === null`
- `inst._heatmap.visible === false`

---

## Category F: destroy 리소스 정리 — 5 tests

`destroyHeatmap()` 호출 시 모든 THREE.js 리소스 dispose + 내부 상태 초기화.

### F-1. geometry dispose 호출

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
const geo = inst._heatmap.mesh.geometry;
inst.destroyHeatmap();
```

**검증**:
- `geo._disposed === true`

---

### F-2. material dispose 호출

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
const mat = inst._heatmap.mesh.material;
inst.destroyHeatmap();
```

**검증**:
- `mat._disposed === true`

---

### F-3. texture dispose 호출

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
const colorTex = inst._heatmap.colorTexture;
const dispTex = inst._heatmap.displacementTexture;
inst.destroyHeatmap();
```

**검증**:
- `colorTex._disposed === true`
- `dispTex._disposed === true`

---

### F-4. scene에서 mesh 제거

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
const meshBefore = inst._heatmap.mesh;
inst.destroyHeatmap();
```

**검증**:
- `scene._children`에서 mesh 제거됨

---

### F-5. 내부 상태 초기화

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
inst.destroyHeatmap();
```

**검증**:
- `inst._heatmap.mesh === null`
- `inst._heatmap.colorCanvas === null`
- `inst._heatmap.displacementCanvas === null`
- `inst._heatmap.heat === null`
- `inst._heatmap.visible === false`
- `inst._heatmap.colorTexture === null`
- `inst._heatmap.displacementTexture === null`

---

## Category G: destroyPopup 체인 — 2 tests

`destroyPopup()` 호출 시 `destroyHeatmap()` → 원래 `destroyPopup()` 순서로 체인 실행.

### G-1. destroyPopup → destroyHeatmap 자동 호출

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
activateHeatmap(inst);
inst.destroyPopup();
```

**검증**:
- `destroyHeatmap` 호출됨 (destroy count +1)
- 원래 `destroyPopup` 호출됨

---

### G-2. heatmap OFF 상태에서 destroyPopup 안전

| Component | Result |
|-----------|--------|
| Heatmap | PASS |

```javascript
// heatmap OFF 상태
inst.destroyPopup();
```

**검증**:
- 에러 없이 함수 종료
- 원래 `destroyPopup` 호출됨

---

## 업데이트 동작 분류표

| 옵션 | OFF 상태 | ON 상태 |
|------|----------|---------|
| `displacementScale` | config만 저장 | **uniform hot update** (mesh 유지) |
| `baseHeight` | config만 저장 | **uniform hot update** (mesh 유지) |
| `opacity` | config만 저장 | **uniform hot update** (mesh 유지) |
| `radius` | config만 저장 | **full rebuild** (destroy→create→fetch) |
| `blur` | config만 저장 | **full rebuild** |
| `surfaceSize` | config만 저장 | **full rebuild** |
| `segments` | config만 저장 | **full rebuild** |
| `heatmapResolution` | config만 저장 | **full rebuild** |
| `temperatureRange` | config만 저장 | **full rebuild** |
| `temperatureMetrics` | config만 저장 | **full rebuild** |
| `gradient` | config만 저장 | **full rebuild** |
| uniform + non-uniform 혼합 | config만 저장 | **full rebuild** |

---

*테스트 실행 파일: `test-heatmap-config-api.html`*
*최종 업데이트: 2026-02-09*
