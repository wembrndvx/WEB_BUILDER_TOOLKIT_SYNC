/*
 * PDU - Destroy Script
 * 컴포넌트 정리 (Shadow DOM 팝업 + 차트)
 */

if (this._stopConnection) this._stopConnection();
this.stopRefresh();
this.destroyPopup();

// 캐시 데이터 해제
this._trendData = null;
this._trendDataComparison = null;

console.log('[PDU] Destroyed:', this._defaultAssetKey);
