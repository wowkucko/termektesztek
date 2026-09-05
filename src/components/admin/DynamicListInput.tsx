'use client';

export default function DynamicListInput({
  label,
  items,
  onChange,
  placeholder,
  accent = 'default',
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  accent?: 'pro' | 'con' | 'default';
}) {
  function updateItem(index: number, value: string) {
    const next = [...items];
    next[index] = value;
    onChange(next);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...items, '']);
  }

  const accentClass = accent === 'pro' ? 'focus:border-pro' : accent === 'con' ? 'focus:border-con' : 'focus:border-teal-500';

  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder={placeholder}
              className={`field-input ${accentClass}`}
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              aria-label="Elem eltávolítása"
              className="shrink-0 rounded-tight border border-ink/15 px-2.5 py-2.5 text-ink/50 hover:border-con hover:text-con"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addItem}
        className="mt-2 font-sans text-sm font-medium text-teal-600 hover:text-teal-700"
      >
        + Új sor hozzáadása
      </button>
    </div>
  );
}
