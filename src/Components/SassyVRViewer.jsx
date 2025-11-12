import React, { useRef, useEffect, useState, Suspense } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

function ProductModel({ glbPath = "/sassy.glb" }) {
  const groupRef = useRef();

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load(
      glbPath,
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(0.35, 0.35, 0.35);
        model.rotation.set(0, Math.PI, 0);
        model.position.set(0, -0.5, -1);
        groupRef.current.add(model);
      },
      undefined,
      (error) => console.error("Error loading model:", error)
    );
  }, [glbPath]);

  return <group ref={groupRef} />;
}

function ARController({ modelGroupRef }) {
  const { gl } = useThree();

  useEffect(() => {
    const onStart = () => {
      const model = modelGroupRef.current;
      if (model) {
        model.position.set(0, -0.5, -1);
        model.rotation.set(0, Math.PI, 0);
      }
    };

    gl.xr.addEventListener("sessionstart", onStart);
    return () => gl.xr.removeEventListener("sessionstart", onStart);
  }, [gl, modelGroupRef]);

  return null;
}

export default function ARProductViewer({ glbPath = "/sassy.glb" }) {
  const mountRef = useRef(null);
  const modelGroupRef = useRef(new THREE.Group());
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    async function requestCameraPermission() {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        setPermissionGranted(true);
      } catch (err) {
        console.error("Camera permission denied:", err);
        alert("Please allow camera access to use AR features.");
      }
    }
    requestCameraPermission();
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        background: "#000",
      }}
    >
      {permissionGranted ? (
        <Canvas
          camera={{ position: [0, 1.6, 0], fov: 70 }}
          onCreated={({ gl }) => {
            gl.xr.enabled = true;
            gl.setSize(window.innerWidth, window.innerHeight);
            gl.setClearColor(0x000000, 0); // Transparent background

            if (!document.querySelector(".ar-button")) {
              const button = ARButton.createButton(gl, {
                requiredFeatures: ["hit-test"],
                optionalFeatures: ["dom-overlay", "local-floor"],
                domOverlay: { root: mountRef.current },
              });
              button.classList.add("ar-button");
              Object.assign(button.style, {
                position: "absolute",
                bottom: "20px",
                left: "50%",
                transform: "translateX(-50%)",
                padding: "10px 20px",
                borderRadius: "10px",
                background: "#fff",
                color: "#000",
                fontWeight: "600",
                zIndex: 10,
              });
              mountRef.current.appendChild(button);
            }
          }}
        >
          <ambientLight intensity={1} />
          <directionalLight position={[0, 5, 5]} intensity={1.2} />

          <group ref={modelGroupRef}>
            <Suspense fallback={null}>
              <ProductModel glbPath={glbPath} />
            </Suspense>
          </group>

          <ARController modelGroupRef={modelGroupRef} />
        </Canvas>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            color: "#fff",
            fontSize: "18px",
            textAlign: "center",
          }}
        >
          Requesting camera permission...
        </div>
      )}
    </div>
  );
}
