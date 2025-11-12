import React, { useRef, useEffect, useState, Suspense } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

function ProductModel({ glbPath = "/sassy.glb" }) {
  const groupRef = useRef();
  const modelRef = useRef();

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load(
      glbPath,
      (gltf) => {
        const model = gltf.scene;
        modelRef.current = model;
        
        // Center the model properly
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Calculate scale to make model a reasonable size
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 0.5 / maxDim;
        model.scale.setScalar(scale);
        
        // Center the model
        model.position.sub(center.multiplyScalar(scale));
        
        // Better initial rotation for AR viewing
        model.rotation.set(-0.2, -0.8, 0); // More natural viewing angle
        
        groupRef.current.add(model);
      },
      undefined,
      (error) => console.error("Error loading model:", error)
    );
  }, [glbPath]);

  return <group ref={groupRef} />;
}

function ARController({ modelGroupRef }) {
  const { gl, camera, scene } = useThree();
  const [hitTestSource, setHitTestSource] = useState(null);
  const hitTestSourceRequested = useRef(false);

  useEffect(() => {
    const currentSession = gl.xr.getSession();
    if (currentSession && !hitTestSourceRequested.current) {
      initializeHitTestSource();
    }

    const onSessionStart = () => {
      initializeHitTestSource();
      
      // Reset model position when session starts
      if (modelGroupRef.current) {
        modelGroupRef.current.position.set(0, 0, -1);
        modelGroupRef.current.visible = false; // Hide until placed
      }
    };

    gl.xr.addEventListener("sessionstart", onSessionStart);
    
    return () => {
      gl.xr.removeEventListener("sessionstart", onSessionStart);
    };
  }, [gl, modelGroupRef]);

  const initializeHitTestSource = () => {
    const session = gl.xr.getSession();
    if (session && !hitTestSourceRequested.current) {
      session.requestReferenceSpace('viewer').then((referenceSpace) => {
        session.requestHitTestSource({ space: referenceSpace }).then((source) => {
          setHitTestSource(source);
        });
      });
      hitTestSourceRequested.current = true;
    }
  };

  useFrame((state, delta) => {
    if (!hitTestSource) return;

    const referenceSpace = state.gl.xr.getReferenceSpace();
    const frame = state.gl.xr.getFrame();
    
    if (frame && modelGroupRef.current) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);
      
      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(referenceSpace);
        
        if (pose && modelGroupRef.current) {
          modelGroupRef.current.visible = true;
          modelGroupRef.current.position.set(
            pose.transform.position.x,
            pose.transform.position.y,
            pose.transform.position.z
          );
          modelGroupRef.current.quaternion.copy(pose.transform.orientation);
        }
      }
    }
  });

  return null;
}

function CameraSetup() {
  const { camera } = useThree();
  
  useEffect(() => {
    // Better camera setup for AR
    camera.position.set(0, 1.6, 0); // Eye level height
    camera.fov = 50; // Wider field of view
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}

export default function ARProductViewer({ glbPath = "/sassy.glb" }) {
  const mountRef = useRef(null);
  const modelGroupRef = useRef(new THREE.Group());
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [arSupported, setArSupported] = useState(false);

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.overflow = "hidden";

    // Check if WebXR AR is supported
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
        setArSupported(supported);
        if (supported) {
          requestCameraPermission();
        }
      });
    } else {
      console.warn("WebXR not supported");
      setArSupported(false);
    }

    async function requestCameraPermission() {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        setPermissionGranted(true);
      } catch (err) {
        console.error("Camera permission denied:", err);
        alert("Please allow camera access to use AR features.");
      }
    }

    return () => {
      document.body.style.overflow = "auto";
      // Clean up AR button
      const arButton = document.querySelector('.ar-button');
      if (arButton) {
        arButton.remove();
      }
    };
  }, []);

  const createARButton = (gl) => {
    // Remove existing button
    const existingButton = document.querySelector('.ar-button');
    if (existingButton) {
      existingButton.remove();
    }

    const button = ARButton.createButton(gl, {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: mountRef.current },
    });
    
    button.classList.add('ar-button');
    Object.assign(button.style, {
      position: "absolute",
      bottom: "30px",
      left: "50%",
      transform: "translateX(-50%)",
      padding: "12px 24px",
      borderRadius: "20px",
      background: "rgba(255, 255, 255, 0.9)",
      color: "#000",
      fontWeight: "600",
      fontSize: "16px",
      border: "none",
      zIndex: 1000,
      cursor: "pointer",
      backdropFilter: "blur(10px)",
    });
    
    mountRef.current.appendChild(button);
  };

  if (!arSupported) {
    return (
      <div style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#000",
        color: "#fff",
        fontSize: "18px",
        textAlign: "center",
        padding: "20px"
      }}>
        WebXR AR is not supported on your device. Please try using a compatible mobile device with AR support.
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
      }}
    >
      {permissionGranted ? (
        <Canvas
          camera={{
            position: [0, 1.6, 0],
            fov: 50,
          }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
          }}
          onCreated={({ gl, camera }) => {
            gl.xr.enabled = true;
            gl.setSize(window.innerWidth, window.innerHeight);
            gl.setClearColor(0x000000, 0);
            
            // Set up camera for AR
            camera.position.set(0, 1.6, 0);
            camera.updateProjectionMatrix();
            
            createARButton(gl);
          }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight 
            position={[3, 10, 5]} 
            intensity={1.5} 
            castShadow
          />
          <pointLight position={[0, 3, 0]} intensity={0.8} />
          
          <group ref={modelGroupRef}>
            <Suspense fallback={null}>
              <ProductModel glbPath={glbPath} />
            </Suspense>
          </group>
          
          <ARController modelGroupRef={modelGroupRef} />
          <CameraSetup />
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
            background: "#000",
          }}
        >
          {arSupported 
            ? "Requesting camera permission..." 
            : "Checking AR support..."}
        </div>
      )}
    </div>
  );
}