// 小智数字人 VRM 渲染核心
// 不影响任何原有功能，独立运行
import * as THREE from 'three';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

let currentVrm = null;

// 初始化3D数字人
export function initAvatar(containerId, isCircle = false) {
  const scene = new THREE.Scene();
  scene.background = isCircle ? null : new THREE.Color(0xfff5e6);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 1.2, 3.5);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });
  renderer.setPixelRatio(window.devicePixelRatio);

  const container = document.getElementById(containerId);
  if (!container) return;

  const size = isCircle ? 180 : 200;
  renderer.setSize(size, size);
  container.appendChild(renderer.domElement);

  // 灯光
  const light = new THREE.DirectionalLight(0xffffff, 1.2);
  light.position.set(1, 1, 1);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  // 加载模型
  const loader = new THREE.GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));

  loader.load('/shuziren/xiaozhi.vrm', (gltf) => {
    const vrm = gltf.userData.vrm;
    VRMUtils.rotateVRM0(vrm);
    scene.add(vrm.scene);

    currentVrm = vrm;
    window.currentVRM = vrm;

    const scale = isCircle ? 0.65 : 0.75;
    vrm.scene.scale.set(scale, scale, scale);

    // 自动呼吸+微动
    function animate() {
      requestAnimationFrame(animate);
      if (vrm) {
        vrm.update(0.016);
      }
      renderer.render(scene, camera);
    }
    animate();
  });
}

// 表情控制
export function setExpression(name) {
  if (!currentVrm || !currentVrm.expressionManager) return;
  const expr = currentVrm.expressionManager;
  expr.setValue('Neutral', 0);
  expr.setValue('Happy', 0);
  expr.setValue('Sad', 0);
  expr.setValue('Angry', 0);
  expr.setValue('Surprised', 0);

  switch (name) {
    case 'happy': expr.setValue('Happy', 1); break;
    case 'sad': expr.setValue('Sad', 1); break;
    case 'surprised': expr.setValue('Surprised', 1); break;
    default: expr.setValue('Neutral', 1);
  }
}

// 自动加载
window.initAvatar = initAvatar;
window.setExpression = setExpression;