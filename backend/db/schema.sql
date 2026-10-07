-- 工具管理システム スキーマ
CREATE DATABASE IF NOT EXISTS tool_management
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE tool_management;

-- 社員
CREATE TABLE IF NOT EXISTS employees (
  id            VARCHAR(32)  NOT NULL PRIMARY KEY,       -- 例: E-12345
  name          VARCHAR(64)  NOT NULL,
  team          VARCHAR(64)      NULL,                   -- 同じ班のメンバーは代理で貸し借りできる
  blood_type    VARCHAR(8)       NULL,
  photo_url     VARCHAR(255)     NULL,
  permission    ENUM('管理者','一般') NOT NULL DEFAULT '一般',
  password_hash VARCHAR(255) NOT NULL,
  -- 工具を借りるときに初期表示する持ち出し場所のピン（%）。未設定なら工具の現在位置を使う。
  default_pin_x DECIMAL(6,3)    NULL,
  default_pin_y DECIMAL(6,3)    NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 工具
CREATE TABLE IF NOT EXISTS tools (
  id                   VARCHAR(32) NOT NULL PRIMARY KEY, -- QRに埋め込む工具ID 例: A1
  name                 VARCHAR(64) NOT NULL,
  category             VARCHAR(32)     NULL,             -- 大項目（切断工具・測定器など）
  photo_url            VARCHAR(255)    NULL,
  state                ENUM('good','bad') NOT NULL DEFAULT 'good',
  -- 不良のランク（買い替えの判断に使う）。良好のときは NULL。
  --   minor=軽微（使用可） / repair=要修理 / replace=要買い替え / waiting=交換待ち
  defect_rank          ENUM('minor','repair','replace','waiting') NULL,
  defect_note          TEXT            NULL,             -- 不良内容の詳細
  pin_x                DECIMAL(6,3)    NULL,             -- 持ち出し場所のマップ上の位置（%）
  pin_y                DECIMAL(6,3)    NULL,
  purchase_date        DATE            NULL,             -- 購入日（経過年数の表示に使う）
  last_inspection_date DATE            NULL,
  created_at           DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tools_name (name),
  INDEX idx_tools_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 貸出・予約（履歴も兼ねる）
--   status='reserved' … 予約（まだ持ち出していない）
--   status='renting'  … 現在の貸出
--   status='returned' … 返却済み（履歴）
--   status='cancelled'… 取り消した予約
-- 期間は「日付 + 午前/午後」の半日単位で持つ。
CREATE TABLE IF NOT EXISTS rentals (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  tool_id      VARCHAR(32) NOT NULL,
  employee_id  VARCHAR(32) NOT NULL,                     -- 借りる人
  start_date   DATE        NOT NULL,
  start_period ENUM('am','pm') NOT NULL DEFAULT 'am',
  end_date     DATE        NOT NULL,                     -- 返却予定日
  end_period   ENUM('am','pm') NOT NULL DEFAULT 'pm',
  status       ENUM('reserved','renting','returned','cancelled') NOT NULL DEFAULT 'renting',
  taken_at     DATETIME        NULL,                     -- 実際に持ち出した日時
  taken_by     VARCHAR(32)     NULL,                     -- 持ち出しの操作をした社員（代理なら借りる人と異なる）
  returned_at  DATETIME        NULL,
  returned_by  VARCHAR(32)     NULL,                     -- 返却の操作をした社員
  created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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

-- 点検項目マスタ（管理画面から追加する）
CREATE TABLE IF NOT EXISTS inspection_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(64) NOT NULL,
  sort_order INT         NOT NULL DEFAULT 0,
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_inspection_items_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 工具ごとの点検項目
CREATE TABLE IF NOT EXISTS tool_inspection_items (
  tool_id VARCHAR(32) NOT NULL,
  item_id INT         NOT NULL,
  PRIMARY KEY (tool_id, item_id),
  CONSTRAINT fk_tii_tool FOREIGN KEY (tool_id) REFERENCES tools(id)            ON DELETE CASCADE,
  CONSTRAINT fk_tii_item FOREIGN KEY (item_id) REFERENCES inspection_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 点検の記録
CREATE TABLE IF NOT EXISTS inspections (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  tool_id      VARCHAR(32) NOT NULL,
  employee_id  VARCHAR(32)     NULL,
  inspected_at DATETIME    NOT NULL,
  result       ENUM('ok','ng') NOT NULL,
  note         TEXT            NULL,
  CONSTRAINT fk_inspections_tool FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE,
  INDEX idx_inspections_tool (tool_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 点検の項目ごとの結果。項目名は後で変更・削除されても記録が読めるよう写して持つ。
CREATE TABLE IF NOT EXISTS inspection_results (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  inspection_id INT         NOT NULL,
  item_name     VARCHAR(64) NOT NULL,
  ok            TINYINT(1)  NOT NULL,
  CONSTRAINT fk_results_inspection FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 工具情報の更新履歴。changes は [{ label, from, to }] の JSON 文字列。
CREATE TABLE IF NOT EXISTS tool_change_logs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tool_id     VARCHAR(32) NOT NULL,
  employee_id VARCHAR(32)     NULL,
  changed_at  DATETIME    NOT NULL,
  source      VARCHAR(16) NOT NULL,                      -- edit / rent / return / renew / transfer / inspect / create
  changes     TEXT        NOT NULL,
  CONSTRAINT fk_change_logs_tool FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE,
  INDEX idx_change_logs_tool (tool_id, changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
