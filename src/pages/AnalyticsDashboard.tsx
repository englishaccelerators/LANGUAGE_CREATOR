
import React, { useEffect, useState } from "react";

interface StatBlock {
  label: string;
  value: string | number;
}

const mockFetchAnalytics = async () => {
  return {
    totalEntries: 12095,
    filledEntries: 8795,
    audioUploaded: 8040,
    qaApproved: 7650,
    audioPendingQA: 390,
    suffixCoverage: {
      uk: 95,
      us: 91,
      kid: 78,
    },
  };
};

const AnalyticsDashboard = () => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      const res = await mockFetchAnalytics();
      setData(res);
    }
    loadData();
  }, []);

  if (!data) return <div>Loading analytics...</div>;

  return (
    <div className="page">
      <h2>Admin Analytics</h2>

      <div className="stats-grid">
        <Stat label="Total Identifiercodes" value={data.totalEntries} />
        <Stat label="Filled Entries" value={data.filledEntries} />
        <Stat label="Audio Uploaded" value={data.audioUploaded} />
        <Stat label="QA Approved Audio" value={data.qaApproved} />
        <Stat label="Audio Pending QA" value={data.audioPendingQA} />
      </div>

      <h3>Suffix Coverage</h3>
      <ul>
        {Object.entries(data.suffixCoverage).map(([suffix, percent]: any) => (
          <li key={suffix}>
            {suffix.toUpperCase()}: {percent}%
          </li>
        ))}
      </ul>
    </div>
  );
};

const Stat = ({ label, value }: StatBlock) => (
  <div className="stat-block">
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
  </div>
);

export default AnalyticsDashboard;
