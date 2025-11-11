// src/App.jsx
import React from "react";
import SassyVRViewer from "./Components/ModelViewer";

export default function App() {
  return (
    <div>
      <h2 style={{ textAlign: "center" }}>3D Model Viewer</h2>
      <SassyVRViewer />
    </div>
  );
}
