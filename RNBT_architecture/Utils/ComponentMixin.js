/*
 * ComponentMixin.js
 *
 * 컴포넌트 기능 확장을 위한 Mixin 모음
 *
 * ─────────────────────────────────────────────────────────────
 * 뷰어 전용 라이프사이클 훅 (2D/3D 공통)
 * ─────────────────────────────────────────────────────────────
 *
 * _onViewerReady()
 *   - 뷰어 모드에서만 실행 (WScript register 직전)
 *   - WScript register에서 옮겨온 뷰어 전용 로직 배치
 *
 * _onViewerDestroy()
 *   - 뷰어 모드에서만 실행 (WScript BEFORE_DESTROY 직후)
 *   - WScript beforeDestroy에서 옮겨온 뷰어 전용 정리 로직 배치
 *
 *   예시:
 *     _onViewerReady() {
 *       const chart = echarts.init(this.appendElement.querySelector('#echarts'));
 *       this.chart = chart;
 *     }
 *
 *     _onViewerDestroy() {
 *       this.chart.dispose();
 *       this.chart = null;
 *     }
 *
 * ─────────────────────────────────────────────────────────────
 * ModelLoaderMixin - 3D ModelLoader 컴포넌트 Mixin
 * ─────────────────────────────────────────────────────────────
 *
 * 용도: WV3DResourceComponent 기반 3D 컴포넌트에 ModelLoader 기능 추가
 *
 * 사용법:
 *   class My3DComponent extends WV3DResourceComponent {
 *     constructor() {
 *       super();
 *       ComponentMixin.applyModelLoaderMixin(this);
 *     }
 *   }
 *
 * ─────────────────────────────────────────────────────────────
 */

const ComponentMixin = {};

/**
 * ModelLoader 기반 3D 컴포넌트 Mixin
 *
 * WV3DResourceComponent를 상속받은 컴포넌트에 ModelLoader 기능을 추가합니다.
 * - selectItem, _invalidateSelectItem, selected, _onCommitProperties는
 *   WV3DResourceComponent에서 처리됩니다.
 *
 * @param {Object} instance - 컴포넌트 인스턴스 (this)
 */
ComponentMixin.applyModelLoaderMixin = function(instance) {
  /**
   * 리소스 검증 및 로드
   * - selectItem 기반으로 OBJ/GLTF/GLB 파일 로드
   */
  instance._validateResource = async function() {
    function convertServerPath(str) {
      if (str.indexOf('http') <= -1) {
        return wemb.configManager.serverUrl + str;
      }
    }

    let info = instance.selectItem;
    instance.removePrevResource();

    // 초기 리로드 로드 후 아이템이 변경된 거면 기본 사이즈 정보 제거
    if (info == null || info == '') {
      instance._onCreateElement();
      instance._elementSize = null;
      instance.opacity = 100;
      instance.color = '#ffffff';
      instance.size = instance.getDefaultProperties().setter.size;
    }

    if (info) {
      try {
        if (info.mapPath.substr(-1) != '/') {
          info.mapPath += '/';
        }
        let loadedObj = null;
        if (info.path.includes('.obj')) {
          loadedObj = await NLoaderManager.composeResource(info, true).catch((err) => {
            throw new Error(err);
          });
        } else if (info.path.includes('.gltf') || info.path.includes('.glb')) {
          loadedObj = await NLoaderManager.loadGLTF(info, true).catch((err) => {
            throw new Error(err);
          });
          instance.animations = NLoaderManager.getAnimationPool(convertServerPath(info.path));
        }
        instance.composeResource(loadedObj);
        instance._onValidateResource();
        requestAnimationFrame(() => {
          if (!instance.appendElement) return;
          instance.applyThreejsProperties(instance.getGroupProperties('threeJsProperties'))
          instance.applyDepthRelatedToTransparent(loadedObj);
        }
      );
      } catch (error) {
        throw error;
      }
    }
  };

  /**
   * 리소스 로드 시작
   */
  instance.startLoadResource = async function() {
    try {
      if (instance.selectItem) {
        await instance._validateResource().catch((err) => {
          throw new Error(err);
        });
      }
    } catch (error) {
      console.log('startLoadResource-error ', error);
    } finally {
      instance.resourceBus.$emit(window.WeMB.WVComponentEvent.LOADED_RESOURCE, instance);
    }
  };

  /**
   * 투명 재질에 depth 관련 속성 적용
   */
  instance.applyDepthRelatedToTransparent = function(obj) {
    obj.traverse((obj) => {
      if (obj.isMesh && obj.material.transparent) {
        obj.material.depthWrite = false;
        obj.material.depthTest = true;
        obj.material.needsUpdate = true;
      }
    });
  };
};
