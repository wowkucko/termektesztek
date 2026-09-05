import { z } from 'zod';

export const postSchema = z.object({
  title: z.string().min(3, 'A cím legalább 3 karakter legyen.'),
  slug: z.string().optional(),
  excerpt: z.string().min(10, 'Az összefoglaló legalább 10 karakter legyen.'),
  content: z.string().min(10, 'A tartalom legalább 10 karakter legyen.'),
  coverImage: z.string().optional().nullable(),
  coverImageAlt: z.string().optional().nullable(),
  // Kategória ID vagy slug alapján (a push-script slugot küld, mert a DB-id-k
  // gépenként eltérnek). A PUT űrlap mindig ID-t küld.
  categoryId: z.string().min(1, 'Válassz kategóriát.').optional(),
  categorySlug: z.string().min(1).optional(),
  priceFt: z.number().int().positive().nullable().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(['DRAFT', 'PUBLISHED']),
  productName: z.string().optional().nullable(),
  productBrand: z.string().optional().nullable(),
  rating: z.number().min(0).max(10).nullable().optional(),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  verdict: z.string().optional().nullable(),
  affiliateUrl: z.string().optional().nullable(),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  ogImage: z.string().optional().nullable(),
});

export type PostInput = z.infer<typeof postSchema>;

export const categorySchema = z.object({
  name: z.string().min(2, 'A név legalább 2 karakter legyen.'),
  slug: z.string().optional(),
  description: z.string().optional().nullable(),
});

export const tagSchema = z.object({
  name: z.string().min(1, 'A név nem lehet üres.'),
  slug: z.string().optional(),
});
