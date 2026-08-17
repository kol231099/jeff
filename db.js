const Database = require('better-sqlite3');
const db = new Database('pourmatch.db');

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    picture TEXT,
    unique_code TEXT UNIQUE,
    bio TEXT DEFAULT '',
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS quiz_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    answers TEXT NOT NULL,
    result TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS cocktail_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    preferences TEXT NOT NULL,
    result TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    caption TEXT DEFAULT '',
    likes_count INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(user_id, post_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(user_id, friend_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(friend_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// 為舊 users 表補欄位（SQLite ALTER TABLE 不支援 UNIQUE，必須事後建 INDEX）
try { db.exec(`ALTER TABLE users ADD COLUMN unique_code TEXT`); } catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''`); } catch {}
try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_code ON users(unique_code)`); } catch {}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genCode() {
  let c = '';
  for (let i = 0; i < 6; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return c;
}

function assignUniqueCode(userId) {
  for (let i = 0; i < 30; i++) {
    const code = genCode();
    try {
      db.prepare('UPDATE users SET unique_code = ? WHERE id = ?').run(code, userId);
      return code;
    } catch { /* collision, retry */ }
  }
  throw new Error('cannot generate unique code');
}

// 補沒有 code 的舊用戶
const usersNoCode = db.prepare(`SELECT id FROM users WHERE unique_code IS NULL OR unique_code = ''`).all();
for (const u of usersNoCode) {
  try { assignUniqueCode(u.id); } catch (e) { console.error('code gen fail', u.id); }
}

// ===== 遷移：可重複執行，只在欄位不存在時才加 =====
function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
addColumnIfMissing('users', 'last_seen', 'INTEGER DEFAULT 0');

// ===== 配對與聊天 =====
db.exec(`
  -- 單向表態。同一組 (from,to) 只留一筆，改變心意就覆寫
  CREATE TABLE IF NOT EXISTS match_actions (
    from_user INTEGER NOT NULL,
    to_user   INTEGER NOT NULL,
    action    TEXT NOT NULL CHECK (action IN ('like','pass')),
    created_at INTEGER DEFAULT (strftime('%s','now')),
    PRIMARY KEY (from_user, to_user),
    FOREIGN KEY(from_user) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(to_user)   REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_actions_to ON match_actions(to_user, action);

  -- 一對一與群組共用同一種房間，才不會做出兩套聊天
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('direct','group')),
    title TEXT,
    direct_key TEXT UNIQUE,          -- 一對一專用，格式 '小id-大id'，防止重複開房
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS room_members (
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at INTEGER DEFAULT (strftime('%s','now')),
    last_read_id INTEGER DEFAULT 0,  -- 未讀數靠它算
    PRIMARY KEY (room_id, user_id),
    FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_members_user ON room_members(user_id);

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, id);
`);

module.exports = { db, assignUniqueCode };
