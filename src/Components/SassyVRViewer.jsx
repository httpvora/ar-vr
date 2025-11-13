import React, { useRef, useEffect, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function ProductModel({ glbPath = "/sassy.glb", isARMode }) {
  const groupRef = useRef();
  const [model, setModel] = useState(null);

  useEffect(() => {
    const loader = new THREE.GLTFLoader();
    loader.load(
      glbPath,
      (gltf) => {
        const loadedModel = gltf.scene;
        
        // Center the model
        const box = new THREE.Box3().setFromObject(loadedModel);
        const center = box.getCenter(new THREE.Vector3());
        loadedModel.position.sub(center);
        
        // Scale appropriately for AR
        loadedModel.scale.set(0.3, 0.3, 0.3);
        
        // Set rotation for better viewing angle
        loadedModel.rotation.set(-0.3, -1, 0);
        
        setModel(loadedModel);
        if (groupRef.current) {
          groupRef.current.add(loadedModel);
        }
      },
      undefined,
      (error) => console.error("Error loading model:", error)
    );

    return () => {
      if (model) {
        model.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      }
    };
  }, [glbPath]);

  // Position model in front of camera in AR mode
  useFrame(({ camera }) => {
    if (isARMode && groupRef.current && model) {
      // Place model 1.5 meters in front of camera at eye level
      const offset = new THREE.Vector3(0, 0, -1.5);
      offset.applyQuaternion(camera.quaternion);
      groupRef.current.position.copy(camera.position).add(offset);
      groupRef.current.position.y = camera.position.y - 0.5; // Slightly below eye level
    }
  });

  return <group ref={groupRef} />;
}

function ARScene({ glbPath }) {
  const { gl, scene, camera } = useThree();
  const [isARActive, setIsARActive] = useState(false);
  const hitTestSourceRef = useRef(null);
  const hitTestSourceRequestedRef = useRef(false);
  const reticleRef = useRef(null);

  useEffect(() => {
    // Create reticle (placement indicator)
    const reticleGeometry = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
    const reticleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);
    reticleRef.current = reticle;

    // AR session start handler
    const onSessionStart = async () => {
      setIsARActive(true);
      const session = gl.xr.getSession();
      
      session.addEventListener("end", () => {
        setIsARActive(false);
        hitTestSourceRequestedRef.current = false;
        hitTestSourceRef.current = null;
      });

      // Request hit test source
      session.requestReferenceSpace("viewer").then((refSpace) => {
        session.requestHitTestSource({ space: refSpace }).then((source) => {
          hitTestSourceRef.current = source;
        });
      });

      hitTestSourceRequestedRef.current = true;
    };

    gl.xr.addEventListener("sessionstart", onSessionStart);

    return () => {
      gl.xr.removeEventListener("sessionstart", onSessionStart);
      if (reticle) {
        scene.remove(reticle);
        reticleGeometry.dispose();
        reticleMaterial.dispose();
      }
    };
  }, [gl, scene]);

  // Handle hit testing in AR
  useFrame((state, delta) => {
    if (!isARActive) return;

    const session = gl.xr.getSession();
    if (session && hitTestSourceRef.current) {
      const frame = state.gl.xr.getFrame();
      if (frame) {
        const hitTestResults = frame.getHitTestResults(hitTestSourceRef.current);
        
        if (hitTestResults.length > 0 && reticleRef.current) {
          const hit = hitTestResults[0];
          const referenceSpace = gl.xr.getReferenceSpace();
          const pose = hit.getPose(referenceSpace);
          
          if (pose) {
            reticleRef.current.visible = true;
            reticleRef.current.matrix.fromArray(pose.transform.matrix);
          }
        } else if (reticleRef.current) {
          reticleRef.current.visible = false;
        }
      }
    }
  });

  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 5, 5]} intensity={2} castShadow />
      <directionalLight position={[-5, 3, -5]} intensity={1} />
      <ProductModel glbPath={glbPath} isARMode={isARActive} />
    </>
  );
}

export default function ARProductViewer({ glbPath = "/sassy.glb" }) {
  const mountRef = useRef(null);
  const [isARSupported, setIsARSupported] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check AR support
    const checkARSupport = async () => {
      if (navigator.xr) {
        try {
          const supported = await navigator.xr.isSessionSupported("immersive-ar");
          setIsARSupported(supported);
          
          if (supported) {
            // Request camera permission
            try {
              await navigator.mediaDevices.getUserMedia({ video: true });
              setPermissionGranted(true);
            } catch (err) {
              setError("Camera permission denied. Please enable camera access.");
            }
          } else {
            setError("AR is not supported on this device/browser.");
          }
        } catch (err) {
          setError("Error checking AR support.");
        }
      } else {
        setError("WebXR not available. Use Chrome/Edge on Android or Safari on iOS.");
      }
    };

    checkARSupport();

    // Set body styles
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = "auto";
      document.body.style.touchAction = "auto";
    };
  }, []);

  const createARButton = (gl) => {
    const button = document.createElement("button");
    button.textContent = "START AR";
    button.className = "ar-button";
    
    Object.assign(button.style, {
      position: "fixed",
      bottom: "40px",
      left: "50%",
      transform: "translateX(-50%)",
      padding: "16px 32px",
      fontSize: "16px",
      fontWeight: "700",
      color: "#000",
      background: "#fff",
      border: "none",
      borderRadius: "30px",
      cursor: "pointer",
      zIndex: "9999",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      touchAction: "manipulation",
      userSelect: "none",
      WebkitTapHighlightColor: "transparent",
    });

    button.onclick = async () => {
      try {
        const sessionInit = {
          requiredFeatures: ["hit-test"],
          optionalFeatures: ["dom-overlay", "dom-overlay-for-handheld-ar"],
          domOverlay: { root: document.body }
        };

        const session = await navigator.xr.requestSession("immersive-ar", sessionInit);
        await gl.xr.setSession(session);
        button.style.display = "none";

        session.addEventListener("end", () => {
          button.style.display = "block";
        });
      } catch (err) {
        console.error("Error starting AR session:", err);
        alert("Could not start AR session. Make sure you're using a compatible browser.");
      }
    };

    return button;
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
        textAlign: "center"
      }}>
        <div style={{ fontSize: "48px", marginBottom: "20px" }}>⚠️</div>
        <div style={{ fontSize: "18px", maxWidth: "400px" }}>{error}</div>
      </div>
    );
  }

  if (!isARSupported || !permissionGranted) {
    return (
      <div style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#000",
        color: "#fff",
        fontSize: "18px"
      }}>
        Initializing AR...
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      style={{
        width: "100vw",
        height: "100vh",
        position: "fixed",
        top: 0,
        left: 0,
        background: "#000",
        overflow: "hidden",
        touchAction: "none"
      }}
    >
      <Canvas
        camera={{ position: [0, 1.6, 3], fov: 45 }}
        gl={{ 
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true
        }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          gl.setSize(window.innerWidth, window.innerHeight);

          // Remove existing button if any
          const existingButton = document.querySelector(".ar-button");
          if (existingButton) existingButton.remove();

          // Create and append AR button
          const button = createARButton(gl);
          document.body.appendChild(button);
        }}
      >
        <ARScene glbPath={glbPath} />
      </Canvas>

      <div style={{
        position: "fixed",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,0,0,0.7)",
        color: "#fff",
        padding: "12px 20px",
        borderRadius: "20px",
        fontSize: "14px",
        zIndex: 1000,
        pointerEvents: "none"
      }}>
        Preview Mode - Tap "START AR" to begin
      </div>
    </div>
  );
}