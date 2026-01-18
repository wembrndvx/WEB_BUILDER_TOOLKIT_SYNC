/*
 * Page - before_load
 * ECO (Energy & Cooling Operations) Dashboard
 *
 * Responsibilities:
 * - Register event bus handlers
 * - Setup 3D raycasting
 *
 * 이벤트 핸들러:
 * - 3D 클릭: @assetClicked (모든 3D 팝업 컴포넌트 공통)
 * - AssetList: @hierarchyNodeSelected, @hierarchyChildrenRequested, @assetSelected, @refreshClicked
 * - i18n: @localeChanged
 */

const { onEventBusHandlers, initThreeRaycasting, withSelector, makeIterator, getInstanceById, getInstanceByName } = Wkit;

// ======================
// EVENT BUS HANDLERS
// ======================

this.eventBusHandlers = {
    // ─────────────────────────────────────────
    // 3D 클릭 이벤트 (3D 팝업 컴포넌트 공통)
    // ─────────────────────────────────────────

    '@assetClicked': ({ event, targetInstance }) => {
        console.log('[Page] Asset clicked:', targetInstance.name, targetInstance.id);
        targetInstance.showDetail();
    },

    // ─────────────────────────────────────────
    // AssetList 이벤트 (일반 2D 컴포넌트)
    // ─────────────────────────────────────────

    // 트리 노드 선택 → 해당 노드의 자산 목록 요청
    '@hierarchyNodeSelected': ({ event }) => {
        const { assetId, locale } = event;
        console.log('[Page] Hierarchy node selected:', assetId);

        this.currentParams = this.currentParams || {};
        this.currentParams['hierarchyAssets'] = { assetId, locale };

        GlobalDataPublisher.fetchAndPublish('hierarchyAssets', this, { assetId, locale })
            .catch(err => console.error('[fetchAndPublish:hierarchyAssets]', err));
    },

    // Lazy Loading 요청 → hierarchyChildren 데이터 요청
    '@hierarchyChildrenRequested': ({ event }) => {
        const { assetId, locale } = event;
        console.log('[Page] Hierarchy children requested:', assetId);

        this.currentParams = this.currentParams || {};
        this.currentParams['hierarchyChildren'] = { assetId, locale };

        GlobalDataPublisher.fetchAndPublish('hierarchyChildren', this, { assetId, locale })
            .catch(err => console.error('[fetchAndPublish:hierarchyChildren]', err));
    },

    // 자산 행 선택 → 해당 3D 컴포넌트 팝업 표시
    '@assetSelected': ({ event, targetInstance }) => {
        const { asset } = event;
        console.log('[Page] Asset selected:', asset);

        // TODO: 3D 컴포넌트 찾아서 showDetail 호출
        // const instance3D = getInstanceById(asset.id);
        // if (instance3D) instance3D.showDetail();
    },

    // 새로고침 버튼 클릭 → hierarchy 데이터 재발행
    '@refreshClicked': () => {
        console.log('[Page] Refresh clicked - fetching hierarchy');
        GlobalDataPublisher.fetchAndPublish('hierarchy', this, this.currentParams?.hierarchy || {})
            .catch(err => console.error('[fetchAndPublish:hierarchy]', err));
    },

    // ─────────────────────────────────────────
    // i18n 이벤트
    // ─────────────────────────────────────────

    // Locale 변경 → hierarchy 재로드
    '@localeChanged': ({ event }) => {
        const { locale } = event;
        console.log('[Page] Locale changed:', locale);

        this.currentParams = this.currentParams || {};
        this.currentParams['hierarchy'] = { ...this.currentParams['hierarchy'], locale };

        GlobalDataPublisher.fetchAndPublish('hierarchy', this, this.currentParams['hierarchy'])
            .catch(err => console.error('[fetchAndPublish:hierarchy]', err));

        // locale topic 발행 (구독자에게 locale 변경 알림)
        GlobalDataPublisher.publish('locale', { data: { locale } });
    }
};

onEventBusHandlers(this.eventBusHandlers);

// ======================
// 3D RAYCASTING SETUP
// ======================

this.raycastingEvents = withSelector(this.appendElement, 'canvas', canvas =>
    fx.go(
        [{ type: 'click' }],
        fx.map(event => ({
            ...event,
            handler: initThreeRaycasting(canvas, event.type)
        }))
    )
);

console.log('[Page] before_load - ECO Dashboard event handlers & raycasting ready');
