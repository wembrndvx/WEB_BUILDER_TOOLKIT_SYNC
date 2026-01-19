/**
 * StatusChart - Destroy Script
 */

const { unsubscribe } = GlobalDataPublisher;
const { each } = fx;

// ======================
// SUBSCRIPTION CLEANUP
// ======================

if (this.subscriptions) {
    fx.go(
        Object.keys(this.subscriptions),
        each(topic => unsubscribe(topic, this))
    );
    this.subscriptions = null;
}

// ======================
// RESIZE OBSERVER CLEANUP
// ======================

if (this._resizeObserver) {
    this._resizeObserver.disconnect();
    this._resizeObserver = null;
}

// ======================
// ECHARTS CLEANUP
// ======================

if (this._chartInstance) {
    this._chartInstance.dispose();
    this._chartInstance = null;
}

// ======================
// HANDLER CLEANUP
// ======================

this.renderChart = null;
this.chartConfig = null;

console.log('[StatusChart] Destroyed');
