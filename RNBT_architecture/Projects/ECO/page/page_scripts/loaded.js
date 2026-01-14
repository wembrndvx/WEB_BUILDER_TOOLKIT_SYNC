/*
 * Page - loaded
 * ECO (Energy & Cooling Operations) Dashboard
 *
 * Responsibilities:
 * - 데이터셋 정의 (globalDataMappings)
 * - Param 관리 (currentParams)
 * - GlobalDataPublisher로 데이터 발행
 * - 구독자(컴포넌트)에게 데이터 전파
 */

const { each } = fx;

// ======================
// DATA MAPPINGS
// ======================

this.globalDataMappings = [
    {
        topic: 'hierarchy',
        datasetInfo: {
            datasetName: 'hierarchy',
            param: { depth: 1, locale: 'ko' }
        },
        refreshInterval: null  // 수동 갱신만
    },
    {
        topic: 'hierarchyChildren',
        datasetInfo: {
            datasetName: 'hierarchyChildren',
            param: { nodeId: '', locale: 'ko' }
        },
        refreshInterval: null  // Lazy Loading용
    },
    {
        topic: 'hierarchyAssets',
        datasetInfo: {
            datasetName: 'hierarchyAssets',
            param: { nodeId: '', locale: 'ko' }
        },
        refreshInterval: null
    },
    {
        topic: 'locale',
        datasetInfo: {
            datasetName: 'locale',
            param: { locale: 'ko' }
        },
        refreshInterval: null  // locale 변경 알림용
    },
    {
        topic: 'assets',
        datasetInfo: {
            datasetName: 'assets',
            param: {}
        },
        refreshInterval: null  // 수동 갱신만 (refresh 버튼)
    }
];

// ======================
// PARAM MANAGEMENT
// ======================

this.currentParams = {};

// 매핑 등록 + 초기 파라미터 설정
fx.go(
    this.globalDataMappings,
    each(GlobalDataPublisher.registerMapping),
    each(({ topic, datasetInfo }) => {
        this.currentParams[topic] = { ...datasetInfo.param };
    })
);

// 초기 데이터 발행 (hierarchy - depth=1로 트리 루트 노드만)
GlobalDataPublisher.fetchAndPublish('hierarchy', this, this.currentParams['hierarchy'])
    .catch(err => console.error('[fetchAndPublish:hierarchy]', err));

// ======================
// EVENT HANDLERS (컴포넌트 이벤트 구독)
// ======================

// 트리 노드 선택 시 → hierarchyAssets 데이터 요청
Weventbus.on('@hierarchyNodeSelected', ({ event }) => {
    const { nodeId, locale } = event;
    this.currentParams['hierarchyAssets'] = { nodeId, locale };
    GlobalDataPublisher.fetchAndPublish('hierarchyAssets', this, { nodeId, locale })
        .catch(err => console.error('[fetchAndPublish:hierarchyAssets]', err));
});

// Lazy Loading 요청 시 → hierarchyChildren 데이터 요청
Weventbus.on('@hierarchyChildrenRequested', ({ event }) => {
    const { nodeId, locale } = event;
    this.currentParams['hierarchyChildren'] = { nodeId, locale };
    GlobalDataPublisher.fetchAndPublish('hierarchyChildren', this, { nodeId, locale })
        .catch(err => console.error('[fetchAndPublish:hierarchyChildren]', err));
});

// Locale 변경 시 → hierarchy 재로드
Weventbus.on('@localeChanged', ({ event }) => {
    const { locale } = event;
    this.currentParams['hierarchy'] = { ...this.currentParams['hierarchy'], locale };
    GlobalDataPublisher.fetchAndPublish('hierarchy', this, this.currentParams['hierarchy'])
        .catch(err => console.error('[fetchAndPublish:hierarchy]', err));

    // locale topic 발행 (구독자에게 locale 변경 알림)
    GlobalDataPublisher.publish('locale', { data: { locale } });
});

// Refresh 버튼 클릭 시 → hierarchy 재로드
Weventbus.on('@refreshClicked', () => {
    GlobalDataPublisher.fetchAndPublish('hierarchy', this, this.currentParams['hierarchy'])
        .catch(err => console.error('[fetchAndPublish:hierarchy]', err));
});

// ======================
// INTERVAL MANAGEMENT (필요 시 활성화)
// ======================

this.startAllIntervals = () => {
    this.refreshIntervals = {};

    fx.go(
        this.globalDataMappings,
        each(({ topic, refreshInterval }) => {
            if (refreshInterval) {
                this.refreshIntervals[topic] = setInterval(() => {
                    GlobalDataPublisher.fetchAndPublish(
                        topic,
                        this,
                        this.currentParams[topic] || {}
                    ).catch(err => console.error(`[fetchAndPublish:${topic}]`, err));
                }, refreshInterval);
            }
        })
    );
};

this.stopAllIntervals = () => {
    fx.go(
        Object.values(this.refreshIntervals || {}),
        each(interval => clearInterval(interval))
    );
};

// 현재는 수동 갱신만 사용하므로 interval 시작하지 않음
// this.startAllIntervals();

console.log('[Page] loaded - ECO Dashboard data mappings registered, event handlers attached');
