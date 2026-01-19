/**
 * Sidebar - Destroy Script
 */

const { removeCustomEvents } = Wkit;
const { unsubscribe } = GlobalDataPublisher;
const { each } = fx;

// ======================
// INTERNAL HANDLERS CLEANUP
// ======================

if (this._internalHandlers) {
    const root = this.appendElement;

    root.querySelectorAll('.filter-select').forEach(select => {
        select.removeEventListener('change', this._internalHandlers.selectChange);
    });

    root.querySelector('.btn-reset')?.removeEventListener('click', this._internalHandlers.reset);
    root.querySelector('.btn-apply')?.removeEventListener('click', this._internalHandlers.applyClick);

    this._internalHandlers = null;
}

// ======================
// CUSTOM EVENTS CLEANUP
// ======================

if (this.customEvents) {
    removeCustomEvents(this, this.customEvents);
    this.customEvents = null;
}

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
// STATE CLEANUP
// ======================

this._currentFilters = null;
this.renderFilters = null;

console.log('[Sidebar] Destroyed');
