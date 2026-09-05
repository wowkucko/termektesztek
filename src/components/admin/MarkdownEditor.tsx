'use client';

import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ToolbarAction = {
  label: string;
  title: string;
  apply: (selected: string) => { text: string; cursorOffset?: number };
};

const toolbarActions: ToolbarAction[] = [
  { label: 'B', title: 'Félkövér', apply: (s) => ({ text: `**${s || 'félkövér szöveg'}**` }) },
  { label: 'I', title: 'Dőlt', apply: (s) => ({ text: `*${s || 'dőlt szöveg'}*` }) },
  { label: 'H2', title: 'Alcím', apply: (s) => ({ text: `\n## ${s || 'Alcím'}\n` }) },
  { label: 'H3', title: 'Kis alcím', apply: (s) => ({ text: `\n### ${s || 'Kis alcím'}\n` }) },
  { label: '❝', title: 'Idézet', apply: (s) => ({ text: `\n> ${s || 'Idézet'}\n` }) },
  { label: '•', title: 'Felsorolás', apply: (s) => ({ text: `\n- ${s || 'Elem'}\n- \n` }) },
  { label: '🔗', title: 'Link', apply: (s) => ({ text: `[${s || 'link szövege'}](https://)` }) },
  { label: '🖼', title: 'Kép', apply: (s) => ({ text: `![${s || 'kép leírása'}](/uploads/kep.jpg)` }) },
];

export default function MarkdownEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  function applyAction(action: ToolbarAction) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const { text } = action.apply(selected);

    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + text.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between rounded-t-tight border border-b-0 border-ink/15 bg-paper px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-1">
          {toolbarActions.map((action) => (
            <button
              key={action.label}
              type="button"
              title={action.title}
              onClick={() => applyAction(action)}
              className="rounded-tight px-2.5 py-1.5 font-sans text-sm font-semibold text-ink/60 hover:bg-white hover:text-ink"
            >
              {action.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-chip bg-white p-1">
          <button
            type="button"
            onClick={() => setMode('write')}
            className={`rounded-chip px-3 py-1 font-sans text-xs font-semibold ${mode === 'write' ? 'bg-ink text-white' : 'text-ink/50'}`}
          >
            Írás
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`rounded-chip px-3 py-1 font-sans text-xs font-semibold ${mode === 'preview' ? 'bg-ink text-white' : 'text-ink/50'}`}
          >
            Előnézet
          </button>
        </div>
      </div>

      {mode === 'write' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={20}
          placeholder="Írd meg a tesztet Markdown formázással. Használd a fenti eszköztárat, vagy gépelj közvetlenül **, *, ##, - stb. jeleket."
          className="w-full rounded-b-tight border border-ink/15 bg-white px-4 py-3 font-body text-sm leading-relaxed text-ink placeholder:text-ink/35 focus:outline-none"
        />
      ) : (
        <div className="post-content min-h-[20rem] rounded-b-tight border border-ink/15 bg-white px-4 py-3">
          {value.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          ) : (
            <p className="font-body text-sm text-ink/40">Nincs még megjeleníthető tartalom.</p>
          )}
        </div>
      )}
    </div>
  );
}
