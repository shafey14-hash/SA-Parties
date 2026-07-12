const db = require("../config/db");
const path = require("path");
const { uploadToStorage } = require("../config/supabaseStorage");

const PRODUCT_BUCKET = "product-images";

// 1. Get all products (with Search support and Colors)
const getAllProducts = async (req, res) => {
  const { search } = req.query;
  try {
    let query = `
      SELECT p.*, c.name AS category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id
    `;
    let params = [];

    if (search) {
      // Postgres LIKE is case-sensitive, ILIKE matches MySQL's default case-insensitive behavior
      query += " WHERE p.name ILIKE $1 OR p.keywords ILIKE $2";
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
    const result = await db.query("SELECT * FROM products WHERE slug = $1", [
      slug,
    ]);
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
  const { category_id, name, description, price, stock, keywords } = req.body;
  // upload.any() puts every file in req.files (even for a single-file update form)
  const file =
    req.file || (req.files && req.files.length > 0 ? req.files[0] : null);

  const baseSlug = name
    ? name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    : null;
  const slug = baseSlug ? `${baseSlug}-${id}` : null; // ID se unique rakho update mein

  try {
    let image_url = null;
    if (file) {
      const ext = path.extname(file.originalname) || ".jpg";
      const storagePath = `products/${id}/${Date.now()}${ext}`;
      image_url = await uploadToStorage(
        PRODUCT_BUCKET,
        file.buffer,
        storagePath,
        file.mimetype,
      );
    }

    let query =
      "UPDATE products SET name = $1, description = $2, price = $3, stock = $4, category_id = $5, keywords = $6, slug = $7";
    let params = [
      name,
      description,
      price,
      stock,
      category_id || null,
      keywords || "",
      slug,
    ];

    let paramIndex = 8;
    if (image_url) {
      query += `, image_url = $${paramIndex}`;
      params.push(image_url);
      paramIndex++;
    }

    query += ` WHERE id = $${paramIndex}`;
    params.push(id);

    const result = await db.query(query, params);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.status(200).json({ message: "Product updated successfully!", slug });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Product update error", details: error.message });
  }
};

// 5. Delete Product by ID
const deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query("DELETE FROM products WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.status(200).json({ message: "Product deleted successfully!" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Product delete error", details: error.message });
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
