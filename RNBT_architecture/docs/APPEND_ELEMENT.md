# appendElement 접근 패턴

`this.appendElement`는 페이지 또는 컴포넌트의 최상단 컨테이너입니다.

---

## 페이지

```javascript
/**
 * @this {{
 *   appendElement: HTMLDivElement
 * }}
 */
function init() {
    console.log('Page Element', this.appendElement);
}

init.call(this);
```

- `this.appendElement`: 페이지 컨테이너 `HTMLDivElement`

---

## 2D 컴포넌트

```javascript
/**
 * @this {{
 *   appendElement: HTMLDivElement
 * }}
 */
function init() {
    console.log('2D Element', this.appendElement);
}

init.call(this);
```

- `this.appendElement`: instance id를 가진 `HTMLDivElement`
- DOM API 사용 가능 (`querySelector`, `addEventListener` 등)

---

## 3D 컴포넌트

```javascript
/**
 * @this {{
 *   appendElement: WeTHREE.THREE.Group
 * }}
 */
function init3D() {
    console.log('3D Group', this.appendElement);
}

init3D.call(this);
```

- `this.appendElement`: "MainGroup" 이름을 가진 `THREE.Group`
- Three.js API 사용 가능 (`traverse`, `add`, `remove` 등)

---

## 요약

| 타입 | appendElement 타입 | 설명 |
|------|-------------------|------|
| 페이지 | `HTMLDivElement` | 페이지 컨테이너 |
| 2D 컴포넌트 | `HTMLDivElement` | DOM 컨테이너 |
| 3D 컴포넌트 | `THREE.Group` | Three.js 그룹 객체 |

---

## 관련 문서

- [README.md - appendElement](/RNBT_architecture/README.md#appendelement--component-container)
