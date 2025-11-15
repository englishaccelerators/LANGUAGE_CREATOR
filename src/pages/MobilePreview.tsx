
import React, { useState } from "react";

const MobilePreview = () => {
  const [selectedDevice, setSelectedDevice] = useState("iPhone 13");
  const [selectedProfile, setSelectedProfile] = useState("uk");

  const devicePresets = {
    "iPhone 13": { width: "390px", height: "844px" },
    "Pixel 6": { width: "412px", height: "915px" },
    "iPad Mini": { width: "768px", height: "1024px" },
    "Galaxy S20": { width: "360px", height: "800px" },
  };

  const currentStyle = devicePresets[selectedDevice];

  return (
    <div className="page">
      <h2>Mobile Preview</h2>
      <label>
        Device:
        <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}>
          {Object.keys(devicePresets).map((device) => (
            <option key={device} value={device}>
              {device}
            </option>
          ))}
        </select>
      </label>
      <label>
        Audio Profile:
        <select value={selectedProfile} onChange={(e) => setSelectedProfile(e.target.value)}>
          <option value="uk">UK</option>
          <option value="us">US</option>
          <option value="kid">Kid</option>
          <option value="oldman">Old Man</option>
          <option value="oldwoman">Old Woman</option>
        </select>
      </label>

      <div
        style={{
          border: "1px solid #ccc",
          marginTop: "20px",
          width: currentStyle.width,
          height: currentStyle.height,
          overflow: "auto",
          background: "#fff",
          padding: "10px",
        }}
      >
        <h4>Previewing as {selectedDevice}</h4>
        <p>Sample word: <strong>be</strong></p>
        <p>Definition: To exist or occur</p>
        <audio controls src={`/audio/${selectedProfile}/be-v-1.1-${selectedProfile}.mp3`} />
        <p>Example: I want to be a doctor.</p>
      </div>
    </div>
  );
};

export default MobilePreview;
