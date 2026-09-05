'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { slugify } from '@/lib/utils';
import MarkdownEditor from './MarkdownEditor';
import ImageUploader from './ImageUploader';
import DynamicListInput from './DynamicListInput';
import TagInput from './TagInput';

type Category = { id: string; name: string };

export type PostFormInitial = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  coverImageAlt: string | null;
  categoryId: string;
  tags: string[];
  status: 'DRAFT' | 'PUBLISHED';
  productName: string | null;
  productBrand: string | null;
  rating: number | null;
  pros: string[];
  cons: string[];
  verdict: string | null;
  affiliateUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: string | null;
};

const emptyPost: PostFormInitial = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  coverImage: null,
  coverImageAlt: null,
  categoryId: '',
  tags: [],
  status: 'DRAFT',
  productName: null,
  productBrand: null,
  rating: null,
  pros: [],
  cons: [],
  verdict: null,
  affiliateUrl: null,
  seoTitle: null,
  seoDescription: null,
  ogImage: null,
};

type Tab = 'content' | 'product' | 'seo' | 'settings';

const tabs: { id: Tab; label: string }[] = [
  { id: 'content', label: 'Tartalom' },
  { id: 'product', label: 'Termék adatok' },
  { id: 'seo', label: 'SEO' },
  { id: 'settings', label: 'Beállítások' },
];

export default function PostForm({
  categories,
  allTagNames,
  initial,
}: {
  categories: Category[];
  allTagNames: string[];
  initial?: PostFormInitial;
}) {
  const router = useRouter();
  const isEditing = Boolean(initial?.id);
  const [form, setForm] = useState<PostFormInitial>(initial ?? { ...emptyPost, categoryId: categories[0]?.id ?? '' });
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [activeTab, setActiveTab] = useState<Tab>('content');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugPreview = useMemo(() => (slugTouched ? form.slug : slugify(form.title)), [form.title, form.slug, slugTouched]);

  function update<K extends keyof PostFormInitial>(key: K, value: PostFormInitial[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload = {
      title: form.title,
      slug: slugPreview,
      excerpt: form.excerpt,
      content: form.content,
      coverImage: form.coverImage,
      coverImageAlt: form.coverImageAlt,
      categoryId: form.categoryId,
      tags: form.tags,
      status: form.status,
      productName: form.productName,
      productBrand: form.productBrand,
      rating: form.rating,
      pros: form.pros.filter((p) => p.trim() !== ''),
      cons: form.cons.filter((c) => c.trim() !== ''),
      verdict: form.verdict,
      affiliateUrl: form.affiliateUrl,
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
      ogImage: form.ogImage,
    };

    try {
      const res = await fetch(isEditing ? `/api/admin/posts/${initial!.id}` : '/api/admin/posts', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'A mentés sikertelen.');
        setSubmitting(false);
        return;
      }

      router.push('/admin/posts');
      router.refresh();
    } catch {
      setError('Hálózati hiba történt. Ellenőrizd a kapcsolatot, majd próbáld újra.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink">
          {isEditing ? 'Bejegyzés szerkesztése' : 'Új bejegyzés'}
        </h1>
        <div className="flex items-center gap-3">
          <Link href="/admin/posts" className="btn-secondary">
            Mégse
          </Link>
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-60">
            {submitting ? 'Mentés…' : 'Mentés'}
          </button>
        </div>
      </div>

      {error && <p className="mt-4 rounded-tight bg-con/10 px-4 py-3 font-sans text-sm text-con">{error}</p>}

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label="Bejegyzés szakaszai">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 font-sans text-sm font-semibold transition-colors ${
              activeTab === tab.id ? 'border-signal text-signal' : 'border-transparent text-ink/50 hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="mt-6 rounded-card border border-line bg-white p-6"
      >
        {activeTab === 'content' && (
          <div className="space-y-6">
            <div>
              <label className="field-label" htmlFor="title">Cím</label>
              <input
                id="title"
                type="text"
                required
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                className="field-input"
                placeholder="pl. Minta Termék X1 teszt: érdemes megvenni?"
              />
              <p className="mt-1.5 font-sans text-xs text-ink/40">
                URL:&nbsp;
                <button
                  type="button"
                  onClick={() => setSlugTouched(true)}
                  className="underline decoration-dotted underline-offset-2 hover:text-teal-600"
                  title="Kattints a kézi szerkesztéshez"
                >
                  /blog/{slugPreview || '...'}
                </button>
              </p>
              {slugTouched && (
                <input
                  type="text"
                  value={form.slug || slugPreview}
                  onChange={(e) => update('slug', e.target.value)}
                  className="field-input mt-2 max-w-sm"
                />
              )}
            </div>

            <div>
              <label className="field-label" htmlFor="excerpt">Rövid összefoglaló</label>
              <textarea
                id="excerpt"
                required
                rows={2}
                value={form.excerpt}
                onChange={(e) => update('excerpt', e.target.value)}
                className="field-input"
                placeholder="1-2 mondatos összefoglaló, ez jelenik meg a kártyákon és a keresőkben."
              />
            </div>

            <ImageUploader
              label="Borítókép"
              value={form.coverImage}
              onChange={(url) => update('coverImage', url)}
              altValue={form.coverImageAlt || ''}
              onAltChange={(alt) => update('coverImageAlt', alt)}
            />

            <div>
              <label className="field-label">Tartalom</label>
              <MarkdownEditor value={form.content} onChange={(v) => update('content', v)} />
            </div>
          </div>
        )}

        {activeTab === 'product' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="productName">Termék neve</label>
                <input
                  id="productName"
                  type="text"
                  value={form.productName || ''}
                  onChange={(e) => update('productName', e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="productBrand">Márka</label>
                <input
                  id="productBrand"
                  type="text"
                  value={form.productBrand || ''}
                  onChange={(e) => update('productBrand', e.target.value)}
                  className="field-input"
                />
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="rating">Értékelés (0–10)</label>
              <input
                id="rating"
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={form.rating ?? ''}
                onChange={(e) => update('rating', e.target.value === '' ? null : Number(e.target.value))}
                className="field-input max-w-[10rem]"
                placeholder="pl. 8.4"
              />
              <p className="mt-1.5 font-sans text-xs text-ink/40">
                Ha kitöltöd, a nyilvános oldalon megjelenik a verdikt-pecsét, és a Google találatokban is
                megjelenhet csillagos értékelésként.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <DynamicListInput
                label="Előnyök"
                items={form.pros}
                onChange={(items) => update('pros', items)}
                placeholder="pl. Kiváló akkumulátor-üzemidő"
                accent="pro"
              />
              <DynamicListInput
                label="Hátrányok"
                items={form.cons}
                onChange={(items) => update('cons', items)}
                placeholder="pl. Magas ár"
                accent="con"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="verdict">Végső verdikt</label>
              <textarea
                id="verdict"
                rows={3}
                value={form.verdict || ''}
                onChange={(e) => update('verdict', e.target.value)}
                className="field-input"
                placeholder="A cikk végén kiemelt dobozban megjelenő rövid összegzés."
              />
            </div>

            <div>
              <label className="field-label" htmlFor="affiliateUrl">Vásárlási / affiliate link</label>
              <input
                id="affiliateUrl"
                type="url"
                value={form.affiliateUrl || ''}
                onChange={(e) => update('affiliateUrl', e.target.value)}
                className="field-input"
                placeholder="https://"
              />
            </div>
          </div>
        )}

        {activeTab === 'seo' && (
          <div className="space-y-6">
            <div>
              <label className="field-label" htmlFor="seoTitle">SEO cím (ha üres, a cikk címe lesz)</label>
              <input
                id="seoTitle"
                type="text"
                value={form.seoTitle || ''}
                onChange={(e) => update('seoTitle', e.target.value)}
                className="field-input"
                maxLength={70}
              />
              <p className="mt-1 font-sans text-xs text-ink/40">{(form.seoTitle || '').length}/70 karakter</p>
            </div>

            <div>
              <label className="field-label" htmlFor="seoDescription">SEO leírás (ha üres, az összefoglaló lesz)</label>
              <textarea
                id="seoDescription"
                rows={3}
                value={form.seoDescription || ''}
                onChange={(e) => update('seoDescription', e.target.value)}
                className="field-input"
                maxLength={160}
              />
              <p className="mt-1 font-sans text-xs text-ink/40">{(form.seoDescription || '').length}/160 karakter</p>
            </div>

            <ImageUploader
              label="Egyedi megosztási kép (Open Graph) — ha üres, a borítókép lesz használva"
              value={form.ogImage}
              onChange={(url) => update('ogImage', url)}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <label className="field-label" htmlFor="category">Kategória</label>
              <select
                id="category"
                required
                value={form.categoryId}
                onChange={(e) => update('categoryId', e.target.value)}
                className="field-input max-w-sm"
              >
                <option value="" disabled>Válassz kategóriát</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <TagInput value={form.tags} onChange={(tags) => update('tags', tags)} suggestions={allTagNames} />

            <div>
              <label className="field-label" htmlFor="status">Állapot</label>
              <select
                id="status"
                value={form.status}
                onChange={(e) => update('status', e.target.value as 'DRAFT' | 'PUBLISHED')}
                className="field-input max-w-sm"
              >
                <option value="DRAFT">Piszkozat (nem publikus)</option>
                <option value="PUBLISHED">Publikált</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
