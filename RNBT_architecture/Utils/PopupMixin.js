/*
 * PopupMixin.js
 *
 * Shadow DOM Popup 전용 Mixin 모음
 *
 * ─────────────────────────────────────────────────────────────
 * 사용 가능한 Mixin
 * ─────────────────────────────────────────────────────────────
 *
 * 1. applyShadowPopupMixin - 기본 Shadow DOM 팝업
 *    - 팝업 생성/표시/숨김
 *    - DOM 쿼리
 *    - 이벤트 바인딩
 *
 * 2. applyEChartsMixin - ECharts 차트 관리 (Popup 전용)
 *    - applyShadowPopupMixin 이후 호출
 *    - 차트 생성/업데이트/조회
 *    - ResizeObserver 자동 연결
 *
 * 3. applyTabulatorMixin - Tabulator 테이블 관리 (Popup 전용)
 *    - applyShadowPopupMixin 이후 호출
 *    - Shadow DOM CSS 자동 주입
 *    - 테이블 생성/업데이트/조회
 *
 * ─────────────────────────────────────────────────────────────
 * 사용 예시
 * ─────────────────────────────────────────────────────────────
 *
 *   const { applyShadowPopupMixin, applyEChartsMixin, applyTabulatorMixin } = PopupMixin;
 *
 *   applyShadowPopupMixin(this, {
 *       getHTML: () => '<div class="popup">...</div>',
 *       getStyles: () => '.popup { ... }',
 *       onCreated: (shadowRoot) => { ... }
 *   });
 *
 *   applyEChartsMixin(this);    // 차트 필요 시
 *   applyTabulatorMixin(this);  // 테이블 필요 시
 *
 * ─────────────────────────────────────────────────────────────
 * 표시/숨김 방식
 * ─────────────────────────────────────────────────────────────
 *
 * - showPopup(): host.style.display = 'block'
 * - hidePopup(): host.style.display = 'none'
 *
 * opacity, visibility, transform 등 다른 방식 필요 시 수정 필요.
 * ─────────────────────────────────────────────────────────────
 */

const PopupMixin = {};

// 팝업 z-index 카운터 (나중에 연 팝업이 항상 최상단)
let _popupZCounter = 1000;

// 현재 열려있는 팝업 인스턴스 (한 번에 하나만 열림)
let _activePopupInstance = null;

/**
 * ─────────────────────────────────────────────────────────────
 * applyShadowPopupMixin - 기본 Shadow DOM 팝업
 * ─────────────────────────────────────────────────────────────
 *
 * 제공 메서드:
 * - createPopup()      : Shadow DOM 팝업 생성
 * - showPopup()        : 팝업 표시
 * - hidePopup()        : 팝업 숨김
 * - popupQuery()       : Shadow DOM 내부 요소 선택
 * - popupQueryAll()    : Shadow DOM 내부 요소 모두 선택
 * - bindPopupEvents()  : 이벤트 델리게이션 바인딩
 * - destroyPopup()     : 팝업 및 리소스 정리
 */
PopupMixin.applyShadowPopupMixin = function(instance, options) {
    const { getHTML, getStyles, onCreated } = options;

    // Internal state
    instance._popup = {
        host: null,
        shadowRoot: null,
        eventCleanups: [],
    };

    /**
     * Shadow DOM 팝업 생성
     */
    instance.createPopup = function() {
        if (instance._popup.host) return instance._popup.shadowRoot;

        // Shadow DOM 호스트 생성
        instance._popup.host = document.createElement('div');
        instance._popup.host.id = `popup-${instance.id}`;
        instance._popup.shadowRoot = instance._popup.host.attachShadow({ mode: 'open' });

        // 스타일 + HTML 삽입
        instance._popup.shadowRoot.innerHTML = `
            <style>${getStyles.call(instance)}</style>
            ${getHTML.call(instance)}
        `;

        // 페이지에 추가
        instance.page.appendElement.appendChild(instance._popup.host);

        // 콜백
        if (onCreated) {
            onCreated.call(instance, instance._popup.shadowRoot);
        }

        return instance._popup.shadowRoot;
    };

    /**
     * 팝업 표시
     */
    instance.showPopup = function() {
        // 다른 팝업이 열려있으면 먼저 닫기
        if (_activePopupInstance && _activePopupInstance !== instance && _activePopupInstance._popup.host) {
            _activePopupInstance.hidePopup();
        }

        if (!instance._popup.host) {
            instance.createPopup();
        }
        instance._popup.host.style.zIndex = ++_popupZCounter;
        instance._popup.host.style.display = 'block';
        _activePopupInstance = instance;
    };

    /**
     * 팝업 숨김
     */
    instance.hidePopup = function() {
        if (instance._popup.host) {
            instance.destroyPopup();
        }
    };

    /**
     * Shadow DOM 내부 요소 선택
     */
    instance.popupQuery = function(selector) {
        return instance._popup.shadowRoot?.querySelector(selector);
    };

    /**
     * Shadow DOM 내부 요소 모두 선택
     */
    instance.popupQueryAll = function(selector) {
        return instance._popup.shadowRoot?.querySelectorAll(selector) || [];
    };

    /**
     * 이벤트 델리게이션 기반 바인딩
     *
     * @param {Object} events - { eventType: { selector: handler } }
     */
    instance.bindPopupEvents = function(events) {
        fx.each(([eventType, handlers]) => {
            const listener = (e) => {
                fx.each(([selector, handler]) => {
                    if (e.target.closest(selector)) {
                        handler.call(instance, e);
                    }
                }, Object.entries(handlers));
            };

            instance._popup.shadowRoot.addEventListener(eventType, listener);
            instance._popup.eventCleanups.push(() => {
                instance._popup.shadowRoot.removeEventListener(eventType, listener);
            });
        }, Object.entries(events));
    };

    /**
     * 팝업 및 리소스 정리
     */
    instance.destroyPopup = function() {
        // 활성 팝업 참조 해제
        if (_activePopupInstance === instance) {
            _activePopupInstance = null;
        }

        // 이벤트 정리
        fx.each(cleanup => cleanup(), instance._popup.eventCleanups);
        instance._popup.eventCleanups = [];

        // DOM 제거
        if (instance._popup.host) {
            instance._popup.host.remove();
            instance._popup.host = null;
            instance._popup.shadowRoot = null;
        }
    };
};

/**
 * ─────────────────────────────────────────────────────────────
 * applyEChartsMixin - ECharts 차트 관리 (Popup 전용)
 * ─────────────────────────────────────────────────────────────
 *
 * applyShadowPopupMixin 이후에 호출해야 합니다.
 *
 * 제공 메서드:
 * - createChart(selector)         : ECharts 인스턴스 생성 + ResizeObserver
 * - getChart(selector)            : 인스턴스 조회
 * - updateChart(selector, option) : setOption 호출
 *
 * destroyPopup() 호출 시 차트 자동 정리
 */
PopupMixin.applyEChartsMixin = function(instance) {
    if (!instance._popup) {
        console.warn('[PopupMixin] applyEChartsMixin requires applyShadowPopupMixin to be called first');
        return;
    }

    // 차트 저장소 추가
    instance._popup.charts = new Map();  // selector → { chart, resizeObserver }

    /**
     * Shadow DOM 내부에 ECharts 인스턴스 생성
     */
    instance.createChart = function(selector) {
        if (instance._popup.charts.has(selector)) {
            return instance._popup.charts.get(selector).chart;
        }

        const container = instance.popupQuery(selector);
        if (!container) {
            console.warn(`[PopupMixin] Chart container not found: ${selector}`);
            return null;
        }

        const chart = echarts.init(container);

        const resizeObserver = new ResizeObserver(() => {
            chart.resize();
        });
        resizeObserver.observe(container);

        instance._popup.charts.set(selector, { chart, resizeObserver });

        return chart;
    };

    /**
     * 차트 인스턴스 조회
     */
    instance.getChart = function(selector) {
        return instance._popup.charts.get(selector)?.chart || null;
    };

    /**
     * 차트 옵션 업데이트
     */
    instance.updateChart = function(selector, option) {
        const chart = instance.getChart(selector);
        if (!chart) {
            console.warn(`[PopupMixin] Chart not found: ${selector}`);
            return;
        }

        try {
            chart.setOption(option, { replaceMerge: ['series'] });
        } catch (e) {
            console.error(`[PopupMixin] Chart setOption error:`, e);
        }
    };

    // destroyPopup 확장 - 차트 정리 추가
    const originalDestroyPopup = instance.destroyPopup;
    instance.destroyPopup = function() {
        // 차트 정리
        fx.each(({ chart, resizeObserver }) => {
            resizeObserver.disconnect();
            chart.dispose();
        }, instance._popup.charts.values());
        instance._popup.charts.clear();

        // 원래 destroyPopup 호출
        originalDestroyPopup.call(instance);
    };
};

/**
 * ─────────────────────────────────────────────────────────────
 * applyTabulatorMixin - Shadow DOM 내 Tabulator 테이블 믹스인 (Popup 전용)
 * ─────────────────────────────────────────────────────────────
 *
 * Shadow DOM 팝업 내에서 Tabulator 테이블을 관리합니다.
 * applyShadowPopupMixin과 함께 사용됩니다.
 *
 * 사용법:
 *   // applyShadowPopupMixin 이후에 호출
 *   applyTabulatorMixin(this);
 *
 * 테이블 사용:
 *   this.createTable('.table-container', options);  // Tabulator 생성 + ResizeObserver
 *   this.updateTable('.table-container', data);     // setData
 *   this.getTable('.table-container');              // 인스턴스 조회
 *   // destroyPopup() 호출 시 테이블 자동 정리 (applyShadowPopupMixin 확장)
 *
 * 옵션 빌더 패턴:
 *   const tableConfig = {
 *       columns: [...],
 *       optionBuilder: (config, data) => ({ ...tabulatorOptions })
 *   };
 *   const options = tableConfig.optionBuilder(tableConfig, data);
 *   this.createTable('.table-container', options);
 *
 * ─────────────────────────────────────────────────────────────
 * Shadow DOM에서 Tabulator CSS 사용하기
 * ─────────────────────────────────────────────────────────────
 *
 * 문제:
 *   Shadow DOM은 외부 스타일시트와 격리됩니다.
 *   메인 페이지에서 Tabulator CSS를 import해도 Shadow DOM에는 적용되지 않음.
 *
 * 해결:
 *   CSS 파일을 fetch하여 Shadow DOM에 <style> 태그로 주입합니다.
 *   - 경로: client/common/libs/tabulator/tabulator_midnight.min.css
 *   - 테마: midnight (다크 모드)
 *
 * 커스터마이징:
 *   midnight 테마가 이미 다크 모드를 지원하므로 최소한의 오버라이드만 권장.
 *   권장 스타일: border-radius, 헤더 강조선, 배경 투명화, 행 높이
 *   피해야 할 스타일: 색상 오버라이드 (테마가 이미 처리)
 * ─────────────────────────────────────────────────────────────
 */
PopupMixin.applyTabulatorMixin = function(instance) {
    // _popup이 없으면 applyShadowPopupMixin이 먼저 호출되지 않은 것
    if (!instance._popup) {
        console.warn('[PopupMixin] applyTabulatorMixin requires applyShadowPopupMixin to be called first');
        return;
    }

    // 테이블 저장소 추가
    instance._popup.tables = new Map();  // selector → { table, resizeObserver }
    instance._popup.tabulatorCssInjected = false;

    // Tabulator CSS 파일 경로 (midnight 테마 - 다크 모드)
    const TABULATOR_CSS_PATH = 'client/common/libs/tabulator/tabulator_midnight.min.css';

    /**
     * Shadow DOM에 Tabulator CSS 파일 주입 (최초 1회)
     * CSS 파일을 fetch하여 <style> 태그로 Shadow DOM에 주입
     */
    async function injectTabulatorCSS() {
        if (instance._popup.tabulatorCssInjected) return;

        const shadowRoot = instance._popup.host?.shadowRoot;
        if (!shadowRoot) return;

        instance._popup.tabulatorCssInjected = true; // 중복 요청 방지

        try {
            const response = await fetch(TABULATOR_CSS_PATH);
            if (!response.ok) {
                throw new Error(`Failed to fetch Tabulator CSS: ${response.status}`);
            }
            const cssText = await response.text();

            const style = document.createElement('style');
            style.setAttribute('data-tabulator-theme', 'midnight');
            style.textContent = cssText;
            shadowRoot.appendChild(style);

            console.log('[PopupMixin] Tabulator CSS injected into Shadow DOM');
        } catch (e) {
            console.error('[PopupMixin] Failed to inject Tabulator CSS:', e);
            instance._popup.tabulatorCssInjected = false; // 실패 시 재시도 허용
        }
    }

    /**
     * Shadow DOM 내부에 Tabulator 인스턴스 생성
     *
     * @param {string} selector - 테이블 컨테이너 선택자
     * @param {Object} options - Tabulator 옵션 (columns, layout 등)
     * @returns {Object|null} Tabulator 인스턴스
     */
    instance.createTable = function(selector, options = {}) {
        if (instance._popup.tables.has(selector)) {
            return instance._popup.tables.get(selector).table;
        }

        const container = instance.popupQuery(selector);
        if (!container) {
            console.warn(`[PopupMixin] Table container not found: ${selector}`);
            return null;
        }

        // Tabulator 기본 CSS를 Shadow DOM에 주입
        injectTabulatorCSS();

        // 기본 옵션과 병합
        const defaultOptions = {
            layout: 'fitColumns',
            responsiveLayout: 'collapse',
        };

        // 초기화 상태 추적
        const tableState = { initialized: false };

        const table = new Tabulator(container, { ...defaultOptions, ...options });

        // tableBuilt 이벤트로 초기화 완료 감지
        table.on('tableBuilt', () => {
            tableState.initialized = true;
        });

        // ResizeObserver로 컨테이너 크기 변경 감지
        const resizeObserver = new ResizeObserver(() => {
            // Tabulator 초기화 완료 후에만 redraw
            if (tableState.initialized) {
                table.redraw();
            }
        });
        resizeObserver.observe(container);

        instance._popup.tables.set(selector, { table, resizeObserver, state: tableState });

        return table;
    };

    /**
     * 테이블 인스턴스 조회
     *
     * @param {string} selector - 테이블 컨테이너 선택자
     * @returns {Object|null} Tabulator 인스턴스
     */
    instance.getTable = function(selector) {
        return instance._popup.tables.get(selector)?.table || null;
    };

    /**
     * 테이블 초기화 완료 여부 확인
     *
     * @param {string} selector - 테이블 컨테이너 선택자
     * @returns {boolean} 초기화 완료 여부
     */
    instance.isTableReady = function(selector) {
        return instance._popup.tables.get(selector)?.state?.initialized || false;
    };

    /**
     * 테이블 데이터 업데이트
     *
     * @param {string} selector - 테이블 컨테이너 선택자
     * @param {Array} data - 테이블 데이터 배열
     */
    instance.updateTable = function(selector, data) {
        const table = instance.getTable(selector);
        if (!table) {
            console.warn(`[PopupMixin] Table not found: ${selector}`);
            return;
        }

        try {
            table.setData(data);
        } catch (e) {
            console.error(`[PopupMixin] Table setData error:`, e);
        }
    };

    /**
     * 테이블 옵션 업데이트 (columns 변경 등)
     *
     * @param {string} selector - 테이블 컨테이너 선택자
     * @param {Object} options - 업데이트할 옵션
     */
    instance.updateTableOptions = function(selector, options) {
        const table = instance.getTable(selector);
        if (!table) {
            console.warn(`[PopupMixin] Table not found: ${selector}`);
            return;
        }

        try {
            if (options.columns) {
                table.setColumns(options.columns);
            }
            if (options.data) {
                table.setData(options.data);
            }
        } catch (e) {
            console.error(`[PopupMixin] Table updateOptions error:`, e);
        }
    };

    // destroyPopup 확장 - 테이블 정리 추가
    const originalDestroyPopup = instance.destroyPopup;
    instance.destroyPopup = function() {
        // 테이블 정리
        fx.each(({ table, resizeObserver }) => {
            resizeObserver.disconnect();
            table.off();  // 이벤트 해제
            table.destroy();
        }, instance._popup.tables.values());
        instance._popup.tables.clear();

        // 원래 destroyPopup 호출 (차트, 이벤트, DOM 정리)
        originalDestroyPopup.call(instance);
    };
};
