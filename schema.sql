-- ============================================================
-- SA Parties DB — Complete Schema (Updated)
-- Drop tables first, then run this full file
-- ============================================================

CREATE DATABASE IF NOT EXISTS sa_parties_db;
USE sa_parties_db;

-- ── Drop order (foreign keys ka respect karo) ──
DROP TABLE IF EXISTS order_price_logs;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS product_colors;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS admins;

-- ── 1. Admins ──
CREATE TABLE admins (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    username   VARCHAR(255) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO admins (username, password)
VALUES ('admin', 'admin123')
ON DUPLICATE KEY UPDATE username = username;

-- ── 2. Categories ──
CREATE TABLE categories (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    parent_id  INT DEFAULT NULL,
    slug       VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 3. Products ──
CREATE TABLE products (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT DEFAULT NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    price       DECIMAL(10,2) NOT NULL,
    stock       INT NOT NULL DEFAULT 0,
    image_url   VARCHAR(255) DEFAULT NULL,
    slug        VARCHAR(255) NOT NULL UNIQUE,
    keywords    VARCHAR(255) DEFAULT NULL,
    length      DECIMAL(8,2) DEFAULT NULL,
    width       DECIMAL(8,2) DEFAULT NULL,
    height      DECIMAL(8,2) DEFAULT NULL,
    weight      DECIMAL(8,3) DEFAULT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 3.1 Product Images ──
CREATE TABLE product_images (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    product_id    INT NOT NULL,
    image_url     VARCHAR(255) NOT NULL,
    display_order INT DEFAULT 0,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 3.2 Product Colors ──
CREATE TABLE product_colors (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    product_id  INT NOT NULL,
    color_name  VARCHAR(100) NOT NULL,
    color_code  VARCHAR(20)  NOT NULL,
    stock       INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 4. Customers ──
CREATE TABLE customers (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    email      VARCHAR(255) DEFAULT NULL,
    phone      VARCHAR(50)  NOT NULL,
    address    TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 5. Orders ──
-- Status values:
--   'Payment Verification' → online payment awaiting admin review
--   'Pending'              → COD order OR approved online payment
--   'Shipped'              → Admin shipped the order
--   'Delivered'            → Admin marked delivered
--   'Cancelled'            → Cancelled (COD or approved then cancelled)
--   'Payment Rejected'     → Online payment rejected by admin
CREATE TABLE orders (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    order_number        VARCHAR(20) NOT NULL UNIQUE,
    customer_id         INT NOT NULL,
    total_amount        DECIMAL(10,2) NOT NULL,
    status              ENUM(
                          'Payment Verification',
                          'Pending',
                          'Shipped',
                          'Delivered',
                          'Cancelled',
                          'Payment Rejected'
                        ) NOT NULL DEFAULT 'Pending',
    payment_method      VARCHAR(50) NOT NULL DEFAULT 'cod',
    payment_status      ENUM('Pending','Paid','Rejected') NOT NULL DEFAULT 'Pending',
    transaction_id      VARCHAR(255) DEFAULT NULL,
    sender_number       VARCHAR(20)  DEFAULT NULL,
    payment_screenshot  VARCHAR(255) DEFAULT NULL,
    rejection_reason    TEXT DEFAULT NULL,
    verification_notes  TEXT DEFAULT NULL,
    verified_by         INT DEFAULT NULL,
    verified_at         TIMESTAMP NULL DEFAULT NULL,
    admin_edited_price  TINYINT DEFAULT 0,
    admin_notes         TEXT DEFAULT NULL,
    user_id             INT DEFAULT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 6. Order Items ──
CREATE TABLE order_items (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    order_id   INT NOT NULL,
    product_id INT NOT NULL,
    quantity   INT NOT NULL,
    price      DECIMAL(10,2) NOT NULL,
    color_id   INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id)   REFERENCES orders(id)         ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)       ON DELETE RESTRICT,
    FOREIGN KEY (color_id)   REFERENCES product_colors(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 7. Users ──
CREATE TABLE users (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    name                 VARCHAR(255) NOT NULL,
    email                VARCHAR(255) NOT NULL UNIQUE,
    password             VARCHAR(255) NOT NULL,
    address              TEXT DEFAULT NULL,
    verification_code    VARCHAR(10)  DEFAULT NULL,
    verification_expires DATETIME     DEFAULT NULL,
    is_verified          TINYINT NOT NULL DEFAULT 0,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 8. Order Price Audit Logs ──
CREATE TABLE order_price_logs (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    order_id      INT NOT NULL,
    old_price     DECIMAL(10,2) NOT NULL,
    new_price     DECIMAL(10,2) NOT NULL,
    changed_by    VARCHAR(100) DEFAULT 'admin',
    change_reason TEXT DEFAULT NULL,
    changed_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;