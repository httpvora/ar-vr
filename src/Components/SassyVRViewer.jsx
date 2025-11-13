import React, { useRef, useEffect, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function ProductModel({ glbPath = "/sassy.glb", isARMode }) {
  const groupRef = useRef();
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    
    // Use fetch to load the GLB file
    fetch(glbPath)
      .then(response => response.arrayBuffer())
      .then(buffer => {
        // Create a THREE.js loader
        const loader = new THREE.Loader();
        loader.setPath('');
        
        // Parse GLB manually using DataView
        const dataView = new DataView(buffer);
        
        // Simple GLB parser for basic models
        // This is a minimal implementation - for complex models, you'd need full GLB parsing
        const decoder = new TextDecoder();
        
        // For now, create a simple placeholder geometry
        // You can replace this with your actual GLB parsing logic
        const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const material = new THREE.MeshStandardMaterial({ 
          color: 0xcccccc,
          roughness: 0.5,
          metalness: 0.5
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.set(-0.3, -1, 0);
        
        setModel(mesh);
        setLoading(false);
        
        if (groupRef.current) {
          // Clear previous children
          while (groupRef.current.children.length > 0) {
            groupRef.current.remove(groupRef.current.children[0]);
          }
          groupRef.current.add(mesh);
        }
      })
      .catch(error => {
        console.error("Error loading model:", error);
        // Create fallback geometry
        const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const mesh = new THREE.Mesh(geometry, material);
        setModel(mesh);
        setLoading(false);
        if (groupRef.current) {
          groupRef.current.add(mesh);
        }
      });

    return () => {
      if (model) {
        if (model.geometry) model.geometry.dispose();
        if (model.material) {
          if (Array.isArray(model.material)) {
            model.material.forEach(mat => mat.dispose());
          } else {
            model.material.dispose();
          }
        }
      }
    };
  }, [glbPath]);

  return (
    <group ref={groupRef} position={isARMode ? [0, -0.5, -1.5] : [0, 0, 0]}>
      {loading && (
        <mesh>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshBasicMaterial color={0x00ff00} wireframe />
        </mesh>
      )}
    </group>
  );
}

function ARScene({ glbPath, isARActive }) {
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 5, 5]} intensity={2} />
      <directionalLight position={[-5, 3, -5]} intensity={1} />
      <ProductModel glbPath={glbPath} isARMode={isARActive} />
    </>
  );
}

export default function ARProductViewer({ glbPath = "/sassy.glb" }) {
  const [isARActive, setIsARActive] = useState(false);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState("");
  const glRef = useRef(null);

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  const startAR = async () => {
    try {
      setDebugInfo("Checking WebXR support...");
      
      if (!navigator.xr) {
        throw new Error("WebXR not supported. Please use Chrome on Android or Safari on iOS 12+");
      }

      setDebugInfo("Checking AR session support...");
      const isSupported = await navigator.xr.isSessionSupported("immersive-ar");
      
      if (!isSupported) {
        throw new Error("AR not supported on this device. Requires ARCore (Android) or ARKit (iOS)");
      }

      setDebugInfo("Starting AR session...");
      
      const sessionInit = {
        requiredFeatures: ["local"],
        optionalFeatures: ["hit-test", "dom-overlay"],
      };

      if (document.body) {
        sessionInit.domOverlay = { root: document.body };
      }

      const session = await navigator.xr.requestSession("immersive-ar", sessionInit);
      
      if (!glRef.current) {
        throw new Error("WebGL context not ready");
      }

      await glRef.current.xr.setSession(session);
      setIsARActive(true);
      setDebugInfo("");

      session.addEventListener("end", () => {
        setIsARActive(false);
        setDebugInfo("");
      });

    } catch (err) {
      console.error("AR Error:", err);
      setError(err.message || "Failed to start AR");
      setDebugInfo(err.message || "Unknown error");
    }
  };

  if (error) {
    return (
      <div style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "#000",
        color: "#fff",
        padding: "20px",
        textAlign: "center",
        fontFamily: "system-ui, -apple-system, sans-serif"
      }}>
        <div style={{ fontSize: "48px", marginBottom: "20px" }}>⚠️</div>
        <div style={{ fontSize: "18px", maxWidth: "400px", marginBottom: "20px" }}>{error}</div>
        <div style={{ fontSize: "14px", color: "#888", maxWidth: "500px", lineHeight: "1.6" }}>
          <strong>Requirements:</strong><br/>
          • Android: Chrome 79+ with ARCore<br/>
          • iOS: Safari 13+ with ARKit<br/>
          • Must be served over HTTPS<br/><br/>
          <strong>Quick Test:</strong><br/>
          Use Chrome on Android with ARCore installed
        </div>
        <button 
          onClick={() => {
            setError(null);
            setDebugInfo("");
          }}
          style={{
            marginTop: "20px",
            padding: "12px 24px",
            background: "#fff",
            color: "#000",
            border: "none",
            borderRadius: "8px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: "pointer"
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      position: "fixed",
      top: 0,
      left: 0,
      background: "#000",
      overflow: "hidden"
    }}>
      <Canvas
        camera={{ position: [0, 1.6, 3], fov: 45 }}
        gl={{ 
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance"
        }}
        onCreated={({ gl }) => {
          glRef.current = gl;
          gl.xr.enabled = true;
          gl.setPixelRatio(window.devicePixelRatio);
          gl.setSize(window.innerWidth, window.innerHeight);
        }}
      >
        <ARScene glbPath={glbPath} isARActive={isARActive} />
      </Canvas>

      {!isARActive && (
        <>
          <div style={{
            position: "fixed",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.8)",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: "20px",
            fontSize: "14px",
            zIndex: 1000,
            maxWidth: "90%",
            textAlign: "center"
          }}>
            {debugInfo || "3D Model Preview - Tap START AR to view in your space"}
          </div>

          <button
            onClick={startAR}
            style={{
              position: "fixed",
              bottom: "40px",
              left: "50%",
              transform: "translateX(-50%)",
              padding: "16px 40px",
              fontSize: "18px",
              fontWeight: "700",
              color: "#000",
              background: "#fff",
              border: "none",
              borderRadius: "30px",
              cursor: "pointer",
              zIndex: 9999,
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              fontFamily: "system-ui, -apple-system, sans-serif",
              minWidth: "200px"
            }}
          >
            START AR
          </button>
        </>
      )}

      {isARActive && (
        <div style={{
          position: "fixed",
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,255,0,0.2)",
          color: "#fff",
          padding: "8px 16px",
          borderRadius: "20px",
          fontSize: "12px",
          zIndex: 1000,
          border: "2px solid rgba(0,255,0,0.5)"
        }}>
          ✓ AR Active - Point at a surface
        </div>
      )}

      <div style={{
        position: "fixed",
        bottom: "100px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,0,0,0.6)",
        color: "#fff",
        padding: "8px 16px",
        borderRadius: "12px",
        fontSize: "11px",
        zIndex: 999,
        textAlign: "center"
      }}>
        Note: Using placeholder geometry<br/>
        Replace with your actual GLB file
      </div>
    </div>
  );
}