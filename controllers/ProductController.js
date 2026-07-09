const db = require("../config/db");

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
      query += " WHERE p.name LIKE ? OR p.keywords LIKE ?";
      params = [`%${search}%`, `%${search}%`];
    }

    query += " ORDER BY p.id DESC";

    const [rows] = await db.query(query, params);

    // Fetch colors for each product
    for (let product of rows) {
      const [colors] = await db.query(
        "SELECT id, color_name, color_code, stock FROM product_colors WHERE product_id = ?",
        [product.id],
      );
      product.colors = colors;

      // Fetch multiple images for each product
      const [images] = await db.query(
        "SELECT image_url FROM product_images WHERE product_id = ? ORDER BY display_order ASC",
        [product.id],
      );
      product.images = images.map((img) => img.image_url);
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
  const files = req.files;
  const image_url =
    files && files.length > 0 ? `/uploads/${files[0].filename}` : "";

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

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      "INSERT INTO products (category_id, name, description, price, stock, image_url, slug, keywords, length, width, height, weight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        category_id || null,
        name,
        description,
        price,
        stock,
        image_url,
        slug,
        keywords || "",
        length || null,
        width || null,
        height || null,
        weight || null,
      ],
    );

    const productId = result.insertId;

    // Insert multiple images
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        await connection.query(
          "INSERT INTO product_images (product_id, image_url, display_order) VALUES (?, ?, ?)",
          [productId, `/uploads/${files[i].filename}`, i],
        );
      }
    }

    // Insert colors
    if (colors) {
      const colorsData = JSON.parse(colors);
      for (let color of colorsData) {
        await connection.query(
          "INSERT INTO product_colors (product_id, color_name, color_code, stock) VALUES (?, ?, ?, ?)",
          [productId, color.name, color.code, color.stock],
        );
      }
    }

    await connection.commit();

    res.status(201).json({
      message: "Product added successfully!",
      productId: productId,
      slug: slug,
    });
  } catch (error) {
    await connection.rollback();
    console.error("❌ Product insert error:", error.message);
    // Common errors guide
    let friendlyMsg = error.message;
    if (error.code === "ER_NO_SUCH_TABLE")
      friendlyMsg = "A required table is missing. Run schema.sql again.";
    else if (error.code === "ER_BAD_FIELD_ERROR")
      friendlyMsg = `Column missing in DB: ${error.message}. Run the ALTER TABLE commands from schema_fix.sql.`;
    else if (error.code === "ER_DUP_ENTRY")
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
    const [rows] = await db.query("SELECT * FROM products WHERE slug = ?", [
      slug,
    ]);
    if (rows.length === 0)
      return res.status(404).json({ error: "Product not found" });
    res.json(rows[0]);
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
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  const baseSlug = name
    ? name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    : null;
  const slug = baseSlug ? `${baseSlug}-${id}` : null; // ID se unique rakho update mein

  try {
    let query =
      "UPDATE products SET name = ?, description = ?, price = ?, stock = ?, category_id = ?, keywords = ?, slug = ?";
    let params = [
      name,
      description,
      price,
      stock,
      category_id || null,
      keywords || "",
      slug,
    ];

    if (image_url) {
      query += ", image_url = ?";
      params.push(image_url);
    }

    query += " WHERE id = ?";
    params.push(id);

    const [result] = await db.query(query, params);
    if (result.affectedRows === 0) {
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
    const [result] = await db.query("DELETE FROM products WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
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
    const [rows] = await db.query("SELECT * FROM products WHERE id = ?", [id]);
    if (rows.length === 0)
      return res.status(404).json({ error: "Product not found" });
    res.json(rows[0]);
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
