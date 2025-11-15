import React, { useMemo, useState } from "react";
import { Button, Input, S, Tag } from "@shared/ui";
import { REASONS_LS, writeJSON } from "@shared/storage";
import type { Reason } from "@shared/types";

export default function ReasonIndex({ reasons, setReasons, openReason }:{ reasons: Reason[]; setReasons: (x: Reason[])=>void; openReason: (r: Reason)=>void; }) {
  const [q, setQ] = useState(""); const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const perPage = 20;

  const tree = useMemo(()=>{
    const kids = new Map<string, Reason[]>(); reasons.forEach(r => { const p = r.parent || "__root__"; if (!kids.has(p)) kids.set(p, []); kids.get(p)!.push(r); });
    const order: Reason[] = []; const walk=(pid:string,d:number)=>{ (kids.get(pid)||[]).sort((a,b)=>a.title.localeCompare(b.title)).forEach(r=>{ order.push({...r,depth:d}); walk(r.id,d+1); });};
    walk("__root__",0); return order;
  }, [reasons]);

  const filtered = useMemo(()=> !q.trim()? tree : tree.filter(r => `${r.title} ${r.slug}`.toLowerCase().includes(q.toLowerCase())), [q, tree]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageRows = filtered.slice((page-1)*perPage, page*perPage);

  const addNew = () => {
    const title = prompt("Reason title:"); if (!title) return;
    const slug = prompt("Slug (a-z,0-9,-):", title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")); if (!slug) return;
    const id = `r-${crypto.randomUUID().slice(0,8)}`; const now = new Date().toISOString();
    const next = [{ id, title, slug, author: "owner", date: now, parent: null }, ...reasons];
    setReasons(next); writeJSON(REASONS_LS, next);
  };

  const deleteOne = (r: Reason) => {
    if (!confirm(`Delete “${r.title}”?`)) return;
    const next = reasons.filter(x => x.id !== r.id); setReasons(next); writeJSON(REASONS_LS, next);
  };

  return (
    <div>
      <div style={S.toolbar}>
        <div style={S.h1}>Pages</div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <Input placeholder="Search Pages" value={q} onChange={e=>{setQ(e.target.value); setPage(1);}} />
          <Button onClick={addNew}>+ Add New</Button>
        </div>
      </div>

      <table style={{ ...S.table }}>
        <thead style={{ background:"#F3F4F6" }}><tr><th style={{textAlign:"left",padding:8,width:32}}> </th><th style={{textAlign:"left",padding:8}}>Title</th><th style={{textAlign:"left",padding:8}}>Author</th><th style={{textAlign:"left",padding:8}}>Date</th><th style={{width:80}}/></tr></thead>
        <tbody>
          {pageRows.map(r => (
            <tr key={r.id} style={{ borderTop:"1px solid #E5E7EB" }}>
              <td style={{padding:8}}><input type="checkbox" checked={!!selected[r.id]} onChange={e=>setSelected({...selected,[r.id]:e.target.checked})} /></td>
              <td style={{padding:8}}>
                <a href="#" onClick={(e)=>{e.preventDefault();openReason(r);}} style={{ color:"#111827", fontWeight:600, textDecoration:"none" }}>
                  {r.depth ? "— ".repeat(r.depth) : ""}{r.title}
                </a>
                <div><Tag>/{r.slug}</Tag></div>
              </td>
              <td style={{padding:8}}><a href="mailto:owner@example.com">owner</a></td>
              <td style={{padding:8}}>{new Date(r.date).toLocaleString()}</td>
              <td style={{padding:8}}><Button style={{ fontSize:12, padding:"4px 8px" }} onClick={()=>deleteOne(r)}>🗑️ Delete</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
