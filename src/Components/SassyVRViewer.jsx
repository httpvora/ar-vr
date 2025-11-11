import React, { useRef, useEffect, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, OrbitControls } from "@react-three/drei";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";

// 3D GLB Model Loader
function SassyModel({ path }) {
  const { scene } = useGLTF(path);
  useEffect(() => {
    scene.scale.set(1, 1, 1);        // scale as needed
    scene.rotation.set(0, Math.PI, 0); // adjust facing
  }, [scene]);
  return <primitive object={scene} />;
}

export default function SassyVRViewer() {
  const mountRef = useRef();

  useEffect(() => {
    // Add VRButton to Canvas for VR entry
    if (!document.querySelector(".vr-button")) {
      const button = VRButton.createButton(mountRef.current.querySelector("canvas"));
      button.className = "vr-button";
      Object.assign(button.style, {
        position: "absolute",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        padding: "14px 28px",
        borderRadius: "9px",
        background: "#fff",
        color: "#222",
        fontWeight: "700",
        fontSize: "18px",
        zIndex: 12,
      });
      mountRef.current.appendChild(button);
    }
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: "100vw",
        height: "100vh",
        background: "#111",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Canvas
        camera={{ position: [0, 1.5, 3.5], fov: 65 }}
        style={{ width: "100vw", height: "100vh" }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
        }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[2, 5, 2]} intensity={1.2} />
        <Suspense fallback={null}>
          <SassyModel path="/sassy.glb" />
        </Suspense>
        <OrbitControls enablePan enableZoom enableRotate />
      </Canvas>
    </div>
  );
}
