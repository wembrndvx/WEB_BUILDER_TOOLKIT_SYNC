/*
 * Page - loaded
 * ECO (Energy & Cooling Operations) Dashboard
 *
 * Responsibilities:
 * - 데이터셋 정의 (globalDataMappings)
 * - Param 관리 (currentParams)
 * - GlobalDataPublisher로 데이터 발행
 * - 구독자(컴포넌트)에게 데이터 전파
 *
 * Asset API v1:
 * - assetList: POST /api/v1/ast/l (자산 전체 목록)
 * - relationList: POST /api/v1/rel/l (관계 전체 목록)
 */

const { each } = fx;

// ======================
// DATA MAPPINGS (Asset API v1)
// ======================

this.globalDataMappings = [
    {
        topic: 'assetList',
        datasetInfo: {
            datasetName: 'assetList',
            param: {}
        },
        refreshInterval: null  // 수동 갱신만
    },
    {
        topic: 'relationList',
        datasetInfo: {
            datasetName: 'relationList',
            param: {
                filter: { relationType: 'LOCATED_IN' }  // 트리 구조용 위치 관계만
            }
        },
        refreshInterval: null  // 트리 구조 빌드용
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

// 초기 데이터 발행 (Asset API v1 - 자산 목록 + 관계 목록)
Promise.all([
    GlobalDataPublisher.fetchAndPublish('assetList', this, this.currentParams['assetList']),
    GlobalDataPublisher.fetchAndPublish('relationList', this, this.currentParams['relationList'])
]).catch(err => console.error('[fetchAndPublish:initial]', err));

// ======================
// EVENT HANDLERS
// 모든 이벤트 핸들러는 before_load.js에서 onEventBusHandlers로 등록됨
// ======================

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

console.log('[Page] loaded - ECO Dashboard (Asset API v1) data mappings registered');
