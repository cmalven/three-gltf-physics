import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import debounce from 'lodash.debounce';
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
    this.cursorMesh;
    this.cursorBody;
    this.itemModel;
    this.clock;
    this.itemModels = [];
    this.threeItems = [];
    this.worldItems = [];
    this.debugItems = [];

    this.mouse = new THREE.Vector2();

    // Settings
    this.settings = {
      cameraDistance: 5,
      bgColor: 0xeeeeee,
      maxItemCount: 100,
      gravity: 8,
      bounce: 0.3,
      startY: 10,
      cursorSize: 0.9,
      'more food': this.foodSplat,
      reset: this.reset,
    };

    this.init();
  }

  reset = () => {
    this.worldItems.forEach(item => {
      item.position.y = this.settings.startY + Math.random() * this.settings.startY * 2;
      item.position.x = (Math.random() - 0.5) * 5;
      item.position.z = (Math.random() - 0.5) * 5;
    });
  }

  init = () => {
    this.createGui();
    this.createWorld();
    this.createApp();

    this.loader = new GLTFLoader();

    const itemPromises = [
      // 'pizzaBox',
      'pizza',
      'taco',
      'sub',
      'bottleKetchup',
      'bottleMusterd',
    ].map(itemName => {
      return new Promise(res => {
        this.loader.load(`/models/${itemName}.glb`, (gltf) => {
          this.prepModel(gltf.scene);
          this.itemModels.push(gltf.scene);
          res();
        });
      });
    });

    Promise.all(itemPromises).then(() => {
      this.createItems();
      this.addEvents();
      this.update();
    });
  }

  prepModel = (gltfModel) => {
    const recursivelyUpdateModelChildren = child => {
      if (child.material) {
        child.material.metalness = 0;
        child.castShadow = true;
        child.receiveShadow = true;
      }

      if (child.children) {
        child.children.forEach(recursivelyUpdateModelChildren);
      }
    };

    // Adjust model so that it is centered at 0, 0
    const modelChild = gltfModel.children[0];
    const childBox = new THREE.Box3().setFromObject(modelChild);
    const childBoxCenter = childBox.getCenter(new THREE.Vector3());
    modelChild.position.set(
      modelChild.position.x - childBoxCenter.x,
      modelChild.position.y - childBoxCenter.y,
      modelChild.position.z - childBoxCenter.z
    );

    recursivelyUpdateModelChildren(gltfModel);
  }

  addEvents = () => {
    window.addEventListener('mousemove', evt => {
      this.mouse.x = evt.clientX / this.appContainer.offsetWidth * 2 - 1;
      this.mouse.y = - (evt.clientY / this.appContainer.offsetHeight) * 2 + 1;
    });
  }

  createGui = () => {
    if (!window.APP.gui) return;

    const folder = window.APP.gui.setFolder('THREE');
    folder.open();

    window.APP.gui.add(this.settings, 'gravity', 0.1, 10).onChange(debounce(this.updateWorld, 300));
    window.APP.gui.add(this.settings, 'bounce', 0.01, 1).onChange(debounce(this.updateWorld, 300));

    window.APP.gui.add(this.settings, 'more food');
    window.APP.gui.add(this.settings, 'reset');
  }

  updateWorld = () => {
    this.world.gravity.y = -this.settings.gravity;
    this.world.defaultContactMaterial.restitution = this.settings.bounce;
  }

  createWorld = () => {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -this.settings.gravity, 0);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);

    // Physics Materials
    const defaultMaterial = new CANNON.Material('default');

    // Physics Contact Materials
    const contactMaterial = new CANNON.ContactMaterial(
      defaultMaterial,
      defaultMaterial,
      {
        friction: 0.1,
        restitution: this.settings.bounce,
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

    // Physics cursor
    const cursorShape = new CANNON.Sphere(this.settings.cursorSize);
    this.cursorBody = new CANNON.Body();
    this.cursorBody.mass = 0;
    this.cursorBody.addShape(cursorShape);
    this.world.addBody(this.cursorBody);
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
    light.shadow.camera.near = -6;
    light.shadow.camera.left = -6;
    light.shadow.camera.right = 6;
    light.shadow.camera.far = 9;
    this.scene.add(light);

    // Camera light helper
    // const lightCameraHelper = new THREE.CameraHelper(light.shadow.camera);
    // this.scene.add(lightCameraHelper);

    // Raycaster
    this.raycaster = new THREE.Raycaster();

  }

  createItems = () => {
    // Floor
    this.floor = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(20, 20),
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

    // Create the cursor
    const cursorGeometry = new THREE.SphereBufferGeometry(this.settings.cursorSize, 20, 20);
    const cursorMaterial = new THREE.MeshStandardMaterial({
      metalness: 0.3,
      roughness: 0.4,
      transparent: true,
      opacity: 0.1,
    });
    this.cursorMesh = new THREE.Mesh(cursorGeometry, cursorMaterial);
    this.scene.add(this.cursorMesh);

    // Food items
    window.setInterval(() => {
      if (this.threeItems.length >= this.settings.maxItemCount) return;
      this.createFood();
    }, 200);
  }

  foodSplat = () => {
    const numFood = 30;
    const delay = 150;
    for (let idx = 0, length = numFood; idx < length; idx++) {
      window.setTimeout(this.createFood, delay * idx);
    }
  }

  createFood = () => {
    // Get a random model and clone it
    const itemModel = this.itemModels[Math.floor(Math.random() * this.itemModels.length)];
    const model = itemModel.clone(true);

    // Calculate the bounding box and size of the model
    const bbox = new THREE.Box3().setFromObject(model);
    const itemWidth = (bbox.max.x - bbox.min.x);
    const itemHeight = (bbox.max.y - bbox.min.y);
    const itemDepth = (bbox.max.z - bbox.min.z);

    // Create the THREE item
    this.threeItems.push(model);
    this.scene.add(model);

    // Create the physics item
    const itemShape = new CANNON.Box(new CANNON.Vec3(itemWidth * 0.5, itemHeight * 0.5, itemDepth * 0.5));
    const itemBody = new CANNON.Body({
      mass: 1,
      position: new CANNON.Vec3(
        (Math.random() - 0.5) * 5,
        this.settings.startY,
        (Math.random() - 0.5) * 5,
      ),
      shape: itemShape,
    });
    itemBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-Math.random(), 0, 0), Math.PI * 0.5);
    this.world.addBody(itemBody);
    this.worldItems.push(itemBody);

    // Create the debug item
    // const boxGeometry = new THREE.BoxBufferGeometry(itemWidth, itemHeight, itemDepth);
    // const boxMaterial = new THREE.MeshStandardMaterial({
    //   metalness: 0.3,
    //   roughness: 0.4,
    //   transparent: true,
    //   opacity: 0.4,
    // });
    // const debugItem = new THREE.Mesh(boxGeometry, boxMaterial);
    // this.debugItems.push(debugItem);
    // this.scene.add(debugItem);
  }

  updateItems = () => {
    // Physics cursor
    this.cursorMesh.position.copy(this.cursorBody.position);
    this.cursorMesh.quaternion.copy(this.cursorBody.quaternion);

    // Update physics items
    this.threeItems.forEach((item, idx) => {
      const worldItem = this.worldItems[idx];
      item.position.copy(worldItem.position);
      item.quaternion.copy(worldItem.quaternion);

      // Debug
      // const debugItem = this.debugItems[idx];
      // debugItem.position.copy(worldItem.position);
      // debugItem.quaternion.copy(worldItem.quaternion);
    });
  }

  updateMouseRays = () => {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObject(this.floor);

    for(const intersect of intersects) {
      this.cursorBody.position.x = intersect.point.x;
      this.cursorBody.position.z = intersect.point.z;
    }
  }

  update = () => {
    const elapsedTime = this.clock.getElapsedTime();
    const deltaTime = elapsedTime - this.oldElapsedTime;
    this.oldElapsedTime = elapsedTime;

    // Update mouserays
    this.updateMouseRays();

    // Update physics world
    this.world.step(1 / 60, deltaTime, 3);
  
    this.iter++;
    this.updateItems();
    this.renderer.render(this.scene, this.camera);
    window.requestAnimationFrame(this.update);
  }
}

export default ThreeSetup;