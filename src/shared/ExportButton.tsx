
import React from "react";

interface Props {
  data: { identifiercode: string; output_value: string }[];
  filename?: string;
}

const ExportButton: React.FC<Props> = ({ data, filename = "entries.csv" }) => {
  const handleExport = () => {
    const csv = [
      ["identifiercode", "output_value"],
      ...data.map(row => [row.identifiercode, row.output_value])
    ]
      .map(e => e.map(v => \`"\${v.replace(/"/g, '""')}"\`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return <button onClick={handleExport}>📦 Export CSV</button>;
};

export default ExportButton;
