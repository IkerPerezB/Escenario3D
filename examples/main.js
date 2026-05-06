import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// 1. VARIABLES GLOBALES
let scene, camera, renderer, controls;
let boxPersonaje = new THREE.Box3();
let murosColision = [];
// 1. VARIABLES GLOBALES
const teclas = { w: false, a: false, s: false, d: false }; // <-- NUEVA VARIABLE
let personajeOcupado = false;
let luzFuego;
let mixerBandera;
let mixer, character;
let clock = new THREE.Clock();

// Variables de animación
let currentAction;
let animCaminar, animRecargar, animDisparar, animIdle;
let animCaminarAtras, animCaminarIzq, animCaminarDer;

// Variables de sonido
let sonidoRecarga, sonidoDisparo;

init();
animate();

function init() {
    const container = document.getElementById('canvas-container');

    // --- ESCENA Y NIEBLA ---
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xcccccc, 10, 50); // Requerimiento: Niebla gris clara [cite: 16]

    // --- RENDERER ---
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight - 80); // Ajuste por el footer
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    // --- CÁMARA ---
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / (window.innerHeight - 80), 0.1, 100);
    camera.position.set(0, 3, -8);

    // --- CONTROLES DE CÁMARA ---
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.update();

    // --- ILUMINACIÓN Y HDR ---
    cargarHDR();
    
    // Iluminación extra para asegurar que las sombras se vean bien [cite: 15]
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // --- ENTORNO Y OBJETOS ---
    crearPiso();
    cargarObjetosFisicos();
    crearFronteras();

    // --- CARGAR PERSONAJE FBX ---
    cargarPersonajeFBX();

    // --- CONFIGURAR AUDIO ---
    configurarAudio();

    // --- EVENTOS ---
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
}

function cargarHDR() {
    // Requerimiento: Ambiente 360 HDR 
    new RGBELoader()
        .setPath('models/rgbe/')
        .load('preller_drive_4k.hdr', function (texture) {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            scene.background = texture;
            scene.environment = texture; // Da iluminación realista al personaje
        });
}

function crearPiso() {
    const texturaPiso = new THREE.TextureLoader().load('models/textures/textpasto.jpg');
    texturaPiso.wrapS = THREE.RepeatWrapping;
    texturaPiso.wrapT = THREE.RepeatWrapping;
    texturaPiso.repeat.set(10, 10); // Repetir la textura para que no se vea estirada

    const materialPiso = new THREE.MeshStandardMaterial({ 
        map: texturaPiso,
        roughness: 0.8
    });

    const meshPiso = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), materialPiso);
    meshPiso.rotation.x = -Math.PI / 2;
    meshPiso.receiveShadow = true;
    scene.add(meshPiso);
}

function cargarObjetosFisicos() {
    // Requerimiento: Mínimo 5 elementos 3D [cite: 17]
    const geoCaja = new THREE.BoxGeometry(1, 1, 1);
    const matCaja = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    
    
}

function cargarMuro(x, z, rotacionY) {
    const loader = new GLTFLoader();
    
    // Ruta basada en tu carpeta models/gltf/
    loader.load('models/gltf/paredRocosa.glb', function (gltf) {
        const muro = gltf.scene;
        
        // Ajustar escala (los modelos de Sketchfab a veces vienen muy grandes)
        muro.scale.set(0.25, 0.25, 0.25); 
        
        // Posicionar según los parámetros que le pases a la función
        muro.position.set(x, 0, z);
        muro.rotation.y = rotacionY;

        // Configurar sombras [cite: 15]
        muro.traverse(function (child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        scene.add(muro);
        muro.updateMatrixWorld(true);

        // 2. Recorremos todas las piezas del modelo para crearles su caja
        muro.traverse(function (child) {
            if (child.isMesh) {
                // Creamos la caja exacta para esta pieza
                const cajaObstaculo = new THREE.Box3().setFromObject(child);
                // La metemos a nuestra lista global
                murosColision.push(cajaObstaculo);
            }
        });
        
        // IMPORTANTE PARA COLISIONES: 
        // Aquí guardaremos la "caja invisible" del muro más adelante
        // murosColision.push(new THREE.Box3().setFromObject(muro));
        
    }, undefined, function (error) {
        console.error('Error al cargar el muro:', error);
    });
}

// Ejemplo para colocar 5 muros en diferentes posiciones
cargarMuro(-15, 0, 0);
cargarMuro(-15, -15, 0);
cargarMuro(-10, 15, Math.PI / 2);
cargarMuro(5, 15, Math.PI / 2);
//cargarMuro(-5, -5, Math.PI / 10);

// Asegúrate de tener este arreglo declarado arriba en tu archivo (en la sección de variables globales)
// let murosColision = [];

function cargarBarrera(x, z, rotacionY) {
    const loader = new GLTFLoader();
    
    loader.load('models/gltf/barricadas.glb', function (gltf) {
        const barricada = gltf.scene;
        
        // Ajustar escala y posición
        barricada.scale.set(0.005, 0.005, 0.005); 
        barricada.position.set(x, 0, z);
        barricada.rotation.y = rotacionY;

        scene.add(barricada);
        
        // 1. IMPORTANTE: Forzar actualización de coordenadas antes de calcular colisiones
        barricada.updateMatrixWorld(true);

        // 2. Configurar sombras y crear las "cajas invisibles" individuales
        barricada.traverse(function (child) {
            if (child.isMesh) {
                // Sombras
                child.castShadow = true;
                child.receiveShadow = true;
                // 3. Crear caja de colisión para esta pieza en específico (tarima, muro, etc.)
                const cajaIndividual = new THREE.Box3().setFromObject(child);
                // 4. Guardarla en nuestra lista global de colisiones
                murosColision.push(cajaIndividual);
            }
        });
        
    }, undefined, function (error) {
        console.error('Error al cargar barricada:', error);
    });
}

// Puedes llamarla múltiples veces para armar tu escenario
cargarBarrera(5, 0, 0);
cargarBarrera(-5, 0, -5);

function cargarFogata(x, z) {
    const loader = new GLTFLoader();
    
    loader.load('models/gltf/campfire.glb', function (gltf) {
        const fogata = gltf.scene;
        
        // Ajustamos posición
        fogata.position.set(x, 0, z);
        // Si el modelo es muy pequeño o grande, ajusta estos valores:
        fogata.scale.set(1, 1, 1); 
        
        scene.add(fogata);
        
        // 1. Actualizar posición para colisiones
        fogata.updateMatrixWorld(true);

        // 2. Crear las cajas de colisión para los troncos
        fogata.traverse(function (child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                // Agregamos la colisión a la misma lista global de los muros
                const cajaFogata = new THREE.Box3().setFromObject(child);
                murosColision.push(cajaFogata);
            }
        });

        // 3. MAGIA: Agregamos la luz dinámica del fuego
        // Color naranja (0xff5500), intensidad 2, distancia 10
        luzFuego = new THREE.PointLight(0xff6600, 2, 15);
        luzFuego.position.set(x, 1.5, z); // La luz sale del centro de la fogata
        luzFuego.castShadow = true;
        luzFuego.shadow.mapSize.width = 1024;
        luzFuego.shadow.mapSize.height = 1024;
        scene.add(luzFuego);

    }, undefined, function (error) {
        console.error('Error al cargar la fogata:', error);
    });
}

// Llama a la función en tu init() para probarla:
cargarFogata(-5, 7, 3);

function crearFronteras() {
    const tamañoMundo = 50; // El mismo tamaño que tu PlaneGeometry del piso
    const grosor = 2;        // Grosor de la pared invisible
    const alto = 10;         // Que sea alta para que el personaje no la salte
    
    // Usamos un material y le decimos visible: false para que no se vea en el juego
    const geoFronteraHoriz = new THREE.BoxGeometry(tamañoMundo, alto, grosor);
    const geoFronteraVert = new THREE.BoxGeometry(grosor, alto, tamañoMundo);
    const matFrontera = new THREE.MeshBasicMaterial({ visible: false }); 

    // 1. Frontera Norte (Fondo)
    const muroNorte = new THREE.Mesh(geoFronteraHoriz, matFrontera);
    muroNorte.position.set(0, alto/2, -tamañoMundo/2);
    muroNorte.updateMatrixWorld(true);
    murosColision.push(new THREE.Box3().setFromObject(muroNorte));

    // 2. Frontera Sur (Frente)
    const muroSur = new THREE.Mesh(geoFronteraHoriz, matFrontera);
    muroSur.position.set(0, alto/2, tamañoMundo/2);
    muroSur.updateMatrixWorld(true);
    murosColision.push(new THREE.Box3().setFromObject(muroSur));

    // 3. Frontera Este (Derecha)
    const muroEste = new THREE.Mesh(geoFronteraVert, matFrontera);
    muroEste.position.set(tamañoMundo/2, alto/2, 0);
    muroEste.updateMatrixWorld(true);
    murosColision.push(new THREE.Box3().setFromObject(muroEste));

    // 4. Frontera Oeste (Izquierda)
    const muroOeste = new THREE.Mesh(geoFronteraVert, matFrontera);
    muroOeste.position.set(-tamañoMundo/2, alto/2, 0);
    muroOeste.updateMatrixWorld(true);
    murosColision.push(new THREE.Box3().setFromObject(muroOeste));
    
    // (Opcional: Si quieres ver las paredes para probar que están bien puestas, 
    // cambia visible: false a visible: true temporalmente)
    // scene.add(muroNorte); scene.add(muroSur); scene.add(muroEste); scene.add(muroOeste);
}

function cargarBandera(x, z) {
    const loader = new GLTFLoader();
    const texturaBanderaMex = new THREE.TextureLoader().load('models/textures/bandera.jpg');
    texturaBanderaMex.flipY = true;
    // Ajusta el nombre del archivo según como lo hayas guardado
    loader.load('models/gltf/bandera.glb', function (gltf) {
        const bandera = gltf.scene;
        bandera.position.set(x, 0, z);
        bandera.scale.set(0.005, 0.005, 0.005); 

        bandera.traverse(function (child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                console.log("Pieza de la bandera: ", child.name);
                //Object_7
                if(child.name === 'Object_7'){
                    const materialTela = new THREE.MeshStandardMaterial({
                        map: texturaBanderaMex,
                        roughness: 0.8,
                        side: THREE.DoubleSide
                    });
                    child.material = materialTela;
                }
            }
        });

        scene.add(bandera);

        // --- CONFIGURAR LA ANIMACIÓN DE LA BANDERA ---
        // Verificamos si el modelo trae animaciones incluidas
        if (gltf.animations && gltf.animations.length > 0) {
            mixerBandera = new THREE.AnimationMixer(bandera);
            // Tomamos la primera animación (ondear) y la reproducimos
            const animacionOndear = mixerBandera.clipAction(gltf.animations[0]);
            animacionOndear.play();
        }

        // --- COLISIÓN (Opcional) ---
        // Si quieres que el personaje choque contra el mástil de la bandera:
        bandera.updateMatrixWorld(true);
        const cajaBandera = new THREE.Box3().setFromObject(bandera);
        murosColision.push(cajaBandera);

    }, undefined, function (error) {
        console.error('Error al cargar la bandera:', error);
    });
}
cargarBandera(6, 10);

function cargarPersonajeFBX() {
    // Requerimiento: Personaje con 3 secuencias de movimiento
    const loader = new FBXLoader();
    loader.setPath('models/fbx/');
    
    // 1. CARGAMOS EL MODELO BASE (Usaremos Strafe como el cuerpo principal)
    loader.load('RelaxPose.fbx', function (object) {
        character = object;
        character.scale.set(0.01, 0.01, 0.01); // Ajuste típico para Mixamo
        
        character.traverse(function (child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        scene.add(character);

        // Configuramos el Mixer en el modelo base
        mixer = new THREE.AnimationMixer(character);
        // --- NUEVO: ESCUCHAR CUANDO TERMINA UNA ACCIÓN ÚNICA ---
        mixer.addEventListener('finished', function(e) {
            if (e.action === animRecargar || e.action === animDisparar) {
                personajeOcupado = false; // Liberamos al personaje
                
                // Evaluamos si el jugador se quedó presionando alguna tecla de movimiento
                if (teclas.w) cambiarAnimacion(animCaminar);
                else if (teclas.s) cambiarAnimacion(animCaminarAtras);
                else if (teclas.a) cambiarAnimacion(animCaminarIzq);
                else if (teclas.d) cambiarAnimacion(animCaminarDer);
                else cambiarAnimacion(animIdle); // Si no tocaba nada, regresa a relax
            }
        });
        
        // Extraemos la animación de Strafe (que viene en el índice 0 de este archivo)
        animIdle = mixer.clipAction(object.animations[0]);
        
        // Iniciamos con la animación de caminar
        animIdle.play();
        currentAction = animIdle;

        loader.load('Walk Forward.fbx', (obj) => {
            animCaminar = mixer.clipAction(obj.animations[0]);
        });
        loader.load('Walking Backwards.fbx', (obj) => {
            animCaminarAtras = mixer.clipAction(obj.animations[0]);
        });
        loader.load('Walk Right.fbx', (obj) => {
            animCaminarDer = mixer.clipAction(obj.animations[0]);
        });
        loader.load('Walk Left.fbx', (obj) => {
            animCaminarIzq = mixer.clipAction(obj.animations[0]);
        });

        // 2. CARGAMOS LA ANIMACIÓN DE RECARGA
        loader.load('Reloading.fbx', function (reloadingObject) {
            // No agregamos reloadingObject a la escena, solo le robamos la animación
            animRecargar = mixer.clipAction(reloadingObject.animations[0]);
            // Hacemos que la recarga se ejecute una sola vez y no en bucle
            animRecargar.setLoop(THREE.LoopOnce);
            animRecargar.clampWhenFinished = true; // Se queda en el último frame al terminar
        });

        // 3. CARGAMOS LA ANIMACIÓN DE DISPARO
        loader.load('Gunplay.fbx', function (gunplayObject) {
            // Igual que antes, solo extraemos la animación
            animDisparar = mixer.clipAction(gunplayObject.animations[0]);
            animDisparar.setLoop(THREE.LoopOnce);
            animDisparar.clampWhenFinished = true;
            // Opcional: Si el disparo es de un solo tiro, quitar el bucle.
            // animDisparar.setLoop(THREE.LoopOnce);
        });
    });
}

function configurarAudio() {
    const listener = new THREE.AudioListener();
    camera.add(listener);

    sonidoDisparo = new THREE.Audio(listener);
    sonidoRecarga = new THREE.Audio(listener);

    const audioLoader = new THREE.AudioLoader();
    
    // Cargar tus audios exactos
    audioLoader.load('models/rgbe/DisparoSound.mp3', function(buffer) { 
        sonidoDisparo.setBuffer(buffer); 
        sonidoDisparo.setVolume(0.7); 
    });
    
    audioLoader.load('models/rgbe/RecargaSound.mp3', function(buffer) { 
        sonidoRecarga.setBuffer(buffer); 
        sonidoRecarga.setVolume(0.7); 
    });
}

function onKeyDown(event) {
    if(!character) return;
    const key = event.key.toLowerCase();
    
    // Si la tecla presionada es w, a, s, d, la marcamos como "encendida" (true)
    if (teclas.hasOwnProperty(key)) {
        teclas[key] = true;
    }
    if (personajeOcupado) return;

    switch(key) {
        case 'q':
            // Rotación matemática limpia, sin interrumpir la animación actual
            character.rotation.y += Math.PI / 2;
            break;
        case 'e':
            character.rotation.y -= Math.PI / 2;
            break;
        case 'r':
            personajeOcupado = true; // Bloquea el movimiento
            cambiarAnimacion(animRecargar);
            if(sonidoRecarga && !sonidoRecarga.isPlaying) sonidoRecarga.play();
            break;
        case 'f':
            personajeOcupado = true; // Bloquea el movimiento
            cambiarAnimacion(animDisparar);
            if(sonidoDisparo && !sonidoDisparo.isPlaying) sonidoDisparo.play();
            break;
    }
}

function onKeyUp(event) {
    if(!character) return;
    const key = event.key.toLowerCase();
    
    // Al soltar la tecla, la marcamos como "apagada" (false)
    if (teclas.hasOwnProperty(key)) {
        teclas[key] = false;
        
        // Si ya soltamos TODAS las teclas de movimiento, volvemos a la animación Idle
        if (!personajeOcupado && !teclas.w && !teclas.a && !teclas.s && !teclas.d) {
            cambiarAnimacion(animIdle);
        }
    }
}

function intentarMover(deltaX, deltaZ, animacionNueva) {
    // 1. Cambiamos a la animación correspondiente
    cambiarAnimacion(animacionNueva);
    
    // 2. Movemos al personaje
    character.translateZ(deltaZ);
    character.translateX(deltaX);

    // 3. Revisamos si con ese movimiento chocó con algo
    boxPersonaje.setFromObject(character);
    let hayColision = false;
    for(let i = 0; i < murosColision.length; i++){
        if(boxPersonaje.intersectsBox(murosColision[i])){
            hayColision = true;
            break;
        }
    }

    // 4. Si chocó, lo regresamos a donde estaba (anulamos el movimiento)
    if(hayColision){
        character.translateZ(-deltaZ);
        character.translateX(-deltaX);
    }
}

// Función auxiliar para transiciones fluidas entre animaciones 
function cambiarAnimacion(nuevaAccion) {
    if (!nuevaAccion || currentAction === nuevaAccion) return;
    
    nuevaAccion.reset();
    nuevaAccion.play();
    currentAction.crossFadeTo(nuevaAccion, 0.2, true);
    currentAction = nuevaAccion;
}

function onWindowResize() {
    // Reajustar la cámara si cambia el tamaño de la ventana
    camera.aspect = window.innerWidth / (window.innerHeight - 80);
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight - 80);
}

function animate() {
    requestAnimationFrame(animate);

    if(luzFuego){
        luzFuego.intensity = 3 + Math.random()*2;
    }

    const delta = clock.getDelta();
    
    // --- NUEVA LÓGICA DE MOVIMIENTO CONTINUO ---
    if (character && !personajeOcupado) {
        // Velocidad basada en el tiempo (delta) para que se mueva igual en cualquier PC
        const velocidad = 1.0 * delta; 

        if (teclas.w) intentarMover(0, velocidad, animCaminar);
        if (teclas.s) intentarMover(0, -velocidad, animCaminarAtras);
        if (teclas.a) intentarMover(velocidad, 0, animCaminarIzq); 
        if (teclas.d) intentarMover(-velocidad, 0, animCaminarDer);
    }
    // -------------------------------------------

    if (mixer) mixer.update(delta); // Actualizar animaciones
    if (mixerBandera) mixerBandera.update(delta);

    renderer.render(scene, camera);
}