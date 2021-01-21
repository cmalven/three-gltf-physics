import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Boilerplate module using THREE.js
 */

class ThreeSetup {
  constructor(options = {
    appContainerSelector: '[data-app-container]',
  }) {
    this.options = options;
    this.appContainer = document.querySelector(this.options.appContainerSelector);
    this.iter = 0;

    // THREE items
    this.renderer;
    this.camera;
    this.scene;
    this.loader;
    this.controls;
    this.tacoModel;
    this.models = [];

    // Settings
    this.settings = {
      cameraDistance: 5,
      scalePeriod: 500,
      bgColor: 0xeeeeee,
      modelCount: 10,
    };

    this.init();
  }

  init = () => {
    this.createGui();
    this.createApp();

    this.loader = new GLTFLoader();
    this.loader.load('/models/pizza.glb', (gltf) => {
      this.tacoModel = gltf;
      for (var idx = 0, length = this.settings.modelCount; idx < length; idx++) {
        this.models.push(this.tacoModel.scene.clone(true));
      }
      this.createItems();
      this.update();
    });
  }

  createGui = () => {
    if (!window.APP.gui) return;

    const folder = window.APP.gui.setFolder('ThreeExample');
    folder.open();

    window.APP.gui.add(this.settings, 'scalePeriod', 1, 1000);
  }

  createApp = () => {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      devicePixelRatio: 1.5,
      antialias: false,
    });
    this.renderer.setSize(this.appContainer.offsetWidth, this.appContainer.offsetHeight);
    this.appContainer.appendChild(this.renderer.domElement);

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, this.appContainer.offsetWidth / this.appContainer.offsetHeight, 1, 10000);
    this.camera.position.set(-3, 2, this.settings.cameraDistance);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.settings.bgColor);

    // Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableKeys = false;
    this.controls.enableZoom = false;
    this.controls.enableDamping = false;

    // Resize the renderer on window resize
    window.addEventListener('resize', () => {
      this.camera.aspect = this.appContainer.offsetWidth / this.appContainer.offsetHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.appContainer.offsetWidth, this.appContainer.offsetHeight);
    }, true);

    // Ambient Light
    let ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Directional Light
    let light = new THREE.DirectionalLight(0xffffff, 0.8);
    light.position.set(-1, 1, 1);
    this.scene.add(light);
    // const helper = new THREE.DirectionalLightHelper(light);
    // this.scene.add(helper);
  }

  createItems = () => {
    const recurseChildren = child => {
      if (child.material) {
        child.material.metalness = 0;
      }

      if (child.children) {
        child.children.forEach(recurseChildren);
      }
    };

    // Add all models
    this.models.forEach(model => {
      recurseChildren(model);

      this.scene.add(model);
      const scale = Math.random() * 2 + 0.5;
      model.scale.set(scale, scale, scale);
      model.position.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
      );
      model.rotation.set(Math.random() * 20, Math.random() * 20, Math.random() * 20);
      model.fallSpeed = model.scale.x * 0.05;
    });
  }

  updateItems = () => {
    this.models.forEach(model => {
      model.rotation.x += 0.01;
      model.rotation.y += 0.01;
      model.rotation.z += 0.01;

      const bounds = 10;
      if (model.position.y > -bounds) {
        model.position.y -= model.fallSpeed;
      } else {
        model.position.y += bounds*2;
      }
    });
  }

  update = () => {
    this.iter++;
    this.updateItems();
    this.renderer.render(this.scene, this.camera);
    window.requestAnimationFrame(this.update);
  }
}

export default ThreeSetup;