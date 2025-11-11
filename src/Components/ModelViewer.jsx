import React, { useRef, useEffect, useState, Suspense ,useFrame} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

/* --- Load 3D Toilet Model --- */
function ProductModel({ glbPath = "/sassy.glb" }) {
  const ref = useRef();

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load(
      glbPath,
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(0.3, 0.3, 0.3);
        model.rotation.set(0, Math.PI, 0);
        model.position.set(0, 0, 0);
        ref.current.add(model);
      },
      undefined,
      (err) => console.error("GLB load error:", err)
    );
  }, [glbPath]);

  return <group ref={ref} />;
}

/* --- AR Wall Placement Controller --- */
function ARWallPlacement({ modelGroupRef }) {
  const { gl, camera } = useThree();
  const hitTestSourceRef = useRef(null);
  const localSpaceRef = useRef(null);
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    const session = gl.xr.getSession();
    if (!session) return;

    let viewerSpace = null;
    let hitTestSource = null;

    session.requestReferenceSpace("viewer").then((space) => {
      viewerSpace = space;
      session.requestHitTestSource({ space: viewerSpace }).then((source) => {
        hitTestSource = source;
        hitTestSourceRef.current = hitTestSource;
      });
    });

    session.requestReferenceSpace("local").then((space) => {
      localSpaceRef.current = space;
    });

    const onSelect = () => {
      if (!placed) setPlaced(true);
    };

    session.addEventListener("select", onSelect);
    return () => {
      session.removeEventListener("select", onSelect);
      if (hitTestSourceRef.current) hitTestSourceRef.current.cancel();
    };
  }, [gl, placed]);

  useFrame(() => {
    const model = modelGroupRef.current;
    const xrFrame = gl.xr.getFrame();
    const session = gl.xr.getSession();
    if (!session || !xrFrame || !hitTestSourceRef.current || !localSpaceRef.current) return;

    const hitTestResults = xrFrame.getHitTestResults(hitTestSourceRef.current);
    if (hitTestResults.length > 0) {
      const hit = hitTestResults[0];
      const pose = hit.getPose(localSpaceRef.current);
      if (pose) {
        if (!placed) {
          // Keep model following camera until user taps screen
          model.position.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
          model.quaternion.set(
            pose.transform.orientation.x,
            pose.transform.orientation.y,
            pose.transform.orientation.z,
            pose.transform.orientation.w
          );
        }
      }
    }
  });

  return null;
}

/* --- Main Component --- */
export default function ARProductViewer({ glbPath = "/sassy.glb" }) {
  const mountRef = useRef(null);
  const modelGroupRef = useRef(new THREE.Group());
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    async function askPermission() {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        setPermissionGranted(true);
      } catch {
        alert("Please allow camera permission for AR.");
      }
    }
    askPermission();
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ width: "100vw", height: "100vh", position: "relative", background: "#000" }}
    >
      {permissionGranted ? (
        <Canvas
          camera={{ position: [0, 1.6, 0], fov: 70 }}
          onCreated={({ gl }) => {
            gl.xr.enabled = true;
            if (!document.querySelector(".ar-button")) {
              const btn = ARButton.createButton(gl, {
                requiredFeatures: ["hit-test", "local-floor"],
                optionalFeatures: ["dom-overlay"],
              });
              btn.classList.add("ar-button");
              Object.assign(btn.style, {
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
              mountRef.current.appendChild(btn);
            }
          }}
        >
          <ambientLight intensity={1} />
          <directionalLight position={[0, 3, 2]} intensity={1.2} />

          <group ref={modelGroupRef}>
            <Suspense fallback={null}>
              <ProductModel glbPath={glbPath} />
            </Suspense>
          </group>

          <ARWallPlacement modelGroupRef={modelGroupRef} />
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
            fontSize: 18,
          }}
        >
          Requesting camera permission...
        </div>
      )}
    </div>
  );
}
