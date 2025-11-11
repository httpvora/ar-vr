import React, { useRef, useEffect, useState, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

/*
  Usage notes (see README below after the component):
  - Install: npm i three @react-three/fiber @react-three/drei
  - Put your GLB at /public/sassy.glb or change the glbPath prop
  - This component requests camera permission on mount, then enables AR (if available)
  - Falls back to desktop preview with orbit controls
*/

function ProductModel({ glbPath = "/sassy.glb", onLoaded }) {
  const ref = useRef();

  useEffect(() => {
    let mounted = true;
    const loader = new GLTFLoader();
    loader.load(
      glbPath,
      (gltf) => {
        if (!mounted) return;
        const model = gltf.scene;
        model.scale.set(0.35, 0.35, 0.35);
        model.rotation.set(0, Math.PI, 0);
        model.position.set(0, -0.5, 0);
        // center model geometry if needed
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);

        ref.current.clear();
        ref.current.add(model);
        onLoaded && onLoaded(model);
      },
      undefined,
      (err) => {
        console.error("GLB load error:", err);
      }
    );

    return () => {
      mounted = false;
      // dispose children geometries/materials if desired
      if (ref.current) {
        ref.current.clear();
      }
    };
  }, [glbPath, onLoaded]);

  return <group ref={ref} />;
}

function ARController({ modelRef, enabled }) {
  const { camera, gl } = useThree();
  const inAR = useRef(false);

  useFrame(() => {
    const model = modelRef.current;
    if (!model) return;

    if (inAR.current) {
      // place 1.2m in front of the camera and keep fixed orientation
      const distance = 1.2;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const position = camera.position.clone().add(forward.multiplyScalar(distance));
      model.position.lerp(position, 0.35); // smooth placement
      model.rotation.set(0, Math.PI, 0);
    } else {
      // Desktop rotation preview
      model.rotation.y += 0.005;
    }
  });

  useEffect(() => {
    const onStart = () => (inAR.current = true);
    const onEnd = () => (inAR.current = false);
    gl.xr.addEventListener("sessionstart", onStart);
    gl.xr.addEventListener("sessionend", onEnd);
    return () => {
      gl.xr.removeEventListener("sessionstart", onStart);
      gl.xr.removeEventListener("sessionend", onEnd);
    };
  }, [gl]);

  return null;
}

export default function ARProductViewer({ glbPath = "/sassy.glb" }) {
  const mountRef = useRef(null);
  const modelGroupRef = useRef(new THREE.Group());
  const [cameraPermission, setCameraPermission] = useState("idle"); // idle | granted | denied
  const [arSupported, setArSupported] = useState(null);
  const [showCanvas, setShowCanvas] = useState(false);

  // Ask for camera permission up-front so mobile browsers prompt the user early.
  useEffect(() => {
    let canceled = false;

    async function requestCamera() {
      try {
        // Some browsers will reject without secure context; this will prompt permission in supporting browsers
        await navigator.mediaDevices.getUserMedia({ video: true });
        if (!canceled) setCameraPermission("granted");
      } catch (err) {
        console.warn("Camera permission denied or not available:", err);
        if (!canceled) setCameraPermission("denied");
      }
    }

    requestCamera();

    return () => {
      canceled = true;
    };
  }, []);

  // Detect WebXR AR support
  useEffect(() => {
    let canceled = false;
    if (!navigator.xr) {
      setArSupported(false);
      return;
    }
    navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
      if (!canceled) setArSupported(Boolean(supported));
    }).catch((e) => {
      console.warn("XR check failed:", e);
      if (!canceled) setArSupported(false);
    });
    return () => { canceled = true; };
  }, []);

  // When camera permission resolved, show canvas so Canvas doesn't try to open XR without permission
  useEffect(() => {
    if (cameraPermission === "granted" || cameraPermission === "denied") {
      setShowCanvas(true);
    }
  }, [cameraPermission]);

  // Create AR button after the canvas is created
  useEffect(() => {
    if (!mountRef.current) return;
    let arButton;

    const tryCreate = () => {
      // guard so we only add button when WebXR is supported and gl context will be present
      const glCanvas = mountRef.current.querySelector("canvas");
      if (!glCanvas) return;
      const gl = glCanvas.getContext("webgl2") || glCanvas.getContext("webgl");
      if (!gl) return;

      if (arSupported) {
        try {
          arButton = ARButton.createButton(gl, { optionalFeatures: ["dom-overlay", "local-floor"], domOverlay: { root: document.body } });
          arButton.classList.add("ar-button");
          Object.assign(arButton.style, {
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "10px 18px",
            borderRadius: "8px",
            background: "#fff",
            color: "#000",
            fontWeight: "600",
            zIndex: 10,
          });
          mountRef.current.appendChild(arButton);
        } catch (e) {
          console.warn("Failed to create AR button:", e);
        }
      }
    };

    // attempt repeatedly for a short time until canvas appears (Canvas mounts asynchronously)
    const id = setInterval(tryCreate, 300);
    // one final attempt after 1.5s
    const timeout = setTimeout(tryCreate, 1500);

    return () => {
      clearInterval(id);
      clearTimeout(timeout);
      if (arButton && arButton.parentNode) arButton.parentNode.removeChild(arButton);
    };
  }, [showCanvas, arSupported]);

  return (
    <div
      ref={mountRef}
      style={{ width: "100vw", height: "100vh", position: "relative", background: "#000" }}
    >
      {!showCanvas && (
        <div style={{ color: "#fff", position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, marginBottom: 8 }}>Requesting camera permission...</div>
            <div style={{ opacity: 0.8, fontSize: 14 }}>
              Please allow camera access so AR can work. If you denied it, refresh and allow camera from browser settings.
            </div>
          </div>
        </div>
      )}

      {showCanvas && (
        <Canvas camera={{ position: [0, 1, 3], fov: 60 }} onCreated={({ gl }) => { gl.setPixelRatio(window.devicePixelRatio); gl.setSize(window.innerWidth, window.innerHeight); gl.xr.enabled = true; }}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[2, 5, 2]} intensity={1.0} />

          <group ref={modelGroupRef}>
            <Suspense fallback={null}>
              <ProductModel glbPath={glbPath} onLoaded={() => {}} />
            </Suspense>
          </group>

          {/* Desktop controls/fallback */}
          <OrbitControls enablePan={true} enableZoom={true} />

          <ARController modelRef={modelGroupRef} />
        </Canvas>
      )}

      {/* Small status badge */}
      <div style={{ position: "absolute", top: 14, left: 14, zIndex: 11 }}>
        <div style={{ padding: "6px 10px", background: "rgba(0,0,0,0.5)", color: "#fff", borderRadius: 8, fontSize: 13 }}>
          Camera: {cameraPermission}
          {arSupported === null ? " · checking AR..." : arSupported ? " · AR supported" : " · AR not supported"}
        </div>
      </div>
    </div>
  );
}

/*
  README / Quick instructions

  1) Install dependencies:
     npm install three @react-three/fiber @react-three/drei

  2) Place this file in your React app (e.g. src/components/ARProductViewer.jsx)

  3) Make sure the GLB exists at public/sassy.glb or pass a glbPath prop:
     <ARProductViewer glbPath="/models/myModel.glb" />

  4) Serve your app over HTTPS / localhost (WebXR and camera require secure context).

  Notes & behavior:
  - On mount this component requests camera permission using navigator.mediaDevices.getUserMedia.
    This prompts the user for camera access up-front which mobile browsers show earlier.
  - After permission resolves, a three.js canvas is mounted. If the device supports WebXR immersive-ar,
    an AR button will be appended to the DOM (bottom center). Tapping it will start an AR session.
  - If AR is not supported you still get an interactive 3D preview with OrbitControls.
  - The model is positioned ~1.2m in front of the camera once the AR session starts.

  Browser support & testing tips:
  - Test on an AR-capable mobile device (Android Chrome with WebXR ARCore; iOS Safari has limited WebXR support).
  - Use HTTPS (or localhost) because camera and WebXR require secure context.
*/
