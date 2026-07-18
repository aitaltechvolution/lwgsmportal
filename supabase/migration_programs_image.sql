-- Add image_url column to programs table
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS image_url text;

-- Update existing programs with free Unsplash images (no logos, generic business/study photos)
UPDATE public.programs SET image_url = CASE id
  WHEN '11111111-0000-0000-0000-000000000001' THEN 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80&fit=crop'
  WHEN '11111111-0000-0000-0000-000000000002' THEN 'https://images.unsplash.com/photo-1521737852567-6949f3f9f2b5?w=800&q=80&fit=crop'
  WHEN '11111111-0000-0000-0000-000000000003' THEN 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80&fit=crop'
  WHEN '11111111-0000-0000-0000-000000000004' THEN 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80&fit=crop'
  WHEN '11111111-0000-0000-0000-000000000005' THEN 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=800&q=80&fit=crop'
  WHEN '11111111-0000-0000-0000-000000000006' THEN 'https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?w=800&q=80&fit=crop'
  WHEN '11111111-0000-0000-0000-000000000007' THEN 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80&fit=crop'
  WHEN '11111111-0000-0000-0000-000000000008' THEN 'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=800&q=80&fit=crop'
  WHEN '11111111-0000-0000-0000-000000000009' THEN 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80&fit=crop'
  WHEN '11111111-0000-0000-0000-000000000010' THEN 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&q=80&fit=crop'
  ELSE 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&q=80&fit=crop'
END;

SELECT id, title, image_url FROM public.programs ORDER BY type, title;
