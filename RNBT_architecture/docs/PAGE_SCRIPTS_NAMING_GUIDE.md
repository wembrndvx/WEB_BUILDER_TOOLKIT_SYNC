# Page Scripts 네이밍 가이드

Master와 Page의 page_scripts는 **같은 `this` 컨텍스트를 공유**한다.
따라서 `this`에 저장하는 속성 이름이 충돌하면 중복 등록, 덮어쓰기 등의 버그가 발생한다.

---

## 문제 상황

### eventBusHandlers 중복 등록

```javascript
// Master before_load.js
this.eventBusHandlers = {
    '@userMenuClicked': ({ event }) => { ... },
    '@navItemClicked': ({ event }) => { ... }
};
onEventBusHandlers(this.eventBusHandlers);  // 2개 등록

// Page before_load.js
this.eventBusHandlers = Object.assign(this.eventBusHandlers || {}, {
    '@3dObjectClicked': async ({ event }) => { ... }
});
onEventBusHandlers(this.eventBusHandlers);  // 3개 전체를 다시 등록
// => @userMenuClicked, @navItemClicked이 2번 등록됨
```

`Object.assign`으로 Master 핸들러를 보존한 것은 좋지만,
합쳐진 전체 객체를 `onEventBusHandlers`에 넘기므로 **Master 핸들러가 이중 등록**된다.

### globalDataMappings 중복 등록

```javascript
// Master loaded.js
this.globalDataMappings = [
    { topic: 'userInfo', ... },
    { topic: 'menuList', ... }
];
each(GlobalDataPublisher.registerMapping);   // 2개 등록
each(GlobalDataPublisher.fetchAndPublish);   // 2개 fetch

// Page loaded.js
this.globalDataMappings = [
    ...(this.globalDataMappings || []),
    { topic: 'equipmentStatus', ... }
];
each(GlobalDataPublisher.registerMapping);   // 3개 전체를 다시 등록
each(GlobalDataPublisher.fetchAndPublish);   // 3개 전체를 다시 fetch
// => userInfo, menuList가 2번 register + 2번 fetch됨
```

---

## 해결: 속성 이름 분리

Master와 Page는 **각자 고유한 속성 이름**을 사용한다.

### eventBusHandlers

```javascript
// Master before_load.js
this.masterEventBusHandlers = {
    '@userMenuClicked': ({ event }) => { ... },
    '@navItemClicked': ({ event }) => { ... }
};
onEventBusHandlers(this.masterEventBusHandlers);

// Page before_load.js
this.pageEventBusHandlers = {
    '@3dObjectClicked': async ({ event }) => { ... }
};
onEventBusHandlers(this.pageEventBusHandlers);
```

```javascript
// Master before_unload.js
offEventBusHandlers(this.masterEventBusHandlers);
this.masterEventBusHandlers = null;

// Page before_unload.js
offEventBusHandlers(this.pageEventBusHandlers);
this.pageEventBusHandlers = null;
```

### globalDataMappings

```javascript
// Master loaded.js
this.masterDataMappings = [
    { topic: 'userInfo', ... },
    { topic: 'menuList', ... }
];
fx.go(
    this.masterDataMappings,
    each(GlobalDataPublisher.registerMapping),
    each(({ topic }) => GlobalDataPublisher.fetchAndPublish(topic, this, {}))
);

// Page loaded.js
this.pageDataMappings = [
    { topic: 'equipmentStatus', ... }
];
fx.go(
    this.pageDataMappings,
    each(GlobalDataPublisher.registerMapping),
    each(({ topic }) => GlobalDataPublisher.fetchAndPublish(topic, this, {}))
);
```

```javascript
// Master before_unload.js
if (this.masterDataMappings) {
    fx.go(this.masterDataMappings, each(({ topic }) => GlobalDataPublisher.unregisterMapping(topic)));
    this.masterDataMappings = null;
}

// Page before_unload.js
if (this.pageDataMappings) {
    fx.go(this.pageDataMappings, each(({ topic }) => GlobalDataPublisher.unregisterMapping(topic)));
    this.pageDataMappings = null;
}
```

---

## 네이밍 규칙

| 스코프 | eventBusHandlers | globalDataMappings | currentParams | refreshIntervals |
|--------|------------------|--------------------|---------------|------------------|
| Master | `masterEventBusHandlers` | `masterDataMappings` | `masterParams` | `masterIntervals` |
| Page   | `pageEventBusHandlers`   | `pageDataMappings`   | `pageParams`   | `pageIntervals`   |

### 원칙

1. **Master와 Page는 같은 속성 이름을 사용하지 않는다**
2. **각자 등록한 것만 각자 해제한다**
3. **`Object.assign`이나 spread로 합치지 않는다** - 합칠 필요가 없다

---

## 왜 중복 등록이 문제인가

- `Weventbus.on(eventName, handler)`은 리스너 배열에 push하는 방식이다
- 같은 이벤트에 같은 핸들러를 2번 `on`하면 **이벤트 발생 시 2번 실행**된다
- `GlobalDataPublisher.registerMapping`도 동일하게 중복 등록되면 불필요한 fetch가 발생한다

---

## 관련 문서

- [EVENT_HANDLING.md](EVENT_HANDLING.md) - 컴포넌트 이벤트 처리 원칙
- [WEVENTBUS_API.md](WEVENTBUS_API.md) - Weventbus API
- [WKIT_API.md](WKIT_API.md) - onEventBusHandlers, offEventBusHandlers
- [GLOBAL_DATA_PUBLISHER_API.md](GLOBAL_DATA_PUBLISHER_API.md) - GlobalDataPublisher API
