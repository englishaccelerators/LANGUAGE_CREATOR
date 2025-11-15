
import React, { useState } from "react";
import { uploadAudioFiles } from "../shared/api";

const AudioPage = () => {
  const [files, setFiles] = useState<FileList | null>(null);
  const [profile, setProfile] = useState("uk");
  const [log, setLog] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files);
  };

  const handleUpload = async () => {
    if (!files || files.length === 0) return;

    setUploading(true);
    const results: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const identifiercode = file.name.replace(".mp3", "").replace(`-${profile}`, "");

      try {
        await uploadAudioFiles(identifiercode, profile, file);
        results.push(`✅ Uploaded: ${file.name}`);
      } catch (error) {
        results.push(`❌ Failed: ${file.name}`);
      }
    }

    setLog(results);
    setUploading(false);
  };

  return (
    <div className="page">
      <h2>Audio Upload Manager</h2>
      <label>
        Select Accent/Profile Suffix:
        <select value={profile} onChange={(e) => setProfile(e.target.value)}>
          <option value="uk">UK</option>
          <option value="us">US</option>
          <option value="kid">Kid</option>
          <option value="oldman">Old Man</option>
          <option value="oldwoman">Old Woman</option>
        </select>
      </label>
      <input type="file" accept=".mp3" multiple onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={uploading}>
        {uploading ? "Uploading..." : "Upload Audio Files"}
      </button>

      <div className="upload-log">
        {log.map((line, idx) => (
          <div key={idx}>{line}</div>
        ))}
      </div>
    </div>
  );
};

export default AudioPage;
