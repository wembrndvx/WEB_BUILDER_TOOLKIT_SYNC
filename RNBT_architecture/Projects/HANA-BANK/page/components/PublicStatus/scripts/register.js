/**
 * PublicStatus Component - register.js
 *
 * 책임:
 * - Public 현황 대시보드 카드 렌더링
 * - 금일건수 표시
 * - 전일/금일 비교 라인 차트 (ECharts)
 *
 * Subscribes to: TBD_publicStatus
 * Events: 없음
 */

const { subscribe } = GlobalDataPublisher;

// ==================
// CONFIG
// ==================

const config = {
    selectors: {
        todayCount: '.public-status__info-value',
        chartContainer: '.public-status__chart-container'
    },
    fields: {
        todayCount: 'TBD_todayCount'
    },
    chart: {
        xKey: 'TBD_timestamps',
        series: [
            { yKey: 'TBD_yesterday', name: '전일', color: '#038c8c' },
            { yKey: 'TBD_today', name: '금일', color: '#5bdcc6' }
        ],
        yAxis: {
            min: 0,
            max: 800,
            interval: 200
        }
    }
};

// ==================
// ECHARTS INIT
// ==================

const chartContainer = this.appendElement.querySelector(config.selectors.chartContainer);
this.chartInstance = echarts.init(chartContainer);

// ==================
// BINDINGS
// ==================

this.renderData = renderData.bind(this, config);
this.renderChart = renderChart.bind(this, config);

// ==================
// SUBSCRIPTIONS
// ==================

this.subscriptions = {
    TBD_publicStatus: ['renderData', 'renderChart']
};

fx.go(
    Object.entries(this.subscriptions),
    fx.each(([topic, fnList]) =>
        fx.each(fn => this[fn] && subscribe(topic, this, this[fn]), fnList)
    )
);

console.log('[PublicStatus] Registered');

// ==================
// RENDER FUNCTIONS
// ==================

/**
 * 헤더 정보 렌더링 (금일건수)
 *
 * @param {Object} config - Field Config
 * @param {Object} param - API 응답 { response: { data } }
 */
function renderData(config, { response }) {
    const { data } = response;
    if (!data) return;

    const root = this.appendElement;
    const todayCountEl = root.querySelector(config.selectors.todayCount);

    if (todayCountEl) {
        const count = data[config.fields.todayCount];
        todayCountEl.textContent = count != null ? count.toLocaleString() : '-';
    }

    console.log('[PublicStatus] Data rendered');
}

/**
 * ECharts 라인 차트 렌더링
 *
 * @param {Object} config - Chart Config
 * @param {Object} param - API 응답 { response: { data } }
 */
function renderChart(config, { response }) {
    const { data } = response;
    if (!data || !this.chartInstance) return;

    const timestamps = data[config.chart.xKey] || [];
    const seriesData = config.chart.series.map(s => ({
        name: s.name,
        type: 'line',
        data: data[s.yKey] || [],
        smooth: true,
        symbol: 'none',
        lineStyle: {
            color: s.color,
            width: 2
        },
        itemStyle: {
            color: s.color
        },
        areaStyle: {
            color: s.areaColor || s.color,
            opacity: 0.3
        }
    }));

    const option = {
        grid: {
            left: 40,
            right: 10,
            top: 10,
            bottom: 30,
            containLabel: false
        },
        xAxis: {
            type: 'category',
            data: timestamps,
            axisLine: {
                show: false
            },
            axisTick: {
                show: false
            },
            axisLabel: {
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: 13,
                fontFamily: 'Pretendard, sans-serif'
            },
            splitLine: {
                show: false
            }
        },
        yAxis: {
            type: 'value',
            min: config.chart.yAxis.min,
            max: config.chart.yAxis.max,
            interval: config.chart.yAxis.interval,
            axisLine: {
                show: false
            },
            axisTick: {
                show: false
            },
            axisLabel: {
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: 13,
                fontFamily: 'Pretendard, sans-serif'
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: 'rgba(255, 255, 255, 0.1)',
                    type: 'dashed'
                }
            }
        },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(0, 145, 120, 0.2)',
            borderColor: 'transparent',
            textStyle: {
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                fontFamily: 'Pretendard, sans-serif'
            },
            axisPointer: {
                type: 'line',
                lineStyle: {
                    color: 'rgba(0, 145, 120, 0.5)',
                    width: 2.5
                }
            },
            formatter: function(params) {
                if (!params || params.length === 0) return '';
                const value = params[0].value;
                return `<span style="font-weight: 600;">${value}</span>`;
            }
        },
        series: seriesData
    };

    this.chartInstance.setOption(option, true);

    console.log('[PublicStatus] Chart rendered');
}
