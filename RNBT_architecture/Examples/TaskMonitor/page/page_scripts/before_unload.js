/**
 * Page - before_unload.js
 *
 * 호출 시점: 페이지 이탈 직전
 *
 * 책임:
 * - 모든 인터벌 정지
 * - 이벤트 핸들러 해제
 * - 데이터 매핑 해제
 * - 메모리 정리
 */

const { offEventBusHandlers } = Wkit;
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

if (this.eventBusHandlers) {
    offEventBusHandlers(this.eventBusHandlers);
    this.eventBusHandlers = null;
}

// ======================
// UNREGISTER MAPPINGS
// ======================

if (this.globalDataMappings) {
    fx.go(
        this.globalDataMappings,
        each(({ topic }) => GlobalDataPublisher.unregisterMapping(topic))
    );
    this.globalDataMappings = null;
}

this.currentParams = null;

console.log('[Page] before_unload - Cleanup completed');
