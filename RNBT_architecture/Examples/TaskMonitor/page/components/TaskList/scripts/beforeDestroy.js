/**
 * TaskList - Destroy Script
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
// TABULATOR CLEANUP
// ======================

if (this._tableInstance) {
    this._tableInstance.destroy();
    this._tableInstance = null;
}

// ======================
// HANDLER CLEANUP
// ======================

this.renderTable = null;
this.tableConfig = null;

console.log('[TaskList] Destroyed');
