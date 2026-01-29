/**
 * Page - before_unload.js (3D)
 *
 * 호출 시점: 페이지 이탈 직전
 *
 * 책임:
 * - 모든 인터벌 정지
 * - 이벤트 핸들러 해제
 * - 데이터 매핑 해제
 * - 3D Raycasting 정리
 * - 3D 리소스 일괄 정리
 */

const { offEventBusHandlers, disposeAllThreeResources, withSelector } = Wkit;
const { each } = fx;

// ======================
// STOP INTERVALS
// ======================

if (this.stopAllIntervals) {
    this.stopAllIntervals();
}
this.refreshIntervals = null;
this.startAllIntervals = null;
this.stopAllIntervals = null;

// ======================
// OFF EVENT HANDLERS
// ======================

if (this.pageEventBusHandlers) {
    offEventBusHandlers(this.pageEventBusHandlers);
    this.pageEventBusHandlers = null;
}

// ======================
// UNREGISTER MAPPINGS
// ======================

if (this.pageDataMappings) {
    fx.go(
        this.pageDataMappings,
        each(({ topic }) => GlobalDataPublisher.unregisterMapping(topic))
    );
    this.pageDataMappings = null;
}

this.currentParams = null;

// ======================
// 3D RAYCASTING CLEANUP
// ======================

withSelector(this.appendElement, 'canvas', canvas => {
    if (this.raycastingEvents) {
        fx.go(
            this.raycastingEvents,
            each(({ type, handler }) => canvas.removeEventListener(type, handler))
        );
        this.raycastingEvents = null;
    }
});

// ======================
// 3D RESOURCES CLEANUP
// ======================

/**
 * 한 줄로 모든 3D 컴포넌트 정리:
 * - subscriptions 해제
 * - customEvents, datasetInfo 참조 제거
 * - geometry, material, texture dispose
 * - Scene background 정리
 */
disposeAllThreeResources(this);

console.log('[Page] before_unload - All cleanup completed (including 3D resources)');
