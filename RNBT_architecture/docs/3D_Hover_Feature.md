# 3D Hover 기능 가이드

이 문서는 3D 컴포넌트의 Hover Label, Outline, Distance 기능을 설명합니다.

---

## 1. 개요

3D 컴포넌트(`NWV3DComponent` 상속)에 마우스를 올리면 개별 Mesh 단위로 아웃라인과 라벨이 표시됩니다.

**주요 기능:**
- **Hover Label**: Mesh 위치에 이름 라벨 표시
- **Hover Outline**: Mesh 엣지에 아웃라인 표시
- **Distance 제한**: 카메라 거리에 따른 라벨 표시 제어

---

## 2. 속성 목록

### 2.1 Hover Label 속성

| 속성 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `hoverLabelEnable` | boolean | `true` | 라벨 표시 여부 |
| `hoverLabelStyle` | object | 아래 참조 | 라벨 CSS 스타일 |
| `hoverLabelOffset` | object | `{ x: 0, y: 0, z: 0 }` | mesh 중심 기준 라벨 위치 오프셋 |
| `hoverLabelMinDistance` | number | `0` | 최소 거리 (이보다 가까우면 숨김) |
| `hoverLabelMaxDistance` | number | `Infinity` | 최대 거리 (이보다 멀면 숨김) |

**기본 라벨 스타일:**
```javascript
{
  background: 'rgba(0, 0, 0, 0.75)',
  color: '#fff',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '12px',
}
```

### 2.2 Hover Outline 속성

| 속성 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `outlineEnable` | boolean | `true` | 아웃라인 표시 여부 |
| `hoverOutlineColor` | number/null | `null` | 아웃라인 색상 (null이면 기본 색상 사용) |

---

## 3. 사용법

### 3.1 기본 사용 (WScript)

컴포넌트의 `register` 이벤트에서 속성을 설정합니다.

```javascript
// register 이벤트
// 라벨 비활성화
this.hoverLabelEnable = false;

// 아웃라인 색상 변경
this.hoverOutlineColor = 0xff0000;  // 빨간색
```

### 3.2 라벨 스타일 커스터마이징

```javascript
// register 이벤트
this.hoverLabelStyle = {
  background: 'rgba(255, 0, 0, 0.8)',  // 빨간 배경
  color: '#ffffff',                      // 흰색 글씨
  padding: '8px 16px',                   // 더 큰 패딩
  borderRadius: '8px',                   // 둥근 모서리
  fontSize: '14px',                      // 더 큰 폰트
};
```

### 3.3 라벨 위치 오프셋 설정

라벨 위치를 mesh 중심에서 이동시킵니다.

```javascript
// register 이벤트
// mesh 중심에서 y축으로 10 위로 이동
this.hoverLabelOffset = { x: 0, y: 10, z: 0 };
```

### 3.4 거리 제한 설정

카메라와의 거리에 따라 라벨 표시를 제어합니다.

```javascript
// register 이벤트
// 10 ~ 100 거리 사이에서만 라벨 표시
this.hoverLabelMinDistance = 10;
this.hoverLabelMaxDistance = 100;
```

**거리 계산 방식:**
- 카메라 위치와 컴포넌트 월드 위치 사이의 유클리드 거리
- 단위: Three.js 월드 좌표 기준

---

## 4. 커스텀 컴포넌트에서 사용

### 4.1 생성자에서 설정

```javascript
class MyComponent extends WV3DResourceComponent {
  constructor() {
    super();

    // Hover Label 설정
    this.hoverLabelEnable = true;
    this.hoverLabelStyle = {
      background: 'rgba(0, 0, 0, 0.75)',
      color: '#fff',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
    };

    // Hover Outline 설정
    this.outlineEnable = true;
    this.hoverOutlineColor = null;  // 기본 색상 사용
  }
}
```

### 4.2 ModelLoaderComponent 예제

```javascript
// ModelLoaderComponent.js
class ModelLoaderComponent extends WV3DResourceComponent {
  constructor() {
    super();
    ComponentMixin.applyModelLoaderMixin(this);

    // Hover Label 설정
    this.hoverLabelEnable = true;
    this.hoverLabelStyle = {
      background: 'rgba(0, 0, 0, 0.75)',
      color: '#fff',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
    };

    // Hover Outline 설정
    this.outlineEnable = true;
    this.hoverOutlineColor = null;
  }
}
```

---

## 5. 라벨 표시 형식

라벨에는 **Mesh 이름**과 **인스턴스 이름**이 함께 표시됩니다.

**형식:**
```
{Mesh이름} ({인스턴스이름})
```

**예시:**
```
Wheel (ModelLoader_1)
Body (ModelLoader_1)
unnamed (Box_1)
```

Mesh에 이름이 없으면 `unnamed`로 표시됩니다.

---

## 6. 내부 구현

### 6.1 관련 파일

```
packages/common/src/wemb/core/component/3D/NWV3DComponent.ts
```

### 6.2 주요 메서드

| 메서드 | 설명 |
|--------|------|
| `_onMouseOverHandler(event)` | 마우스 호버 시 라벨/아웃라인 생성 |
| `_onMouseOutHandler(event)` | 마우스 아웃 시 라벨/아웃라인 제거 |
| `_onMouseMoveHandler(event)` | 같은 컴포넌트 내 다른 mesh로 이동 시 라벨/아웃라인 갱신 |
| `_createHoverLabel(mesh)` | CSS2DObject로 라벨 생성 |
| `_clearHoverLabel()` | 라벨 제거 |
| `_clearMeshOutline()` | 아웃라인 제거 |
| `_isWithinLabelDistance()` | 거리 조건 체크 |

### 6.3 아웃라인 생성 방식

```javascript
// Mesh의 엣지를 추출하여 LineSegments로 표시
const edge = new THREE.EdgesGeometry(mesh.geometry);
this._meshOutline = new THREE.LineSegments(
  edge,
  new THREE.LineBasicMaterial({ color: this.hoverOutlineColor })
);
```

### 6.4 라벨 위치 계산

```javascript
// Mesh의 BoundingBox 중심에 라벨 배치
const box = new THREE.Box3().setFromObject(mesh);
const center = box.getCenter(new THREE.Vector3());

// appendElement 기준 상대 좌표로 변환
const parentInverse = new THREE.Matrix4().copy(this.appendElement.matrixWorld).invert();
center.applyMatrix4(parentInverse);

// offset 적용
const offset = this._hoverLabelOffset;
center.x += offset.x || 0;
center.y += offset.y || 0;
center.z += offset.z || 0;

this._hoverLabel.position.copy(center);
```

---

## 7. 주의사항

### 7.1 성능

- 복잡한 모델(많은 Mesh)에서는 호버 시 EdgesGeometry 계산 비용 발생
- 거리 제한을 적절히 사용하여 불필요한 라벨 표시 방지

### 7.2 스타일 속성

`hoverLabelStyle`에 설정할 수 있는 속성은 CSS 속성명과 동일합니다:
- `background`, `color`, `padding`, `borderRadius`, `fontSize` 등
- camelCase 형식 사용 (예: `backgroundColor` 대신 `background`)

### 7.3 색상 값

`hoverOutlineColor`는 Three.js 색상 형식을 사용합니다:
- 16진수: `0xff0000` (빨강)
- null: 기본 색상 (`threeLayer.mouseOverOutlineColor`) 사용

---

## 8. 관련 커밋

| 커밋 | 설명 |
|------|------|
| `c39d02d3` | 3D hover 시 mesh 위치에 라벨 표시 기능 추가 |
| `abf20ecf` | 3D 개별 mesh 단위 hover outline 구현 |
| `4513dc61` | 3D hover label/outline 커스터마이징 속성 추가 |
| `2cf5e138` | 3D hover label 기능 확장 및 타입 정의 추가 |
| `cca58f1f` | 3D hover label에 인스턴스 이름 prefix 추가 |
| `74e12e15` | 같은 컴포넌트 내 다른 mesh hover 시 label/outline 갱신 |
| `36cb008f` | _onDestroy에서 mousemove 이벤트 및 참조 정리 추가 |

---

*작성일: 2025-01-08*
*최종 수정: 2025-01-22*
