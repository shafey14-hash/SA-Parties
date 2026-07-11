const db = require("../config/db");

const createCategory = async (req, res) => {
  const { name, parent_id } = req.body;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  try {
    await db.query(
      "INSERT INTO categories (name, parent_id, slug) VALUES ($1, $2, $3)",
      [name, parent_id || null, slug],
    );
    res.status(201).json({ message: "Category added successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getCategories = async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM categories ORDER BY name ASC");
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;
  try {
    // Delete sub-categories first, then parent
    await db.query("DELETE FROM categories WHERE parent_id = $1", [id]);
    const result = await db.query("DELETE FROM categories WHERE id = $1", [
      id,
    ]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Category not found." });
    }
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