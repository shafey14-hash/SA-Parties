const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
);

/**
 * Uploads a single file buffer to a Supabase Storage bucket and returns its public URL.
 * @param {string} bucket - bucket name, e.g. "product-images"
 * @param {Buffer} buffer - file buffer (from multer memoryStorage, req.file.buffer)
 * @param {string} filename - unique path/filename to store as, e.g. "products/12/1699999-0.jpg"
 * @param {string} mimetype - file mimetype, e.g. "image/jpeg"
 */
async function uploadToStorage(bucket, buffer, filename, mimetype) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, {
      contentType: mimetype,
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
  return data.publicUrl;
}

/**
 * Deletes a file from a Supabase Storage bucket given its stored path (not full URL).
 */
async function deleteFromStorage(bucket, filename) {
  const { error } = await supabase.storage.from(bucket).remove([filename]);
  if (error) console.error("Storage delete error:", error.message);
}

module.exports = { supabase, uploadToStorage, deleteFromStorage };
