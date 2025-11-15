// src/pages/EntryFace.tsx — Full composer for TEXT (no include/exclude here)
// • Edit all rows (even excluded). Preview/CSV/XLS skip excluded rows.
// • Headword (token 0) sets the ID prefix even if excluded (row itself won’t export).
// • New blocks inherit include/exclude flags from Block 1 per token index.
// • Decimal is always shown and used with a fallback: r.dec ?? 1.
// • 💾 Save: LOCAL_ONLY → queue locally + Excel; with API → chunked upload + progress.

import React, { useEffect, useMemo, useState } from "react";
import { Button, Input, Chip, S } from "@shared/ui";
import { LS_FOR, readJSON, writeJSON, downloadBlob } from "@shared/storage";
import { PLACEHOLDER } from "@shared/constants";
import {
  catalogMap, bToken, humanLabel,
  isFilledOutput, exportValueFor, buildExcelHtml
} from "@shared/utils";
import { apiJson, API, queuePush } from "@shared/api";

type BlockRow = {
  tokenIndex: number;
  token: string;
  block: number;
  dec: number | undefined;
  output: string;
  dbSkipRow?: boolean;
};
type Block = { block: number; rows: BlockRow[] };

const nextDecimal = (rowsForToken: BlockRow[]) =>
  rowsForToken.reduce((m, r) => Math.max(m, (r.dec ?? 1)), 0) + 1;

const headwordOverride = (b: Block) => {
  const t0 = (b?.rows ?? [])
    .filter((r) => r.tokenIndex === 0)
    .sort((a, b) => (a.dec ?? 1) - (b.dec ?? 1));
  const filled = t0.find((r) => isFilledOutput(r.output));
  return filled ? String(filled.output) : null;
};

const makeId = (
  tokens: string[],
  tokenIndex: number,
  block: number,
  dec: number | undefined,
  first: string | null
) => {
  const d = dec ?? 1;
  const parts: string[] = [];
  for (let i = 0; i <= tokenIndex; i++) {
    const label = tokens[i];
    if (i === 0) parts.push(first ?? label);
    else parts.push(`${label}-${label === "E" ? d : block}`);
  }
  return parts.join("-");
};

const collectPairs = (blocks: Block[], tokens: string[]) => {
  const out: [string, string][] = [];
  for (const b of blocks || []) {
    const first = headwordOverride(b);
    const byTok = new Map<number, (BlockRow & { idx: number })[]>();
    b.rows.forEach((r, idx) => {
      const k = r.tokenIndex;
      (byTok.get(k) ?? byTok.set(k, []).get(k)!).push({ ...r, idx });
    });
    for (const [, rows] of [...byTok.entries()].sort((a, b) => a[0] - b[0])) {
      for (const r of rows.sort((a, b) => (a.dec ?? 1) - (b.dec ?? 1))) {
        if (r.dbSkipRow === true) continue;
        if (!isFilledOutput(r.output)) continue;
        out.push([
          makeId(tokens, r.tokenIndex, r.block, r.dec ?? 1, first),
          exportValueFor(r.output),
        ]);
      }
    }
  }
  return out;
};

export default function EntryFace({ slug }: { slug: string }) {
  const LS = LS_FOR(slug);

  const [catalog] = useState<any[]>(() => readJSON(LS.catalog, []));
  const byBKey = useMemo(() => catalogMap(catalog), [catalog]);
  const [sequences] = useState<string[][]>(() => readJSON(LS.sequences, []));
  const [store, setStore] = useState<Record<string, Block[]>>(
    () => readJSON(LS.entry, {})
  );

  const [joiner, setJoiner] = useState("; ");
  const [preview, setPreview] = useState<{ seqKey: string | null; rows: [string, string][] }>({ seqKey: null, rows: [] });

  // Save UI state
  const [saving, setSaving] = useState(false);
  const [savePct, setSavePct] = useState(0);
  const [saveMsg, setSaveMsg] = useState<string>("");
  const [cancelSave, setCancelSave] = useState(false);

  useEffect(() => writeJSON(LS.entry, store), [store, LS.entry]);

  const seqModels = useMemo(
    () =>
      (sequences || []).map((path) => {
        const tokens = path.map((bk) => bToken(bk, byBKey));
        const title = path.map((bk) => humanLabel(bk, byBKey)).join(" → ");
        const seqKey = path.join("|");
        return { seqKey, title, tokens };
      }),
    [sequences, byBKey]
  );

  // seed block-1 and keep token counts aligned
  useEffect(() => {
    setStore((prev) => {
      const next = { ...(prev || {}) };
      let mutated = false;
      for (const { seqKey, tokens } of seqModels) {
        const blocks = next[seqKey];
        if (!Array.isArray(blocks) || !blocks.length) {
          next[seqKey] = [
            {
              block: 1,
              rows: tokens.map((t, i) => ({
                tokenIndex: i,
                token: t,
                block: 1,
                dec: 1,
                output: PLACEHOLDER,
                dbSkipRow: false,
              })),
            },
          ];
          mutated = true;
        } else {
          const need = tokens.length;
          next[seqKey] = blocks.map((b) => {
            const have = new Set(b.rows.map((r) => r.tokenIndex));
            const rows = [...b.rows];
            for (let i = 0; i < need; i++) {
              if (!have.has(i)) {
                rows.push({
                  tokenIndex: i,
                  token: tokens[i],
                  block: b.block,
                  dec: 1,
                  output: PLACEHOLDER,
                  dbSkipRow: false,
                });
                mutated = true;
              }
            }
            return { ...b, rows };
          });
        }
      }
      if (mutated) writeJSON(LS.entry, next);
      return mutated ? next : prev;
    });
  }, [JSON.stringify(seqModels), LS.entry]);

  /* ---------- composer mutations (NO skip toggle here) ---------- */

  const setBlocks = (seqKey: string, blocks: Block[]) =>
    setStore((prev) => {
      const out = { ...(prev || {}), [seqKey]: blocks };
      writeJSON(LS.entry, out);
      return out;
    });

  // New block inherits dbSkipRow flags from Block 1 per tokenIndex
  const addBlock = (seqKey: string, tokens: string[]) => {
    const list = store?.[seqKey] || [];
    const nb = list.length ? list[list.length - 1].block + 1 : 1;

    const ref = list.find((b) => b.block === 1);
    const refByToken = new Map<number, boolean | undefined>();
    if (ref) ref.rows.forEach((r) => refByToken.set(r.tokenIndex, r.dbSkipRow));

    const b: Block = {
      block: nb,
      rows: tokens.map((t, i) => ({
        tokenIndex: i,
        token: t,
        block: nb,
        dec: 1,
        output: PLACEHOLDER,
        dbSkipRow: refByToken.get(i) ?? false, // inherit 🚫🗄️ from Block 1
      })),
    };
    setBlocks(seqKey, [...list, b]);
  };

  const deleteBlock = (seqKey: string, blockNum: number) => {
    const list = store?.[seqKey] || [];
    const keep = list
      .filter((b) => b.block !== blockNum)
      .map((b, i) => ({
        ...b,
        block: i + 1,
        rows: b.rows.map((r) => ({ ...r, block: i + 1 })),
      }));
    setBlocks(seqKey, keep);
  };

  const duplicateBlock = (seqKey: string, blockNum: number) => {
    const list = store?.[seqKey] || [];
    const src = list.find((b) => b.block === blockNum);
    if (!src) return;
    const nb = list.length ? list[list.length - 1].block + 1 : 1;
    const copy: Block = {
      block: nb,
      rows: src.rows.map((r) => ({ ...r, block: nb })),
    };
    setBlocks(seqKey, [...list, copy]);
  };

  const addDec = (seqKey: string, blockNum: number, tokenIndex: number) => {
    const list = store?.[seqKey] || [];
    const bi = list.findIndex((b) => b.block === blockNum);
    if (bi < 0) return;
    const b = { ...list[bi], rows: [...list[bi].rows] };
    const rowsForTok = b.rows.filter((r) => r.tokenIndex === tokenIndex);
    const dec = nextDecimal(rowsForTok);
    const base =
      rowsForTok[0]?.token ||
      b.rows.find((r) => r.tokenIndex === tokenIndex)?.token ||
      "";
    let insertAt =
      b.rows.reduce((acc, r, i) => (r.tokenIndex === tokenIndex ? i : acc), -1) + 1;
    if (insertAt <= 0) insertAt = b.rows.length;
    b.rows.splice(insertAt, 0, {
      tokenIndex,
      token: base,
      block: b.block,
      dec,
      output: PLACEHOLDER,
      dbSkipRow: rowsForTok[0]?.dbSkipRow,
    });
    const copy = [...list];
    copy[bi] = b;
    setBlocks(seqKey, copy);
  };

  const setOutput = (seqKey: string, blockNum: number, rowIndex: number, value: string) => {
    const list = store?.[seqKey] || [];
    const bi = list.findIndex((b) => b.block === blockNum);
    if (bi < 0) return;
    const b = { ...list[bi], rows: [...list[bi].rows] };
    b.rows[rowIndex] = { ...b.rows[rowIndex], output: value };
    const copy = [...list];
    copy[bi] = b;
    setBlocks(seqKey, copy);
  };

  const fillTokenColumn = (seqKey: string, tokenIndex: number, value: string) =>
    setStore((prev) => {
      const list = prev?.[seqKey] || [];
      const changed = list.map((b) => ({
        ...b,
        rows: b.rows.map((r) => (r.tokenIndex === tokenIndex ? { ...r, output: value } : r)),
      }));
      const out = { ...(prev || {}), [seqKey]: changed };
      writeJSON(LS.entry, out);
      return out;
    });

  const clearTokenColumn = (seqKey: string, tokenIndex: number) => fillTokenColumn(seqKey, tokenIndex, "");

  /* ---------- preview & export ---------- */

  const previewExport = (seqKey: string, tokens: string[]) =>
    setPreview({ seqKey, rows: collectPairs(store?.[seqKey] || [], tokens) });

  const clearPreview = () => setPreview({ seqKey: null, rows: [] });

  const exportCSV = (seqKey: string, tokens: string[]) => {
    const header = ["identifiercode", "output value"];
    const rows = collectPairs(store?.[seqKey] || [], tokens);
    const csv = [header.join(",")]
      .concat(rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))))
      .join("\n");
    downloadBlob(`${slug}-entry.csv`, csv, "text/csv;charset=utf-8");
  };

  const exportExcel = (seqKey: string, tokens: string[]) => {
    const header = ["identifiercode", "output value"];
    const rows = collectPairs(store?.[seqKey] || [], tokens);
    const html = buildExcelHtml(header, rows);
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-entry.xls`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // global composer (for QA / copy)
  const composerText = useMemo(() => {
    const parts: string[] = [];
    for (const { seqKey, title } of seqModels) {
      const list = store?.[seqKey] || [];
      for (const b of list) {
        const joined = b.rows.map((r) => r.output).filter(Boolean).join(joiner);
        const prefix = joined ? `${title} — Block ${b.block}: ` : `${title} — Block ${b.block}`;
        parts.push(prefix + (joined || ""));
      }
    }
    return parts.join("\n");
  }, [store, seqModels, joiner]);

  /* ---------- SAVE with local fallback / or network ---------- */

  function toExcelBlob(rows: [string,string][]) {
    const header = ["identifiercode","output value"];
    const html = buildExcelHtml(header, rows);
    return new Blob([html], { type: "application/vnd.ms-excel" });
  }

  async function saveRowsToDB(seqKey: string, tokens: string[]) {
    if (saving) return;
    setSaving(true); setSavePct(0); setCancelSave(false); setSaveMsg("Preparing data...");

    const rows = collectPairs(store?.[seqKey] || [], tokens);
    const total = rows.length;
    if (!total) { setSaveMsg("Nothing to save."); setSaving(false); return; }

    const language = API.LANGUAGE;
    const tenant   = API.TENANT || null;
    const reason   = slug;

    if (API.BASE === "LOCAL_ONLY") {
      queuePush({
        when: new Date().toISOString(),
        seqKey, language, tenant, reason,
        rows: rows.map(([identifiercode, output_value]) => ({ identifiercode, output_value, status: "active" })),
      });
      setSaveMsg(`Queued ${total.toLocaleString()} row(s) locally (no server). Preparing Excel...`);
      const blob = toExcelBlob(rows);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `${slug}-entry-saved.xls`; a.click();
      setTimeout(()=>URL.revokeObjectURL(url), 1000);
      setSaving(false);
      setSaveMsg("Saved locally. Set API.BASE to your backend to enable network uploads.");
      return;
    }

    // Backend mode (chunked)
    const CHUNK = 5000;
    const lanes = 2;
    let sent = 0, idx = 0, error: any = null;

    setSaveMsg(`Saving ${total.toLocaleString()} row(s) to ${API.BASE}...`);

    const makeChunk = () => {
      if (idx >= total) return null;
      const slice = rows.slice(idx, idx + CHUNK);
      idx += CHUNK;
      return slice;
    };

    const ship = async (chunk: [string,string][]) => {
      const payload = {
        language, tenant, reason,
        rows: chunk.map(([identifiercode, output_value]) => ({
          identifiercode, output_value, status: "active"
        })),
      };
      await apiJson("/stage1/text:upsert", payload, "POST");
      sent += chunk.length;
      setSavePct(Math.round((sent / total) * 100));
    };

    const runners: Promise<void>[] = [];
    for (let i=0; i<lanes; i++) {
      runners.push((async () => {
        while (!cancelSave) {
          const chunk = makeChunk();
          if (!chunk) break;
          try { await ship(chunk); }
          catch (e:any) { error = e; break; }
        }
      })());
    }

    await Promise.all(runners);

    if (cancelSave) {
      setSaveMsg("Save cancelled.");
      setSaving(false);
      return;
    }
    if (error) {
      setSaveMsg(`Save failed: ${(error?.message || error)}`);
      setSaving(false);
      return;
    }

    setSaveMsg(`Saved ${sent.toLocaleString()} row(s). Preparing Excel...`);
    const blob = toExcelBlob(rows);
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${slug}-entry-saved.xls`; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
    setSaving(false);
    setSaveMsg("Done.");
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Composer (global) */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <b>Composer</b>
          <span style={{ color: "#6b7280" }}>Join outputs with</span>
          <Input value={joiner} onChange={(e) => setJoiner(e.target.value)} style={{ width: 120 }} />
          <Button onClick={() => navigator.clipboard.writeText(composerText)}>Copy text</Button>
          <Button onClick={() => downloadBlob(`${slug}-entry.md`, composerText, "text/markdown;charset=utf-8")}>Download .md</Button>
        </div>
        <pre style={{ whiteSpace:"pre-wrap", margin:0, fontFamily:"ui-monospace,SFMono-Regular,Menlo,monospace", background:"#f8fafc", padding:8, borderRadius:8, maxHeight:200, overflow:"auto" }}>
{composerText || "(nothing to preview yet)"}
        </pre>
      </div>

      {seqModels.map(({ seqKey, title, tokens }) => {
        const blocks = store?.[seqKey] || [];
        return (
          <div key={seqKey} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <b>{title}</b>
              <span style={{ marginLeft: "auto", display: "inline-flex", gap: 8, alignItems: "center" }}>
                <Button onClick={()=>saveRowsToDB(seqKey, tokens)} disabled={saving}>💾 Save</Button>
                <Button onClick={()=>addBlock(seqKey, tokens)}>+ block</Button>
                <Button onClick={()=>previewExport(seqKey, tokens)}>Preview</Button>
                <Button onClick={()=>exportCSV(seqKey, tokens)}>CSV</Button>
                <Button onClick={()=>exportExcel(seqKey, tokens)}>Excel (.xls)</Button>
              </span>
            </div>

            {saving && (
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <div style={{ flex:1, height:8, background:"#E5E7EB", borderRadius:999 }}>
                  <div style={{ width: `${savePct}%`, height:8, background:"#111827", borderRadius:999, transition:"width .2s ease" }} />
                </div>
                <div style={{ ...S.small, width: 260, textAlign:"right" }}>{saveMsg || `${savePct}%`}</div>
                <Button onClick={()=>setCancelSave(true)}>Cancel</Button>
              </div>
            )}

            {blocks.length === 0 && <div style={{ color:"#6b7280" }}>No blocks yet. Use <b>+ block</b>.</div>}

            {blocks.map((b, bi) => {
              const totals = countTotals(b);
              const grouped = groupByToken(b);
              return (
                <div key={`b_${bi}`} style={{ marginBottom: 12 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                    <b>Block {b.block}</b>
                    <span style={{ display:"inline-flex", gap: 8 }}>
                      <Chip>Rows: {totals.rows}</Chip>
                      <Chip>Filled: {totals.filled}</Chip>
                      <Chip>Excluded: {totals.excluded}</Chip>
                      <Chip>Will export: {totals.exportable}</Chip>
                      <Button onClick={()=>duplicateBlock(seqKey, b.block)}>Copy block</Button>
                      <Button onClick={()=>deleteBlock(seqKey, b.block)}>Delete block</Button>
                    </span>
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:"minmax(220px,320px) 120px 1fr 260px", gap:8, fontWeight:600, color:"#6b7280", marginBottom:4 }}>
                    <div>token</div>
                    <div>block.dec</div>
                    <div>identifiercode</div>
                    <div>output value</div>
                  </div>

                  {grouped.map(({ tokenIndex, rows }) => {
                    const first = headwordOverride(b);
                    return rows.map((r, idx) => {
                      const id = makeId(tokens, r.tokenIndex, r.block, r.dec ?? 1, first);
                      const label = r.tokenIndex === 0 && first ? first : r.token;
                      const excluded = r.dbSkipRow === true;
                      return (
                        <div key={`${r.tokenIndex}-${r.block}-${(r.dec ?? 1)}`} style={{ display:"contents", opacity: excluded ? 0.65 : 1 }}>
                          <div style={{ color:"#111827", display:"flex", alignItems:"center", gap:6 }}>
                            <span>{label}</span>
                            <Button style={{ fontSize:12, padding:"2px 8px" }} onClick={()=>{
                              const v = prompt("Fill all rows in this column with:", "");
                              if (v !== null) fillTokenColumn(seqKey, r.tokenIndex, v);
                            }}>fill</Button>
                            <Button style={{ fontSize:12, padding:"2px 8px" }} onClick={()=>clearTokenColumn(seqKey, r.tokenIndex)}>clear</Button>
                          </div>
                          <div>{r.block}.{(r.dec ?? 1)}</div>
                          <div>
                            <code>{id}</code>
                            {excluded && <span style={{ marginLeft:8, fontSize:12, color:"#b91c1c" }}>(excluded)</span>}
                          </div>
                          <div>
                            <Input
                              placeholder="enter output value"
                              value={r.output === PLACEHOLDER ? "" : r.output || ""}
                              onChange={(e) => setOutput(seqKey, r.block, rows[idx].idx, e.target.value)}
                            />
                          </div>
                        </div>
                      );
                    });
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* -------- helper functions -------- */

function groupByToken(b: Block) {
  const map = new Map<number, (BlockRow & { idx: number })[]>();
  b.rows.forEach((r, i) => {
    const k = r.tokenIndex;
    (map.get(k) ?? map.set(k, []).get(k)!).push({ ...r, idx: i });
  });
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tokenIndex, rows]) => ({
      tokenIndex,
      rows: rows.sort((a, b) => (a.dec ?? 1) - (b.dec ?? 1)), // sort with fallback
    }));
}

function countTotals(b: Block) {
  let rows = 0, filled = 0, excluded = 0, exportable = 0;
  for (const r of b.rows) {
    rows++;
    const f = isFilledOutput(r.output);
    if (f) filled++;
    if (r.dbSkipRow) { excluded++; continue; }
    if (f) exportable++;
  }
  return { rows, filled, excluded, exportable };
}
