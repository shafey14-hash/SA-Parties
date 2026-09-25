const db = require("../config/db");

// Simple in-memory cache — no extra package needed. Categories rarely
// change, so after the first request within the TTL window every
// following request returns instantly with no DB round-trip at all.
// Cleared immediately on any create/update/delete so a mutation is never
// followed by stale data.
let categoriesCache = null;
let categoriesCacheAt = 0;
const CATEGORIES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const createCategory = async (req, res) => {
  const { name, parent_id } = req.body;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  try {
    await db.query(
      "INSERT INTO categories (name, parent_id, slug) VALUES ($1, $2, $3)",
      [name, parent_id || null, slug],
    );
    categoriesCache = null; // invalidate so the next read is fresh
    res.status(201).json({ message: "Category added successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getCategories = async (req, res) => {
  const t0 = Date.now();

  if (
    categoriesCache &&
    Date.now() - categoriesCacheAt < CATEGORIES_CACHE_TTL_MS
  ) {
    console.log(`[categories] served from cache, ${Date.now() - t0}ms`);
    return res.status(200).json(categoriesCache);
  }

  try {
    const result = await db.query("SELECT * FROM categories ORDER BY name ASC");
    categoriesCache = result.rows;
    categoriesCacheAt = Date.now();
    console.log(
      `[categories] query took ${Date.now() - t0}ms, rows: ${result.rows.length}`,
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.log(
      `[categories] FAILED after ${Date.now() - t0}ms:`,
      error.message,
    );
    res.status(500).json({ error: error.message });
  }
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;
  try {
    // Delete sub-categories first, then parent
    await db.query("DELETE FROM categories WHERE parent_id = $1", [id]);
    const result = await db.query("DELETE FROM categories WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Category not found." });
    }
    categoriesCache = null; // invalidate
    res.status(200).json({ message: "Category deleted successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Category name is required." });
  }
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  try {
    const result = await db.query(
      "UPDATE categories SET name = $1, slug = $2 WHERE id = $3",
      [name.trim(), slug, id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Category not found." });
    }
    categoriesCache = null; // invalidate
    res.status(200).json({ message: "Category updated successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createCategory,
  getCategories,
  deleteCategory,
  updateCategory,
};

