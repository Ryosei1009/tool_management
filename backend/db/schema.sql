-- 工具管理システム スキーマ
CREATE DATABASE IF NOT EXISTS tool_management
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE tool_management;

-- 社員
CREATE TABLE IF NOT EXISTS employees (
  id            VARCHAR(32)  NOT NULL PRIMARY KEY,       -- 例: E-12345
  name          VARCHAR(64)  NOT NULL,
  team          VARCHAR(64)      NULL,
  blood_type    VARCHAR(8)       NULL,
  photo_url     VARCHAR(255)     NULL,
  permission    ENUM('管理者','一般') NOT NULL DEFAULT '一般',
  password_hash VARCHAR(255) NOT NULL,
  -- 工具を借りるときに初期表示するピンの位置（%）。未設定なら工具の現在位置を使う。
  default_pin_x DECIMAL(6,3)    NULL,
  default_pin_y DECIMAL(6,3)    NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 工具
CREATE TABLE IF NOT EXISTS tools (
  id                   VARCHAR(32) NOT NULL PRIMARY KEY, -- QRに埋め込む工具ID 例: A1
  name                 VARCHAR(64) NOT NULL,
  category             VARCHAR(32)     NULL,
  photo_url            VARCHAR(255)    NULL,
  state                ENUM('good','bad','damaged') NOT NULL DEFAULT 'good',
  pin_x                DECIMAL(6,3)    NULL,             -- マップ上の位置（%）
  pin_y                DECIMAL(6,3)    NULL,
  last_inspection_date DATE            NULL,
  created_at           DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tools_name (name),
  INDEX idx_tools_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 貸出（履歴も兼ねる。status='renting' の行が現在の貸出）
CREATE TABLE IF NOT EXISTS rentals (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tool_id     VARCHAR(32) NOT NULL,
  employee_id VARCHAR(32) NOT NULL,
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL,
  reserved    TINYINT(1)  NOT NULL DEFAULT 0,            -- 貸し出し予約
  status      ENUM('renting','returned') NOT NULL DEFAULT 'renting',
  returned_at DATETIME        NULL,
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- 1つの工具が同時に複数貸し出されないようにする。
  -- status='renting' のときだけ値が入る生成列に UNIQUE を張る。
  active_tool_id VARCHAR(32) GENERATED ALWAYS AS (IF(status = 'renting', tool_id, NULL)) STORED,
  UNIQUE KEY uq_rentals_active_tool (active_tool_id),
  -- MySQL 5.7 では生成列の元になっている列に ON DELETE CASCADE を張れないため
  -- （active_tool_id が tool_id を参照している）RESTRICT にしている。
  -- 工具の削除時は /tools/delete が貸出を先に消す。
  CONSTRAINT fk_rentals_tool     FOREIGN KEY (tool_id)     REFERENCES tools(id)     ON DELETE RESTRICT,
  CONSTRAINT fk_rentals_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_rentals_tool (tool_id),
  INDEX idx_rentals_employee (employee_id),
  INDEX idx_rentals_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
