// src/App.jsx
import React from "react";
import ARToiletViewer from "./Components/SassyVRViewer";

export default function App() {
  return (
    <div>
      <h2 style={{ textAlign: "center" }}>3D Model Viewer</h2>
      <ARToiletViewer />
    </div>
  );
}
