    /*
     * UPS - 3D Popup Component
     *
     * applyShadowPopupMixin을 사용한 팝업 컴포넌트
     *
     * 핵심 구조:
     * 1. datasetInfo - 데이터 정의
     * 2. Data Config - API 필드 매핑
     * 3. 렌더링 함수 바인딩
     * 4. Public Methods - Page에서 호출
     * 5. customEvents - 이벤트 발행
     * 6. Template Data - HTML/CSS (publishCode에서 로드)
     * 7. Popup - template 기반 Shadow DOM 팝업
     */

    const { bind3DEvents, fetchData } = Wkit;
    const { applyShadowPopupMixin, applyEChartsMixin } = PopupMixin;

    const BASE_URL = 'http://10.23.128.140:8811';

    // ======================
    // TEMPLATE HELPER
    // ======================
    function extractTemplate(htmlCode, templateId) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlCode, 'text/html');
      const template = doc.querySelector(`template#${templateId}`);
      return template?.innerHTML || '';
    }

    initComponent.call(this);

    function initComponent() {
      // ======================
      // 1. 데이터 정의 (동적 assetKey 지원)
      // ======================
      this._defaultAssetKey = this.setter?.assetInfo?.assetKey || this.id;

      // 현재 활성화된 데이터셋 (통합 API 사용)
      this.datasetInfo = [
        { datasetName: 'assetDetailUnified', render: ['renderAssetInfo', 'renderProperties'] },  // 통합 API: asset + properties
        // { datasetName: 'upsHistory', render: ['renderChart'] },   // 차트 (추후 활성화)
      ];

      // ======================
      // 2. 변환 함수 바인딩
      // ======================
      this.statusTypeToLabel = statusTypeToLabel.bind(this);
      this.statusTypeToDataAttr = statusTypeToDataAttr.bind(this);
      this.formatDate = formatDate.bind(this);

      // ======================
      // 3. Data Config (Asset API v1 필드만 사용)
      // ======================
      // 헤더 영역 고정 필드
      this.baseInfoConfig = [
        { key: 'name', selector: '.ups-name' },
        { key: 'locationLabel', selector: '.ups-zone' },
        { key: 'statusType', selector: '.ups-status', transform: this.statusTypeToLabel },
        { key: 'statusType', selector: '.ups-status', dataAttr: 'status', transform: this.statusTypeToDataAttr },
      ];

      // 동적 필드 컨테이너 selector
      this.fieldsContainerSelector = '.fields-container';

      // chartConfig: 차트 렌더링 설정
      // - xKey: X축 데이터 키
      // - styleMap: 시리즈별 메타데이터 + 스타일 (키는 API 응답 필드명)
      this.chartConfig = {
        xKey: 'timestamps',
        styleMap: {
          load: { label: '부하율', unit: '%', color: '#3b82f6', smooth: true, areaStyle: true },
          battery: { label: '배터리', unit: '%', color: '#22c55e', smooth: true },
        },
        optionBuilder: getMultiLineChartOption,
      };

      // ======================
      // 4. 렌더링 함수 바인딩
      // ======================
      this.renderAssetInfo = renderAssetInfo.bind(this);    // 자산 기본 정보 (asset 객체)
      this.renderProperties = renderProperties.bind(this);  // 동적 프로퍼티 (properties 배열)
      this.renderChart = renderChart.bind(this, this.chartConfig);
      this.renderError = renderError.bind(this);            // 에러 상태 렌더링

      // ======================
      // 5. Public Methods
      // ======================
      this.showDetail = showDetail.bind(this);
      this.hideDetail = hideDetail.bind(this);

      // ======================
      // 6. 이벤트 발행
      // ======================
      this.customEvents = {
        click: '@assetClicked',
      };

      bind3DEvents(this, this.customEvents);

      // ======================
      // 7. Template Config
      // ======================
      this.templateConfig = {
        popup: 'popup-ups',
      };

      // ======================
      // 8. Popup (template 기반)
      // ======================
      this.popupCreatedConfig = {
        chartSelector: '.chart-container',
        events: {
          click: {
            '.close-btn': () => this.hideDetail(),
          },
        },
      };

      const { htmlCode, cssCode } = this.properties.publishCode || {};
      this.getPopupHTML = () => extractTemplate(htmlCode || '', this.templateConfig.popup);
      this.getPopupStyles = () => cssCode || '';
      this.onPopupCreated = onPopupCreated.bind(this, this.popupCreatedConfig);

      applyShadowPopupMixin(this, {
        getHTML: this.getPopupHTML,
        getStyles: this.getPopupStyles,
        onCreated: this.onPopupCreated,
      });

      applyEChartsMixin(this);

      console.log('[UPS] Registered:', this._defaultAssetKey);
    }

    // ======================
    // PUBLIC METHODS
    // ======================

    function showDetail() {
      this.showPopup();
      fx.go(
        this.datasetInfo,
        fx.each(({ datasetName, render }) =>
          fx.go(
            fetchData(this.page, datasetName, { baseUrl: BASE_URL, assetKey: this._defaultAssetKey, locale: 'ko' }),
            (response) => {
              // response가 없거나 response.response가 없는 경우 에러 표시
              if (!response || !response.response) {
                this.renderError('데이터를 불러올 수 없습니다.');
                return;
              }
              // response.response.data가 null/undefined인 경우 에러 표시
              if (response.response.data === null || response.response.data === undefined) {
                this.renderError('자산 정보가 존재하지 않습니다.');
                return;
              }
              fx.each((fn) => this[fn](response), render);
            }
          )
        )
      ).catch((e) => {
        console.error('[UPS]', e);
        this.renderError('데이터 로드 중 오류가 발생했습니다.');
      });
    }

    // 에러 상태 렌더링
    function renderError(message) {
      // 헤더 영역에 에러 표시
      const nameEl = this.popupQuery('.ups-name');
      const zoneEl = this.popupQuery('.ups-zone');
      const statusEl = this.popupQuery('.ups-status');

      if (nameEl) nameEl.textContent = '데이터 없음';
      if (zoneEl) zoneEl.textContent = message;
      if (statusEl) {
        statusEl.textContent = 'Error';
        statusEl.dataset.status = 'critical';
      }

      // fields-container에 에러 메시지 표시
      const container = this.popupQuery(this.fieldsContainerSelector);
      if (container) {
        container.innerHTML = `
          <div class="value-card" style="grid-column: 1 / -1; text-align: center;">
            <div class="value-label">오류</div>
            <div class="value-data" style="font-size: 14px; color: #ef4444;">${message}</div>
          </div>
        `;
      }

      console.warn('[UPS] renderError:', message);
    }

    // 자산 기본 정보 렌더링 (통합 API - data.asset)
    function renderAssetInfo({ response }) {
      const { data } = response;
      if (!data || !data.asset) {
        renderError.call(this, '자산 데이터가 없습니다.');
        return;
      }

      const asset = data.asset;

      // 헤더 영역 고정 필드 렌더링
      fx.go(
        this.baseInfoConfig,
        fx.each(({ key, selector, dataAttr, transform }) => {
          const el = this.popupQuery(selector);
          if (!el) return;
          let value = asset[key];
          if (transform) value = transform(value);
          if (dataAttr) {
            el.dataset[dataAttr] = value;
          } else {
            el.textContent = value;
          }
        })
      );
    }

    // 동적 프로퍼티 렌더링 (통합 API - data.properties[])
    function renderProperties({ response }) {
      const { data } = response;
      const container = this.popupQuery(this.fieldsContainerSelector);
      if (!container) return;

      // properties가 없거나 빈 배열인 경우
      if (!data?.properties || data.properties.length === 0) {
        container.innerHTML = `
          <div class="value-card" style="grid-column: 1 / -1; text-align: center;">
            <div class="value-label">알림</div>
            <div class="value-data" style="font-size: 14px; color: #6b7280;">프로퍼티 정보가 없습니다</div>
          </div>
        `;
        return;
      }

      // displayOrder로 정렬된 properties 배열을 카드로 렌더링
      const sortedProperties = [...data.properties].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

      container.innerHTML = sortedProperties
        .map(({ label, value, helpText }) => {
          return `<div class="value-card" title="${helpText || ''}">
            <div class="value-label">${label}</div>
            <div class="value-data">${value ?? '-'}</div>
          </div>`;
        })
        .join('');
    }

    // 날짜 포맷 함수
    function formatDate(dateStr) {
      if (!dateStr) return '-';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
      } catch {
        return dateStr;
      }
    }

    function renderChart(config, { response }) {
      const { data } = response;
      if (!data) {
        console.warn('[UPS] renderChart: data is null');
        return;
      }
      if (!data[config.xKey]) {
        console.warn('[UPS] renderChart: chart data is incomplete');
        return;
      }
      const { optionBuilder, ...chartConfig } = config;
      const option = optionBuilder(chartConfig, data);
      this.updateChart('.chart-container', option);
    }

    function hideDetail() {
      this.hidePopup();
    }

    // ======================
    // STATUS TRANSFORM
    // ======================

    function statusTypeToLabel(statusType) {
      const labels = {
        ACTIVE: 'Normal',
        WARNING: 'Warning',
        CRITICAL: 'Critical',
        INACTIVE: 'Inactive',
        MAINTENANCE: 'Maintenance',
      };
      return labels[statusType] || statusType;
    }

    function statusTypeToDataAttr(statusType) {
      const map = {
        ACTIVE: 'normal',
        WARNING: 'warning',
        CRITICAL: 'critical',
        INACTIVE: 'inactive',
        MAINTENANCE: 'maintenance',
      };
      return map[statusType] || 'normal';
    }

    // ======================
    // CHART OPTION BUILDER
    // ======================

    function getMultiLineChartOption(config, data) {
      const { xKey, styleMap } = config;

      // styleMap 기반으로 series 생성
      const seriesData = Object.entries(styleMap).map(([key, style]) => ({
        key,
        name: style.label,
        unit: style.unit,
        color: style.color,
        smooth: style.smooth,
        areaStyle: style.areaStyle,
      }));

      return {
        grid: { left: 45, right: 16, top: 30, bottom: 24 },
        legend: {
          data: seriesData.map((s) => s.name),
          top: 0,
          textStyle: { color: '#8892a0', fontSize: 11 },
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#1a1f2e',
          borderColor: '#2a3142',
          textStyle: { color: '#e0e6ed', fontSize: 12 },
        },
        xAxis: {
          type: 'category',
          data: data[xKey],
          axisLine: { lineStyle: { color: '#333' } },
          axisLabel: { color: '#888', fontSize: 10 },
        },
        yAxis: {
          type: 'value',
          min: 0,
          max: 100,
          axisLine: { show: false },
          axisLabel: { color: '#888', fontSize: 10, formatter: '{value}%' },
          splitLine: { lineStyle: { color: '#333' } },
        },
        series: seriesData.map(({ key, name, color, smooth, areaStyle }) => ({
          name,
          type: 'line',
          data: data[key],
          smooth,
          symbol: 'none',
          lineStyle: { color, width: 2 },
          areaStyle: areaStyle
            ? {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: hexToRgba(color, 0.3) },
                    { offset: 1, color: hexToRgba(color, 0) },
                  ],
                },
              }
            : null,
        })),
      };
    }

    function hexToRgba(hex, alpha) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // ======================
    // POPUP LIFECYCLE
    // ======================

    function onPopupCreated({ chartSelector, events }) {
      chartSelector && this.createChart(chartSelector);
      events && this.bindPopupEvents(events);
    }