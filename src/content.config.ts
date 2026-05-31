import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const dealsCollection = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/deals" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(), // e.g., "Marketing", "SEO", "CRM", "DevTools"
    founder: z.string().optional(),
    originalPrice: z.string(),
    ltdPrice: z.string(),
    features: z.array(z.string()),
    isHot: z.boolean().default(false),
    publishedAt: z.date()
  }),
});

export const collections = {
  'deals': dealsCollection,
};
