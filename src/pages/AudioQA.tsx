
import React, { useEffect, useState } from "react";

interface QAEntry {
  identifiercode: string;
  profile: string;
  audioUrl: string;
  status: "approved" | "pending" | "rejected";
}

const mockFetchAudioEntries = async (): Promise<QAEntry[]> => {
  // Replace this with real backend/API call
  return [
    { identifiercode: "be-v-1.1", profile: "uk", audioUrl: "/audio/uk/be-v-1.1.mp3", status: "pending" },
    { identifiercode: "be-v-1.1", profile: "us", audioUrl: "/audio/us/be-v-1.1.mp3", status: "approved" },
  ];
};

const AudioQA = () => {
  const [entries, setEntries] = useState<QAEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      const data = await mockFetchAudioEntries();
      setEntries(data);
    };
    load();
  }, []);

  const handleStatusChange = (index: number, status: QAEntry["status"]) => {
    const updated = [...entries];
    updated[index].status = status;
    setEntries(updated);
    // TODO: send update to backend
  };

  return (
    <div className="page">
      <h2>Audio QA Dashboard</h2>
      <table>
        <thead>
          <tr>
            <th>Identifier</th>
            <th>Profile</th>
            <th>Preview</th>
            <th>Status</th>
            <th>Approve/Reject</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => (
            <tr key={idx}>
              <td>{entry.identifiercode}</td>
              <td>{entry.profile}</td>
              <td>
                <audio controls src={entry.audioUrl} />
              </td>
              <td>{entry.status}</td>
              <td>
                <button onClick={() => handleStatusChange(idx, "approved")}>✅</button>
                <button onClick={() => handleStatusChange(idx, "rejected")}>❌</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AudioQA;
