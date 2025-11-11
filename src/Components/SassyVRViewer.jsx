import React, { useEffect, useRef, Suspense } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

function ProductModel({ glbPath }) {
  const group = useRef();

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load(
      glbPath,
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(0.4, 0.4, 0.4);
        model.rotation.set(0, Math.PI, 0);
        group.current.add(model);
      },
      undefined,
      (err) => console.error("Error loading model:", err)
    );
  }, [glbPath]);

  return <group ref={group} />;
}

function ARAutoPlace({ modelRef }) {
  const { gl } = useThree();
  const hitTestSourceRef = useRef();
  const localSpaceRef = useRef();

  useEffect(() => {
    const session = gl.xr.getSession();
    if (!session) return;

    session.requestReferenceSpace("viewer").then((viewerSpace) => {
      session.requestHitTestSource({ space: viewerSpace }).then((source) => {
        hitTestSourceRef.current = source;
      });
    });

    session.requestReferenceSpace("local").then((localSpace) => {
      localSpaceRef.current = localSpace;
    });

    const onFrame = (time, frame) => {
      const source = hitTestSourceRef.current;
      const localSpace = localSpaceRef.current;
      if (!source || !localSpace) return;
      const hits = frame.getHitTestResults(source);
      if (hits.length > 0) {
        const hit = hits[0];
        const pose = hit.getPose(localSpace);
        if (pose && modelRef.current) {
          modelRef.current.visible = true;
          modelRef.current.position.set(
            pose.transform.position.x,
            pose.transform.position.y,
            pose.transform.position.z
          );
          modelRef.current.quaternion.set(
            pose.transform.orientation.x,
            pose.transform.orientation.y,
            pose.transform.orientation.z,
            pose.transform.orientation.w
          );
        }
      }
      session.requestAnimationFrame(onFrame);
    };
    session.requestAnimationFrame(onFrame);
  }, [gl]);

  return null;
}

export default function ARToiletViewer() {
  const mountRef = useRef();
  const modelGroupRef = useRef(new THREE.Group());

  useEffect(() => {
    async function requestCamera() {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
      } catch {
        alert("Please allow camera access");
      }
    }
    requestCamera();
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000",
        position: "relative",
      }}
    >
      <Canvas
        camera={{ position: [0, 1.6, 0], fov: 70 }}
        onCreated={({ gl }) => {
          gl.xr.enabled = true;
          if (!document.querySelector(".ar-button")) {
            const button = ARButton.createButton(gl, {
              requiredFeatures: ["hit-test"],
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
        <directionalLight position={[2, 5, 2]} intensity={1.2} />

        <group ref={modelGroupRef}>
          <Suspense fallback={null}>
            <ProductModel glbPath="/sassy.glb" />
          </Suspense>
        </group>

        <ARAutoPlace modelRef={modelGroupRef} />
      </Canvas>
    </div>
  );
}
