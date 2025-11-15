
import React, { useState } from "react";

interface Props {
  identifiercode: string;
  onSuggestionSelect: (suggestion: string) => void;
}

const mockAISuggest = async (identifiercode: string): Promise<string[]> => {
  // Placeholder: you can later call OpenAI or internal models
  return [
    `Suggested output for ${identifiercode}`,
    `Alternative explanation for ${identifiercode}`,
    `Example sentence using ${identifiercode}`,
  ];
};

const AISuggestionBox: React.FC<Props> = ({ identifiercode, onSuggestionSelect }) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = async () => {
    setLoading(true);
    const data = await mockAISuggest(identifiercode);
    setSuggestions(data);
    setLoading(false);
  };

  return (
    <div style={{ marginTop: "10px" }}>
      <button onClick={fetchSuggestions} disabled={loading}>
        {loading ? "Thinking..." : "💡 Get AI Suggestions"}
      </button>
      {suggestions.length > 0 && (
        <ul style={{ paddingLeft: "20px" }}>
          {suggestions.map((s, i) => (
            <li key={i}>
              <button onClick={() => onSuggestionSelect(s)}>{s}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AISuggestionBox;
