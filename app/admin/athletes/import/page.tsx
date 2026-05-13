'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

type ParsedRow = Record<string, string>;

const ATHLETE_FIELDS = [
  { value: 'skip', label: 'Skip' },
  { value: 'firstName', label: 'First Name' },
  { value: 'surname', label: 'Surname' },
  { value: 'dateOfBirth', label: 'Date of Birth' },
  { value: 'club', label: 'Club' },
  { value: 'grade', label: 'Grade/Belt' },
  { value: 'weight', label: 'Weight (kg)' },
  { value: 'gender', label: 'Gender' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
];

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: ParsedRow = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ''; });
    return row;
  });
  return { headers, rows };
}

function guessMapping(header: string): string {
  const h = header.toLowerCase();
  if (h.includes('first') || h === 'fname') return 'firstName';
  if (h.includes('last') || h.includes('sur') || h === 'lname') return 'surname';
  if (h.includes('dob') || h.includes('birth')) return 'dateOfBirth';
  if (h.includes('club') || h.includes('team') || h.includes('dojo')) return 'club';
  if (h.includes('grade') || h.includes('belt') || h.includes('rank')) return 'grade';
  if (h.includes('weight') || h === 'kg') return 'weight';
  if (h.includes('gender') || h.includes('sex')) return 'gender';
  if (h.includes('email') || h.includes('mail')) return 'email';
  if (h.includes('phone') || h.includes('tel') || h.includes('mobile')) return 'phone';
  return 'skip';
}

export default function ImportPage() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers: h, rows: r } = parseCSV(text);
      setHeaders(h);
      setRows(r);
      const autoMap: Record<string, string> = {};
      h.forEach(header => { autoMap[header] = guessMapping(header); });
      setMapping(autoMap);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true);
    const res = await fetch('/api/athletes/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers, rows, mapping }),
    });
    const data = await res.json();
    setResult(data);
    setImporting(false);
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/admin/athletes" className="text-sm" style={{ color: '#0066cc' }}>← Athletes</Link>
        <h1 className="text-2xl font-bold text-white mt-2">Import Athletes from CSV</h1>
        <p className="text-sm mt-1" style={{ color: '#888' }}>Upload a CSV file and map columns to athlete fields.</p>
      </div>

      {/* Upload area */}
      <div
        className="card text-center py-12 cursor-pointer mb-6"
        style={{ border: '2px dashed rgba(255,255,255,0.15)' }}
        onClick={() => fileRef.current?.click()}
      >
        <div className="text-4xl mb-3">📥</div>
        <div className="text-white font-medium mb-1">Click to upload CSV</div>
        <div className="text-sm" style={{ color: '#666' }}>or drag and drop here</div>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      </div>

      {/* Column mapping */}
      {headers.length > 0 && (
        <>
          <div className="card mb-6">
            <h2 className="font-semibold text-white mb-4">Map Columns ({headers.length} columns detected)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {headers.map(header => (
                <div key={header}>
                  <label className="block text-sm mb-1 font-medium text-white">{header}</label>
                  <div className="text-xs mb-1" style={{ color: '#555' }}>
                    e.g. &ldquo;{rows[0]?.[header] || '—'}&rdquo;
                  </div>
                  <select
                    value={mapping[header] || 'skip'}
                    onChange={e => setMapping(p => ({...p, [header]: e.target.value}))}
                  >
                    {ATHLETE_FIELDS.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="card mb-6 overflow-x-auto">
            <h2 className="font-semibold text-white mb-4">Preview ({Math.min(5, rows.length)} of {rows.length} rows)</h2>
            <table>
              <thead>
                <tr>
                  {headers.map(h => (
                    <th key={h}>{h} {mapping[h] && mapping[h] !== 'skip' ? <span style={{ color: '#0066cc' }}>→ {mapping[h]}</span> : ''}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    {headers.map(h => (
                      <td key={h} style={{ color: mapping[h] === 'skip' ? '#444' : '#aaa' }}>{row[h] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            className="btn-primary"
            onClick={handleImport}
            disabled={importing}
          >
            {importing ? 'Importing...' : `Import ${rows.length} Athletes`}
          </button>
        </>
      )}

      {/* Result */}
      {result && (
        <div className="card mt-6" style={{ borderColor: result.errors.length === 0 ? 'rgba(0,170,100,0.3)' : 'rgba(204,34,0,0.3)' }}>
          <h2 className="font-semibold text-white mb-3">Import Complete</h2>
          <div className="flex gap-6 mb-3">
            <div>
              <span className="text-2xl font-bold" style={{ color: '#4dffaa' }}>{result.created}</span>
              <span className="text-sm ml-2" style={{ color: '#888' }}>created</span>
            </div>
            <div>
              <span className="text-2xl font-bold" style={{ color: '#4da6ff' }}>{result.updated}</span>
              <span className="text-sm ml-2" style={{ color: '#888' }}>updated</span>
            </div>
            <div>
              <span className="text-2xl font-bold" style={{ color: '#ff6644' }}>{result.errors.length}</span>
              <span className="text-sm ml-2" style={{ color: '#888' }}>errors</span>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-3">
              <div className="text-sm font-medium mb-2" style={{ color: '#ff6644' }}>Errors:</div>
              <ul className="text-xs space-y-1" style={{ color: '#888' }}>
                {result.errors.slice(0, 10).map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          )}
          <Link href="/admin/athletes" className="btn-primary mt-4 inline-block">View Athletes →</Link>
        </div>
      )}
    </div>
  );
}
