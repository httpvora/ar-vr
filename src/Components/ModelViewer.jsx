import React, { useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

/* ---------------------------
   Product model loader
   --------------------------- */
function ProductModel({ glbPath = "/sassy.glb", modelRef }) {
    const localRef = useRef();

    useEffect(() => {
        const loader = new GLTFLoader();
        loader.load(
            glbPath,
            (gltf) => {
                const model = gltf.scene;
                model.scale.set(0.35, 0.35, 0.35);
                model.rotation.set(0, Math.PI, 0); // front-facing
                model.position.set(0, -0.5, 0);
                localRef.current.add(model);
            },
            undefined,
            (err) => console.error("GLB load error:", err)
        );
    }, [glbPath]);

    useEffect(() => {
        if (modelRef && localRef.current) modelRef.current = localRef.current;
    }, [modelRef]);

    return <group ref={localRef} />;
}

/* ---------------------------
   AR Controller (fixed model)
   --------------------------- */
function ARController({ modelGroupRef }) {
    const { gl, camera } = useThree();
    const inAR = useRef(false);

    // Keep model fixed in front of camera during AR
    useFrame(() => {
        const model = modelGroupRef.current;
        if (!model) return;

        if (inAR.current) {
            // Fixed position: 1 meter in front of camera
            const distance = 1.2;
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const position = camera.position.clone().add(forward.multiplyScalar(distance));
            model.position.copy(position);

            // Keep rotation fixed (don’t follow camera)
            model.rotation.set(0, Math.PI, 0);
        } else {
            // Normal desktop preview
            model.position.set(0, -0.5, 0);
            model.rotation.y += 0.005; // slow rotation
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

/* ---------------------------
   Main Component
   --------------------------- */
export default function ARProductViewer() {
    const mountRef = useRef();
    const modelGroupRef = useRef();

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
                camera={{ position: [0, 1, 3], fov: 60 }}
                onCreated={({ gl }) => {
                    gl.xr.enabled = true;

                    // Create AR button if not exists
                    if (!document.querySelector(".ar-button")) {
                        const button = ARButton.createButton(gl, {
                            optionalFeatures: ["dom-overlay", "local-floor"],
                        });
                        button.classList.add("ar-button");
                        Object.assign(button.style, {
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
                        mountRef.current.appendChild(button);
                    }
                }}
            >
                <ambientLight intensity={0.9} />
                <directionalLight position={[2, 5, 2]} intensity={1.0} />

                <group ref={modelGroupRef}>
                    <ProductModel glbPath="/sassy.glb" modelRef={modelGroupRef} />
                </group>

                <ARController modelGroupRef={modelGroupRef} />
            </Canvas>
        </div>
    );
}
