-- ============================================================
-- Storage bucket: vehicle-documents
-- Accepts PDF, images, Word, Excel — max 10 MB
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-documents',
  'vehicle-documents',
  true,
  10485760,  -- 10 MB
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.ms-excel'
  ]
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Storage RLS policies
-- ============================================================

CREATE POLICY "authenticated_upload_vehicle_docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vehicle-documents');

CREATE POLICY "authenticated_read_vehicle_docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'vehicle-documents');

CREATE POLICY "authenticated_delete_vehicle_docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'vehicle-documents');
