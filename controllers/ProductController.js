const db = require("../config/db");
const path = require("path");
const {
  uploadToStorage,
  deleteFromStorage,
} = require("../config/supabaseStorage");

const PRODUCT_BUCKET = "product-images";

// Turns a Supabase public URL back into the storage path Supabase Storage
// needs for delete (e.g. "products/12/17009-0.jpg"), so we can remove the
// actual file, not just the DB row that points to it.
function extractStoragePath(publicUrl, bucket) {
  if (!publicUrl) return null;
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.slice(idx + marker.length));
}

// 1. Get all products (with Search support and Colors)
const getAllProducts = async (req, res) => {
  const { search } = req.query;
  try {
    let query = `
      SELECT p.*, c.name AS category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_deleted = FALSE
    `;
    let params = [];

    if (search) {
      // Postgres LIKE is case-sensitive, ILIKE matches MySQL's default case-insensitive behavior
      query += " AND (p.name ILIKE $1 OR p.keywords ILIKE $2)";
      params = [`%${search}%`, `%${search}%`];
    }

    query += " ORDER BY p.id DESC";

    const result = await db.query(query, params);
    const rows = result.rows;

    // Fetch colors for each product
    for (let product of rows) {
      const colorsResult = await db.query(
        "SELECT id, color_name, image_url, in_stock FROM product_colors WHERE product_id = $1",
        [product.id],
      );
      product.colors = colorsResult.rows;

      // Each variant can have multiple photos
      for (let color of product.colors) {
        const colorImagesResult = await db.query(
          "SELECT image_url FROM product_color_images WHERE color_id = $1 ORDER BY display_order ASC",
          [color.id],
        );
        color.images = colorImagesResult.rows.map((img) => img.image_url);
      }

      // Fetch multiple images for each product
      const imagesResult = await db.query(
        "SELECT image_url FROM product_images WHERE product_id = $1 ORDER BY display_order ASC",
        [product.id],
      );
      product.images = imagesResult.rows.map((img) => img.image_url);
    }

    res.json(rows);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Products fetch error", details: error.message });
  }
};

// 2. Create Product (Including Slug, Keywords, Multiple Images, and Variants)
const createProduct = async (req, res) => {
  const {
    category_id,
    name,
    description,
    price,
    in_stock,
    keywords,
    colors, // kept as field name for backward compat — these are now "variants" (photo + name only)
    length,
    width,
    height,
    weight,
  } = req.body;
  // upload.any() puts every uploaded file in req.files. Main product image
  // slots use fieldname "images"; each variant's single photo uses
  // fieldname "variantImage_<client_key>" (client_key = the stable index
  // the admin form assigned that variant row).
  const files = req.files || [];
  const mainImageFiles = files.filter((f) => f.fieldname === "images");

  if (!name || !price) {
    return res.status(400).json({ error: "Name and Price are required!" });
  }

  // Admin now picks "In Stock" / "Not in Stock" instead of typing a quantity.
  // FormData sends this as the string "true"/"false".
  const inStockBool = in_stock === "true" || in_stock === true;
  // Legacy numeric column still exists (NOT NULL) — keep it harmless/consistent.
  const legacyStock = inStockBool ? 1 : 0;

  // Slug generator — unique banao timestamp se (duplicate avoid)
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = `${baseSlug}-${Date.now()}`;

  const connection = await db.connect();
  try {
    await connection.query("BEGIN");

    // Insert product first (image_url filled in after upload, once we have productId)
    const insertResult = await connection.query(
      "INSERT INTO products (category_id, name, description, price, stock, in_stock, image_url, slug, keywords, length, width, height, weight) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id",
      [
        category_id || null,
        name,
        description,
        price,
        legacyStock,
        inStockBool,
        "",
        slug,
        keywords || "",
        length || null,
        width || null,
        height || null,
        weight || null,
      ],
    );

    const productId = insertResult.rows[0].id;

    // Upload images to Supabase Storage and record them
    let mainImageUrl = "";
    if (mainImageFiles.length > 0) {
      for (let i = 0; i < mainImageFiles.length; i++) {
        const file = mainImageFiles[i];
        const ext = path.extname(file.originalname) || ".jpg";
        const storagePath = `products/${productId}/${Date.now()}-${i}${ext}`;

        const publicUrl = await uploadToStorage(
          PRODUCT_BUCKET,
          file.buffer,
          storagePath,
          file.mimetype,
        );

        if (i === 0) mainImageUrl = publicUrl;

        await connection.query(
          "INSERT INTO product_images (product_id, image_url, display_order) VALUES ($1, $2, $3)",
          [productId, publicUrl, i],
        );
      }

      // Set the main product image_url to the first uploaded image
      await connection.query(
        "UPDATE products SET image_url = $1 WHERE id = $2",
        [mainImageUrl, productId],
      );
    }

    // Insert variants — each one is a name + in-stock flag + one or more photos
    if (colors) {
      const colorsData = JSON.parse(colors);
      for (let color of colorsData) {
        const colorInStock = color.in_stock !== false; // default true
        // Every file tagged for this variant (FormData can repeat the same
        // field name for multiple files — multer collects them all).
        const variantFiles = files.filter(
          (f) => f.fieldname === `variantImage_${color.client_key}`,
        );

        const colorInsertResult = await connection.query(
          "INSERT INTO product_colors (product_id, color_name, image_url, stock, in_stock) VALUES ($1, $2, $3, $4, $5) RETURNING id",
          [productId, color.name, null, colorInStock ? 1 : 0, colorInStock],
        );
        const colorId = colorInsertResult.rows[0].id;

        let coverUrl = null;
        for (let i = 0; i < variantFiles.length; i++) {
          const vFile = variantFiles[i];
          const ext = path.extname(vFile.originalname) || ".jpg";
          const storagePath = `products/${productId}/variants/${colorId}/${Date.now()}-${i}${ext}`;
          const publicUrl = await uploadToStorage(
            PRODUCT_BUCKET,
            vFile.buffer,
            storagePath,
            vFile.mimetype,
          );
          if (i === 0) coverUrl = publicUrl;
          await connection.query(
            "INSERT INTO product_color_images (color_id, image_url, display_order) VALUES ($1, $2, $3)",
            [colorId, publicUrl, i],
          );
        }

        if (coverUrl) {
          await connection.query(
            "UPDATE product_colors SET image_url = $1 WHERE id = $2",
            [coverUrl, colorId],
          );
        }
      }
    }

    await connection.query("COMMIT");

    res.status(201).json({
      message: "Product added successfully!",
      productId: productId,
      slug: slug,
    });
  } catch (error) {
    await connection.query("ROLLBACK");
    console.error("❌ Product insert error:", error.message);
    // Common errors guide — Postgres error codes instead of MySQL's
    let friendlyMsg = error.message;
    if (error.code === "42P01")
      friendlyMsg = "A required table is missing. Run schema.sql again.";
    else if (error.code === "42703")
      friendlyMsg = `Column missing in DB: ${error.message}. Run the ALTER TABLE commands from schema_fix.sql.`;
    else if (error.code === "23505")
      friendlyMsg =
        "Duplicate slug — this should be auto-fixed now. Try again.";
    res
      .status(500)
      .json({ error: "Database insert error", details: friendlyMsg });
  } finally {
    connection.release();
  }
};

// 3. Get Product by Slug (For Dynamic URL)
const getProductBySlug = async (req, res) => {
  const { slug } = req.params;
  try {
    const result = await db.query(
      "SELECT * FROM products WHERE slug = $1 AND is_deleted = FALSE",
      [slug],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Product not found" });
    res.json(result.rows[0]);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error fetching product", details: error.message });
  }
};

// 4. Update Product by ID
const updateProduct = async (req, res) => {
  const { id } = req.params;
  const {
    category_id,
    name,
    description,
    price,
    in_stock,
    keywords,
    deletedImages,
    colors,
  } = req.body;
  // Admin now picks "In Stock" / "Not in Stock" instead of typing a quantity.
  // FormData sends this as the string "true"/"false".
  const inStockBool = in_stock === "true" || in_stock === true;
  const legacyStock = inStockBool ? 1 : 0;
  // upload.any() puts every uploaded file in req.files. Main product image
  // slots are sent under the "images" field name (see admin.js submit handler) —
  // color images use "colorImages_<name>" and are handled separately, so we
  // filter to just the ones that belong to the main gallery.
  const files = req.files || [];
  const newImageFiles = files.filter((f) => f.fieldname === "images");

  const baseSlug = name
    ? name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    : null;
  const slug = baseSlug ? `${baseSlug}-${id}` : null; // ID se unique rakho update mein

  // deletedImages arrives as a JSON string array of image URLs the admin
  // removed from the preview grid.
  let deletedUrls = [];
  if (deletedImages) {
    try {
      const parsed = JSON.parse(deletedImages);
      if (Array.isArray(parsed)) deletedUrls = parsed;
    } catch (e) {
      deletedUrls = [];
    }
  }

  const connection = await db.connect();
  try {
    await connection.query("BEGIN");

    // 1. Drop the images the admin removed — from the DB first...
    if (deletedUrls.length > 0) {
      await connection.query(
        "DELETE FROM product_images WHERE product_id = $1 AND image_url = ANY($2::text[])",
        [id, deletedUrls],
      );
    }

    // 2. ...upload + record any newly added images, continuing display_order
    if (newImageFiles.length > 0) {
      const orderResult = await connection.query(
        "SELECT COALESCE(MAX(display_order), -1) AS max_order FROM product_images WHERE product_id = $1",
        [id],
      );
      let nextOrder = orderResult.rows[0].max_order + 1;

      for (const file of newImageFiles) {
        const ext = path.extname(file.originalname) || ".jpg";
        const storagePath = `products/${id}/${Date.now()}-${nextOrder}${ext}`;
        const publicUrl = await uploadToStorage(
          PRODUCT_BUCKET,
          file.buffer,
          storagePath,
          file.mimetype,
        );
        await connection.query(
          "INSERT INTO product_images (product_id, image_url, display_order) VALUES ($1, $2, $3)",
          [id, publicUrl, nextOrder],
        );
        nextOrder++;
      }
    }

    // 3. Sync variants (name + in-stock + one or more photos each). The
    // form always resends the FULL current set, so replace-all is the
    // simplest correct approach: wipe this product's rows and reinsert
    // whatever came in. (product_color_images cascade-deletes automatically
    // when its parent product_colors row is deleted.)
    if (colors !== undefined) {
      let colorsData = [];
      try {
        const parsed = JSON.parse(colors);
        if (Array.isArray(parsed)) colorsData = parsed;
      } catch (e) {
        colorsData = [];
      }

      // Remember every old variant photo so we can clean up Storage for
      // any that are no longer used (removed variant, or a removed photo).
      const oldVariantImagesResult = await connection.query(
        `SELECT pci.image_url FROM product_color_images pci
         JOIN product_colors pc ON pc.id = pci.color_id
         WHERE pc.product_id = $1`,
        [id],
      );
      const oldVariantImageUrls = oldVariantImagesResult.rows.map(
        (r) => r.image_url,
      );

      // Cascade-deletes product_color_images too
      await connection.query(
        "DELETE FROM product_colors WHERE product_id = $1",
        [id],
      );

      const keptVariantImageUrls = [];
      for (const color of colorsData) {
        const colorInStock = color.in_stock !== false; // default true

        // Existing photos the admin kept (didn't remove from the preview)
        let existingUrls = [];
        if (Array.isArray(color.existing_image_urls)) {
          existingUrls = color.existing_image_urls.filter(Boolean);
        } else if (color.existing_image_url) {
          existingUrls = [color.existing_image_url]; // back-compat, single-photo era
        }

        // Newly uploaded photos for this variant (same field name can repeat)
        const variantFiles = files.filter(
          (f) => f.fieldname === `variantImage_${color.client_key}`,
        );

        const colorInsertResult = await connection.query(
          "INSERT INTO product_colors (product_id, color_name, image_url, stock, in_stock) VALUES ($1, $2, $3, $4, $5) RETURNING id",
          [id, color.name, null, colorInStock ? 1 : 0, colorInStock],
        );
        const colorId = colorInsertResult.rows[0].id;

        let order = 0;
        const finalUrls = [];

        for (const url of existingUrls) {
          await connection.query(
            "INSERT INTO product_color_images (color_id, image_url, display_order) VALUES ($1, $2, $3)",
            [colorId, url, order],
          );
          finalUrls.push(url);
          order++;
        }

        for (const vFile of variantFiles) {
          const ext = path.extname(vFile.originalname) || ".jpg";
          const storagePath = `products/${id}/variants/${colorId}/${Date.now()}-${order}${ext}`;
          const publicUrl = await uploadToStorage(
            PRODUCT_BUCKET,
            vFile.buffer,
            storagePath,
            vFile.mimetype,
          );
          await connection.query(
            "INSERT INTO product_color_images (color_id, image_url, display_order) VALUES ($1, $2, $3)",
            [colorId, publicUrl, order],
          );
          finalUrls.push(publicUrl);
          order++;
        }

        keptVariantImageUrls.push(...finalUrls);

        if (finalUrls.length > 0) {
          await connection.query(
            "UPDATE product_colors SET image_url = $1 WHERE id = $2",
            [finalUrls[0], colorId],
          );
        }
      }

      // Best-effort: remove variant photos that are no longer referenced
      // by any variant (deleted variant, removed photo, or replaced photo).
      const orphanedVariantUrls = oldVariantImageUrls.filter(
        (url) => !keptVariantImageUrls.includes(url),
      );
      for (const url of orphanedVariantUrls) {
        const storagePath = extractStoragePath(url, PRODUCT_BUCKET);
        if (storagePath) {
          await deleteFromStorage(PRODUCT_BUCKET, storagePath).catch(() => {});
        }
      }
    }

    // 4. Keep products.image_url (the card/cover thumbnail) pointing at
    // whatever the first remaining gallery image is, so it never shows a
    // deleted image again.
    const coverResult = await connection.query(
      "SELECT image_url FROM product_images WHERE product_id = $1 ORDER BY display_order ASC LIMIT 1",
      [id],
    );
    const coverImageUrl =
      coverResult.rows.length > 0 ? coverResult.rows[0].image_url : "";

    // 5. Update the product's own fields (slug only changes if a new name came in)
    const result = await connection.query(
      `UPDATE products
       SET name = $1, description = $2, price = $3, stock = $4, in_stock = $5,
           category_id = $6, keywords = $7, slug = COALESCE($8, slug),
           image_url = $9
       WHERE id = $10`,
      [
        name,
        description,
        price,
        legacyStock,
        inStockBool,
        category_id || null,
        keywords || "",
        slug,
        coverImageUrl,
        id,
      ],
    );

    if (result.rowCount === 0) {
      await connection.query("ROLLBACK");
      return res.status(404).json({ error: "Product not found" });
    }

    await connection.query("COMMIT");

    // 6. Best-effort: remove the actual deleted files from Supabase Storage too.
    // DB is already consistent at this point even if this part fails.
    for (const url of deletedUrls) {
      const storagePath = extractStoragePath(url, PRODUCT_BUCKET);
      if (storagePath) {
        await deleteFromStorage(PRODUCT_BUCKET, storagePath).catch(() => {});
      }
    }

    res.status(200).json({ message: "Product updated successfully!", slug });
  } catch (error) {
    await connection.query("ROLLBACK");
    console.error("❌ Product update error:", error.message);
    res
      .status(500)
      .json({ error: "Product update error", details: error.message });
  } finally {
    connection.release();
  }
};

// 5. Delete Product by ID
const deleteProduct = async (req, res) => {
  const { id } = req.params;
  const connection = await db.connect();
  try {
    await connection.query("BEGIN");

    // order_items.product_id is ON DELETE RESTRICT on purpose — a product
    // that's part of someone's order history must never be hard-deleted, or
    // that order's line items would break. If it's been ordered, archive it
    // (hide it everywhere) instead of removing the row.
    const orderRefResult = await connection.query(
      "SELECT 1 FROM order_items WHERE product_id = $1 LIMIT 1",
      [id],
    );

    if (orderRefResult.rows.length > 0) {
      const archiveResult = await connection.query(
        "UPDATE products SET is_deleted = TRUE WHERE id = $1",
        [id],
      );
      if (archiveResult.rowCount === 0) {
        await connection.query("ROLLBACK");
        return res.status(404).json({ error: "Product not found" });
      }
      await connection.query("COMMIT");
      return res.status(200).json({
        message:
          "This product has order history, so it was archived (hidden from the store) instead of permanently deleted.",
        archived: true,
      });
    }

    // Grab image URLs first so we can clean up Storage after the DB rows are gone
    const imagesResult = await connection.query(
      "SELECT image_url FROM product_images WHERE product_id = $1",
      [id],
    );
    const variantImagesResult = await connection.query(
      `SELECT pci.image_url FROM product_color_images pci
       JOIN product_colors pc ON pc.id = pci.color_id
       WHERE pc.product_id = $1`,
      [id],
    );

    // Products has other tables pointing at it (images, colors) — a plain
    // DELETE FROM products was failing on the foreign key constraint. Remove
    // the dependent rows first, then the product itself, all in one transaction.
    await connection.query("DELETE FROM product_images WHERE product_id = $1", [
      id,
    ]);
    await connection.query("DELETE FROM product_colors WHERE product_id = $1", [
      id,
    ]);

    const result = await connection.query(
      "DELETE FROM products WHERE id = $1",
      [id],
    );

    if (result.rowCount === 0) {
      await connection.query("ROLLBACK");
      return res.status(404).json({ error: "Product not found" });
    }

    await connection.query("COMMIT");

    // Best-effort Storage cleanup — DB is already consistent even if this fails
    for (const row of [...imagesResult.rows, ...variantImagesResult.rows]) {
      const storagePath = extractStoragePath(row.image_url, PRODUCT_BUCKET);
      if (storagePath) {
        await deleteFromStorage(PRODUCT_BUCKET, storagePath).catch(() => {});
      }
    }

    res.status(200).json({ message: "Product deleted successfully!" });
  } catch (error) {
    await connection.query("ROLLBACK");
    console.error("❌ Product delete error:", error.message);
    let friendlyMsg = error.message;
    if (error.code === "23503") {
      friendlyMsg =
        "This product is still referenced elsewhere and can't be deleted.";
    }
    res
      .status(500)
      .json({ error: "Product delete error", details: friendlyMsg });
  } finally {
    connection.release();
  }
};

const getProductById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query("SELECT * FROM products WHERE id = $1", [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Product not found" });
    res.json(result.rows[0]);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error fetching product", details: error.message });
  }
};

module.exports = {
  getAllProducts,
  createProduct,
  getProductBySlug,
  updateProduct,
  deleteProduct,
  getProductById,
};
