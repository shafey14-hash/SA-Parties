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
        "SELECT id, color_name, color_code, stock FROM product_colors WHERE product_id = $1",
        [product.id],
      );
      product.colors = colorsResult.rows;

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

// 2. Create Product (Including Slug, Keywords, Multiple Images, and Colors)
const createProduct = async (req, res) => {
  const {
    category_id,
    name,
    description,
    price,
    stock,
    keywords,
    colors,
    length,
    width,
    height,
    weight,
  } = req.body;
  const files = req.files; // multer memoryStorage → each file has .buffer

  if (!name || !price || !stock) {
    return res
      .status(400)
      .json({ error: "Name, Price, and Stock are required!" });
  }

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
      "INSERT INTO products (category_id, name, description, price, stock, image_url, slug, keywords, length, width, height, weight) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id",
      [
        category_id || null,
        name,
        description,
        price,
        stock,
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
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
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

    // Insert colors
    if (colors) {
      const colorsData = JSON.parse(colors);
      for (let color of colorsData) {
        await connection.query(
          "INSERT INTO product_colors (product_id, color_name, color_code, stock) VALUES ($1, $2, $3, $4)",
          [productId, color.name, color.code, color.stock],
        );
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
    stock,
    keywords,
    deletedImages,
    colors,
  } = req.body;
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

    // 3. Sync color variants. The form always resends the FULL current set,
    // so replace-all is the simplest correct approach: wipe this product's
    // rows and reinsert whatever came in. Without this, editing/adding a
    // variant never reached the database at all.
    if (colors !== undefined) {
      let colorsData = [];
      try {
        const parsed = JSON.parse(colors);
        if (Array.isArray(parsed)) colorsData = parsed;
      } catch (e) {
        colorsData = [];
      }
      await connection.query(
        "DELETE FROM product_colors WHERE product_id = $1",
        [id],
      );
      for (const color of colorsData) {
        await connection.query(
          "INSERT INTO product_colors (product_id, color_name, color_code, stock) VALUES ($1, $2, $3, $4)",
          [id, color.name, color.code, color.stock],
        );
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
       SET name = $1, description = $2, price = $3, stock = $4,
           category_id = $5, keywords = $6, slug = COALESCE($7, slug),
           image_url = $8
       WHERE id = $9`,
      [
        name,
        description,
        price,
        stock,
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
    for (const row of imagesResult.rows) {
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
