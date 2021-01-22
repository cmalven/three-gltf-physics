import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import CANNON from 'cannon';

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
    this.floor;
    this.itemModel;
    this.clock;
    this.itemModels = [];
    this.threeItems = [];
    this.worldItems = [];
    this.debugItems = [];

    // Settings
    this.settings = {
      cameraDistance: 5,
      scalePeriod: 500,
      bgColor: 0xeeeeee,
      maxItemCount: 100,
    };

    this.init();
  }

  init = () => {
    this.createGui();
    this.createWorld();
    this.createApp();

    this.loader = new GLTFLoader();

    const itemPromises = [
      // 'pizzaBox',
      'pizza',
      // 'taco',
    ].map(itemName => {
      return new Promise(res => {
        this.loader.load(`/models/${itemName}.glb`, (gltf) => {
          this.itemModels.push(gltf.scene);
          res();
        });
      });
    });

    Promise.all(itemPromises).then(() => {
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

  createWorld = () => {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);

    // Physics Materials
    const defaultMaterial = new CANNON.Material('default');

    // Physics Contact Materials
    const contactMaterial = new CANNON.ContactMaterial(
      defaultMaterial,
      defaultMaterial,
      {
        friction: 0.1,
        restitution: 0.3,
      }
    );
    this.world.addContactMaterial(contactMaterial);
    this.world.defaultContactMaterial = contactMaterial;

    // Physics Floor
    const floorShape = new CANNON.Plane();
    const floorBody = new CANNON.Body();
    floorBody.mass = 0;
    floorBody.addShape(floorShape);
    floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI * 0.5);
    this.world.addBody(floorBody);
  }

  createApp = () => {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      devicePixelRatio: 1,
      antialias: true,
    });
    this.renderer.setSize(this.appContainer.offsetWidth, this.appContainer.offsetHeight);
    this.appContainer.appendChild(this.renderer.domElement);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Clock
    this.clock = new THREE.Clock();
    this.oldElapsedTime = 0;

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
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.far = 15;
    light.shadow.camera.left = - 7;
    light.shadow.camera.top = 7;
    light.shadow.camera.right = 7;
    light.shadow.camera.bottom = - 7;
    this.scene.add(light);
  }

  createItems = () => {
    // Floor
    this.floor = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(10, 10),
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        metalness: 0.01,
        roughness: 0.8,
      })
    );
    this.floor.receiveShadow = true;
    this.floor.rotation.x = - Math.PI * 0.5;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    // Food items
    window.setInterval(this.createFood, 200);
  }

  createFood = () => {
    if (this.threeItems.length >= this.settings.maxItemCount) return;

    const recurseChildren = child => {
      if (child.material) {
        child.material.metalness = 0;
        child.castShadow = true;
        child.receiveShadow = true;
      }

      if (child.children) {
        child.children.forEach(recurseChildren);
      }
    };

    // Get a random model and clone it
    const itemModel = this.itemModels[Math.floor(Math.random() * this.itemModels.length)];
    const model = itemModel.clone(true);

    // Adjust model so that it is centered at 0, 0
    const modelChild = model.children[0];
    const childBox = new THREE.Box3().setFromObject(modelChild);
    const childBoxCenter = childBox.getCenter(new THREE.Vector3());
    modelChild.position.set(
      modelChild.position.x - childBoxCenter.x,
      modelChild.position.y - childBoxCenter.y,
      modelChild.position.z - childBoxCenter.z
    );

    // Calculate the bounding box and size of the model
    const bbox = new THREE.Box3().setFromObject(model);
    const itemWidth = (bbox.max.x - bbox.min.x);
    const itemHeight = (bbox.max.y - bbox.min.y);
    const itemDepth = (bbox.max.z - bbox.min.z);

    // Create the THREE item
    recurseChildren(model);
    this.threeItems.push(model);
    this.scene.add(model);

    // Create the physics item
    const itemShape = new CANNON.Box(new CANNON.Vec3(itemWidth * 0.5, itemHeight * 0.5, itemDepth * 0.5));
    const itemBody = new CANNON.Body({
      mass: 1,
      position: new CANNON.Vec3(
        (Math.random() - 0.5) * 5,
        10,
        (Math.random() - 0.5) * 5,
      ),
      shape: itemShape,
    });
    this.world.addBody(itemBody);
    this.worldItems.push(itemBody);

    // Create the debug item
    const boxGeometry = new THREE.BoxBufferGeometry(itemWidth, itemHeight, itemDepth);
    const boxMaterial = new THREE.MeshStandardMaterial({
      metalness: 0.3,
      roughness: 0.4,
      transparent: true,
      opacity: 0.4,
    });
    const debugItem = new THREE.Mesh(boxGeometry, boxMaterial);
    this.debugItems.push(debugItem);
    this.scene.add(debugItem);
  }

  updateItems = () => {
    // Update physics items
    this.threeItems.forEach((item, idx) => {
      const worldItem = this.worldItems[idx];
      item.position.copy(worldItem.position);
      item.quaternion.copy(worldItem.quaternion);

      // Debug
      const debugItem = this.debugItems[idx];
      debugItem.position.copy(worldItem.position);
      debugItem.quaternion.copy(worldItem.quaternion);
    });
  }

  update = () => {
    const elapsedTime = this.clock.getElapsedTime();
    const deltaTime = elapsedTime - this.oldElapsedTime;
    this.oldElapsedTime = elapsedTime;

    // Update physics world
    this.world.step(1 / 60, deltaTime, 3);
  
    this.iter++;
    this.updateItems();
    this.renderer.render(this.scene, this.camera);
    window.requestAnimationFrame(this.update);
  }
}

export default ThreeSetup;