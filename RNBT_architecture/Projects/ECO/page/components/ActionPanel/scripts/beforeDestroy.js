/*
 * ActionPanel Component - beforeDestroy
 * 대시보드 액션 버튼 패널 (ECO)
 */

const { removeCustomEvents } = Wkit;

// ======================
// EVENT CLEANUP
// ======================

removeCustomEvents(this, this.customEvents);
this.customEvents = null;

// ======================
// DATA REFRESH TIMER CLEANUP
// ======================

if (this._dataRefreshId) {
  clearInterval(this._dataRefreshId);
  this._dataRefreshId = null;
}

// ======================
// DATA LABELS CLEANUP
// ======================

if (this._dataLabels) {
  this._dataLabels.forEach(function (entry) {
    if (entry.css2dObject) {
      if (entry.instance && entry.instance.appendElement) {
        entry.instance.appendElement.remove(entry.css2dObject);
      }
      if (entry.css2dObject.element && entry.css2dObject.element.parentNode) {
        entry.css2dObject.element.parentNode.removeChild(entry.css2dObject.element);
      }
    }
  });
  this._dataLabels = null;
}

// ======================
// HEATMAP CLEANUP
// ======================

if (this._centerInstance && this._centerInstance._heatmap && this._centerInstance._heatmap.visible) {
  this._centerInstance.destroyHeatmap();
}

// ======================
// INTERNAL HANDLER CLEANUP
// ======================

const root = this.appendElement;
if (this._internalHandlers) {
  const panel = root?.querySelector('.action-panel');
  if (panel) panel.removeEventListener('click', this._internalHandlers.btnClick);
}

// ======================
// STATE CLEANUP
// ======================

this._internalHandlers = null;
this._centerInstance = null;
this._heatmapApplied = false;
this._activeModes = null;
this._centerComponentName = null;
this._refreshInterval = null;
this._dataLabels = null;
this._dataRefreshId = null;

console.log('[ActionPanel] Destroyed');
