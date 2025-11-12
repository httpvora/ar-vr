// ARProductViewer.jsx
import React, { useRef, useEffect, useState, Suspense } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

/**
 * ProductModel
 * - Loads GLTF, recenters it (by bbox) so placement is intuitive
 * - Exposes the loaded scene via ref
 */
function ProductModel({ glbPath = "/sassy.glb", modelRef, initialScale = 0.35 }) {
  useEffect(() => {
    let mounted = true;
    const loader = new GLTFLoader();

    loader.load(
      glbPath,
      (gltf) => {
        if (!mounted) return;

        const model = gltf.scene;
        // Compute bbox and center model geometry at origin for easier placement
        const bbox = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        // Shift geometry so its center becomes (0,0,0)
        model.position.sub(center);

        // Optional: If you want the model sitting on the ground by default,
        // move it down by half height after centering
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const halfHeight = size.y / 2;
        model.position.y += halfHeight * 0.0; // keep at origin, but you can nudge if needed

        model.scale.set(initialScale, initialScale, initialScale);
        modelRef.current.clear(); // remove previous children if any
        modelRef.current.add(model);
      },
      undefined,
      (err) => {
        console.error("GLTF load error:", err);
      }
    );

    return () => {
      mounted = false;
    };
  }, [glbPath, modelRef, initialScale]);

  return null; // nothing rendered directly from this component (model is attached to ref)
}

/**
 * Reticle component
 * - Creates a small ring mesh to show hit-test result
 * - Sets up XR hit-test source on session start and updates each frame
 */
function Reticle({ reticleRef }) {
  const { gl } = useThree();

  useEffect(() => {
    let hitTestSource = null;
    let localSpace = null;
    let session = null;

    const onSessionStart = async () => {
      session = gl.xr.getSession();
      if (!session) return;

      session.addEventListener("end", onSessionEnd);

      const viewerSpace = await session.requestReferenceSpace("viewer");
      hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
      localSpace = await session.requestReferenceSpace("local-floor");
    };

    const onSessionEnd = () => {
      hitTestSource = null;
      localSpace = null;
      session = null;
    };

    gl.xr.addEventListener("sessionstart", onSessionStart);
    return () => {
      gl.xr.removeEventListener("sessionstart", onSessionStart);
      if (session) session.removeEventListener("end", onSessionEnd);
    };
  }, [gl]);

  useFrame((_, delta, frame) => {
    const session = gl.xr.getSession();
    if (!session) return;

    const refSpace = gl.xr.getReferenceSpace();
    const hitTestResults = frame?.getHitTestResults?.(hitTestSource) || [];

    if (hitTestResults.length > 0) {
      const hit = hitTestResults[0];
      const pose = hit.getPose(refSpace);
      if (pose && reticleRef.current) {
        reticleRef.current.visible = true;
        reticleRef.current.matrix.fromArray(pose.transform.matrix);
      }
    } else if (reticleRef.current) {
      reticleRef.current.visible = false;
    }
  });

  return (
    <mesh ref={reticleRef} visible={false} matrixAutoUpdate={false}>
      {/* ✅ FIX: use ringGeometry (not ringBufferGeometry) */}
      <ringGeometry args={[0.06, 0.08, 32]} />
      <meshBasicMaterial color="white" side={THREE.DoubleSide} />
    </mesh>
  );
}


/**
 * Main ARProductViewer
 */
export default function ARProductViewer({ glbPath = "/sassy.glb" }) {
  const mountRef = useRef(null);
  const modelGroupRef = useRef(new THREE.Group());
  const reticleRef = useRef();
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Request camera permission early to help mobile UX (optional - WebXR will also request)
  useEffect(() => {
    let mounted = true;
    async function requestCamera() {
      try {
        // some browsers may throw if camera isn't available; we ignore failure gracefully
        await navigator.mediaDevices.getUserMedia({ video: true });
        if (mounted) setPermissionGranted(true);
      } catch (err) {
        console.warn("Camera permission (early) denied or unavailable:", err);
        // still allow ARButton to open XR session which will prompt the user
        if (mounted) setPermissionGranted(false);
      }
    }
    requestCamera();
    return () => {
      mounted = false;
    };
  }, []);

  // Append ARButton only once and style it
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    // Create a temporary WebGLRenderer for ARButton to use (three's ARButton expects a renderer.gl)
    // But @react-three/fiber provides a WebGL context for us. We will append ARButton inside onCreated below
    // so this effect only cleans up leftover buttons when component unmounts.
    return () => {
      const existing = el.querySelector(".ar-button");
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    };
  }, []);

  // handle a tap/select on the AR session to place the model at reticle location
  useEffect(() => {
    function onSelect() {
      const modelGroup = modelGroupRef.current;
      const reticle = reticleRef.current;
      if (modelGroup && reticle && reticle.visible) {
        // copy transform from reticle to model group (model is centered at origin inside group)
        modelGroup.position.copy(reticle.position);
        modelGroup.quaternion.copy(reticle.quaternion);
        // slightly lift the model if you want it above surface (optional)
        // modelGroup.position.y += 0.01;
      }
    }

    // When an XR session becomes active, attach select listener to the session's input source
    // We'll attach listener in onCreated where we have gl reference and XR session lifecycle events
    // Here we only define the handler and let onCreated wire it up via custom event dispatch (see below).

    // We attach it globally via window for simplicity; onCreated will call window.__attachXRSelectHandler(fn)
    (window).__attachXRSelectHandler = onSelect;

    return () => {
      (window).__attachXRSelectHandler = undefined;
    };
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
      <Canvas
        camera={{ position: [0, 1.6, 0], fov: 70 }}
        onCreated={({ gl, scene }) => {
          // enable XR
          gl.xr.enabled = true;

          // Make background transparent (useful if you want camera feed visible below overlay)
          gl.setClearColor(0x000000, 0);

          // Create AR button with hit-test requirement
          if (!mountRef.current.querySelector(".ar-button")) {
            try {
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
                padding: "10px 18px",
                borderRadius: "10px",
                background: "#ffffff",
                color: "#000",
                fontWeight: "600",
                zIndex: 20,
                border: "none",
              });

              mountRef.current.appendChild(button);

              // Listen to sessionstart to attach select handler for placing model
              gl.xr.addEventListener("sessionstart", () => {
                const session = gl.xr.getSession();
                if (!session) return;

                // create a controller and add select listener
                const controller = gl.xr.getController(0);
                controller.addEventListener("select", () => {
                  // prefer using the handler we set earlier
                  const fn = (window).__attachXRSelectHandler;
                  if (typeof fn === "function") fn();
                });

                // optionally attach the controller to the scene so it receives events
                scene.add(controller);
              });
            } catch (e) {
              console.warn("ARButton creation failed:", e);
            }
          }
        }}
      >
        {/* Lights */}
        <ambientLight intensity={0.9} />
        <directionalLight position={[1, 2, 1]} intensity={1} />

        {/* Model group: we attach the loaded model(s) here and move this group when user places */}
        <group ref={modelGroupRef} />

        {/* Load model; ProductModel attaches children into modelGroupRef */}
        <Suspense fallback={null}>
          <ProductModel glbPath={glbPath} modelRef={modelGroupRef} initialScale={0.35} />
        </Suspense>

        {/* Reticle */}
        <Reticle reticleRef={reticleRef} />
      </Canvas>

      {/* Friendly overlay text when early permission not yet granted (optional UI) */}
      {!permissionGranted && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            color: "#fff",
            fontSize: 16,
            textAlign: "center",
            padding: 20,
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          Tap <strong>Enter AR</strong> (AR permission will also be requested). If camera permission is blocked,
          enable it in your browser settings.
        </div>
      )}
    </div>
  );
}
