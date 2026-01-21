/**
 * Page - before_load.js (3D)
 *
 * 호출 시점: 페이지 진입 직후, Page 컴포넌트들이 초기화되기 전
 *
 * 책임:
 * - Page 레벨 이벤트 버스 핸들러 등록
 * - 3D Raycasting 초기화
 */

const { onEventBusHandlers, initThreeRaycasting, fetchData, withSelector } = Wkit;

// ======================
// EVENT BUS HANDLERS (3D 포함)
// ======================

this.eventBusHandlers = Object.assign(this.eventBusHandlers || {}, {
    /**
     * 3D 객체 클릭 이벤트 핸들러
     *
     * bind3DEvents에서 발행한 이벤트를 처리
     * intersects 배열에서 클릭된 객체 정보 추출
     */
    '@3dObjectClicked': async ({ event: { intersects }, targetInstance: { datasetInfo, meshStatusConfig } }) => {
        go(
            intersects,
            fx.filter(intersect => fx.find(c => c.meshName === intersect.object.name, meshStatusConfig)),
            fx.each(target => fx.go(
                datasetInfo,
                fx.map((info) => ({ datasetName: info.datasetName, param: info.getParam(target.object, meshStatusConfig) })),
                fx.filter(({ param }) => param),
                fx.each(({ datasetName, param }) => Wkit.fetchData(this, datasetName, param).then(console.log).catch(console.error))
            ))
        )

    }
});

onEventBusHandlers(this.eventBusHandlers);

// ======================
// 3D RAYCASTING SETUP
// ======================

/**
 * 3D Raycasting 초기화
 *
 * canvas 요소에 click 이벤트 리스너를 등록하여
 * 3D 공간에서의 클릭을 감지
 */
this.raycastingEvents = withSelector(this.appendElement, 'canvas', canvas =>
    fx.go(
        [
            { type: 'click' }
            // { type: 'mousemove' },  // hover 필요시 활성화
            // { type: 'dblclick' }    // 더블클릭 필요시 활성화
        ],
        fx.map(event => ({
            ...event,
            handler: initThreeRaycasting(canvas, event.type)
        }))
    )
);

console.log('[Page] before_load - 3D event handlers and raycasting initialized');
