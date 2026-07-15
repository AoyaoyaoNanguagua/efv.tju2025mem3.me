from __future__ import annotations

import base64
import hashlib
import json
import math
import mimetypes
import os
import re
import secrets
import socket
import sqlite3
import struct
import threading
import time
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "play-data.sqlite3"
PORT = int(os.environ.get("PORT", "8787"))
MAX_ONLINE = int(os.environ.get("MAX_ONLINE", "20"))
MAX_SLIMES_PER_ROOM = int(os.environ.get("MAX_SLIMES_PER_ROOM", "24"))
MAX_DROPS_PER_ROOM = int(os.environ.get("MAX_DROPS_PER_ROOM", "80"))
DROP_TTL_MS = 5 * 60 * 1000
SESSION_TTL = 7 * 24 * 60 * 60
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
USERNAME_RE = re.compile(r"^[A-Za-z0-9_-]{3,18}$")
CHARACTER_IDS = {"lina", "ayu", "zhixia", "laodeng", "jiangxun"}
CHARACTER_LIMIT = 5
PROFILE_EXTRA_STRING_FIELDS = {"chapterId", "mapId", "spawnId", "characterRecordId"}
PROFILE_EXTRA_JSON_FIELDS = {"flags", "quests", "inventory", "equipment", "collections"}
PROFILE_EXTRA_JSON_MAX_BYTES = 24 * 1024
PROFILE_EXTRA_DEPTH = 5
PROFILE_EXTRA_ITEMS_LIMIT = 80
PROFILE_EXTRA_KEY_LIMIT = 64
PROFILE_EXTRA_STRING_LIMIT = 256
MAX_WS_MESSAGE_BYTES = max(1024, int(os.environ.get("MAX_WS_MESSAGE_BYTES", "4096")))
MAX_WS_FRAME_BYTES = max(1024, int(os.environ.get("MAX_WS_FRAME_BYTES", str(MAX_WS_MESSAGE_BYTES))))
WS_RATE_WINDOW_SECONDS = 5.0
MAX_WS_MESSAGES_PER_WINDOW = 120
MAX_CHAT_MESSAGES = max(0, int(os.environ.get("MAX_CHAT_MESSAGES", "60")))
CHAT_RATE_WINDOW = max(1.0, float(os.environ.get("CHAT_RATE_WINDOW", "10")))
CHAT_RATE_LIMIT = max(1, int(os.environ.get("CHAT_RATE_LIMIT", "5")))
CHAT_HISTORY_LIMIT = max(0, int(os.environ.get("CHAT_HISTORY_LIMIT", str(MAX_CHAT_MESSAGES))))
CHAT_TEXT_LIMIT = max(1, int(os.environ.get("CHAT_TEXT_LIMIT", "180")))
CHAT_RATE_WINDOW_SECONDS = CHAT_RATE_WINDOW
MAX_CHAT_MESSAGES_PER_WINDOW = CHAT_RATE_LIMIT
COMBAT_EVENT_ACTIONS = {"projectile", "melee", "linaGale", "chainLightning", "zhixiaUltimate", "berserk", "laodengShockwave", "laodengFireExplosion", "physicalImpactBurst", "levelUp", "enemySkill", "playerStatus", "structuralChargeAoe", "structuralSideLightning", "structuralBossDash", "structuralMarkedLightning"}
COMBAT_VISUAL_TYPES = {"", "arrow", "arrowHeavy", "arrowBarrage", "swordWave", "lightningOrb", "windBolt"}
ENEMY_STATES = {"move", "hit", "dead", "attack", "transform", "charging", "phase2Combat", "phase3", "visualHit", "collapse"}
CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
CHAT_TAG_RE = re.compile(r"<[^>\r\n]{0,120}>")

DROP_ITEM_CATALOG = {
    "ch1_material_margin_note": {"name": "批注纸角", "type": "material", "quality": "common"},
    "ch1_material_protocol_ink": {"name": "协议墨滴", "type": "material", "quality": "excellent"},
    "ch1_material_campus_token": {"name": "旧饭卡芯片", "type": "material", "quality": "common"},
    "ch1_boost_academic_bookmark": {"name": "晨读书签", "type": "equipment", "quality": "excellent", "damageBonus": 0.05},
    "ch1_boost_focus_badge": {"name": "专注校徽", "type": "equipment", "quality": "rare", "damageBonus": 0.08},
    "ch1_drop_quantum_probability_core": {"name": "量子概率核心", "type": "material", "quality": "rare"},
    "ch1_drop_quantum_shard": {"name": "量子相干碎片", "type": "material", "quality": "excellent"},
    "ch1_drop_chain_forge_core": {"name": "链铸重核", "type": "material", "quality": "rare"},
    "ch1_drop_blockchain_lock": {"name": "验证锁片", "type": "material", "quality": "excellent"},
    "ch1_drop_agent_memory_core": {"name": "Agent 记忆核心", "type": "material", "quality": "rare"},
    "ch1_drop_agent_tool_node": {"name": "工具节点", "type": "material", "quality": "excellent"},
    "ch1_drop_citation_seal_fragment": {"name": "引用封印碎片", "type": "material", "quality": "rare"},
    "ch1_drop_thorn_seed": {"name": "荆棘种核", "type": "material", "quality": "excellent"},
    "ch1_drop_pollen_lantern": {"name": "花粉灯芯", "type": "material", "quality": "excellent"},
    "ch1_drop_gardener_badge": {"name": "园艺校徽", "type": "material", "quality": "excellent"},
    "ch1_drop_moon_orchid": {"name": "月兰花冠", "type": "material", "quality": "rare"},
    "ch1_drop_carnivora_core": {"name": "食人花院核", "type": "material", "quality": "epic"},
}

BASE_PROFILE = {
    "level": 1,
    "exp": 0,
    "credits": 0,
    "maxHp": 160,
    "hp": 160,
    "maxEnergy": 150,
    "energy": 150,
    "shield": 0,
    "attackPower": 26,
    "magicPower": 22,
    "chapterId": "chapter1",
    "mapId": "ch1_m01_classroom_spawn",
    "spawnId": "ch1_m01_spawn_player_start",
    "flags": {},
    "quests": {},
    "inventory": [],
    "equipment": [],
    "collections": {},
}

DEFAULT_BOSS = {
    "id": "boss_ai_prof",
    "name": "陆教授协议考核",
    "maxHp": 5,
    "hp": 0,
    "active": False,
    "x": 0,
    "y": 0,
    "phase": "idle",
    "waveIndex": 0,
    "waveTitle": "",
    "wavesTotal": 3,
    "summonsRemaining": 0,
    "eliteRemaining": 0,
    "chestReady": False,
}

M04_MAP_ID = "ch1_m04_library_lawn_boss"


def new_m04_session() -> dict:
    return {
        "active": False,
        "sessionId": "",
        "leaderId": "",
        "leaderName": "",
        "flags": [],
        "started": False,
        "phase": "idle",
        "waveIndex": 0,
        "startedAt": 0,
    }

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".mp3": "audio/mpeg",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
}

state_lock = threading.RLock()
rooms: dict[str, dict] = {}
clients: set["WsClient"] = set()
clients_by_user: dict[int, "WsClient"] = {}


@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with db() as conn:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              salt TEXT NOT NULL,
              nickname TEXT NOT NULL,
              character_id TEXT NOT NULL DEFAULT 'lina',
              created_at REAL NOT NULL,
              updated_at REAL NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS saves (
              user_id INTEGER PRIMARY KEY,
              profile_json TEXT NOT NULL,
              updated_at REAL NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
              token TEXT PRIMARY KEY,
              user_id INTEGER NOT NULL,
              expires_at REAL NOT NULL,
              created_at REAL NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS characters (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              slot INTEGER NOT NULL,
              character_id TEXT NOT NULL DEFAULT 'lina',
              name TEXT NOT NULL,
              level INTEGER NOT NULL DEFAULT 1,
              exp INTEGER NOT NULL DEFAULT 0,
              credits INTEGER NOT NULL DEFAULT 0,
              max_hp INTEGER NOT NULL DEFAULT 160,
              hp INTEGER NOT NULL DEFAULT 160,
              profile_json TEXT,
              created_at REAL NOT NULL,
              updated_at REAL NOT NULL,
              UNIQUE(user_id, slot),
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        character_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(characters)").fetchall()
        }
        if "profile_json" not in character_columns:
            conn.execute("ALTER TABLE characters ADD COLUMN profile_json TEXT")
            legacy_saves = conn.execute("SELECT user_id, profile_json FROM saves").fetchall()
            for legacy_save in legacy_saves:
                try:
                    profile = json.loads(legacy_save["profile_json"])
                    if not isinstance(profile, dict):
                        continue
                    slot = int(profile.get("slot", -1))
                except (json.JSONDecodeError, TypeError, ValueError):
                    continue
                character = conn.execute(
                    "SELECT * FROM characters WHERE user_id = ? AND slot = ?",
                    (legacy_save["user_id"], slot),
                ).fetchone()
                if not character:
                    continue
                has_fresh_stats = (
                    int(character["level"]) == BASE_PROFILE["level"]
                    and int(character["exp"]) == BASE_PROFILE["exp"]
                    and int(character["credits"]) == BASE_PROFILE["credits"]
                )
                if has_fresh_stats and profile.get("mapId") != BASE_PROFILE["mapId"]:
                    profile = {
                        "id": profile.get("id", f"u{legacy_save['user_id']}"),
                        "account": profile.get("account", ""),
                        "name": character["name"],
                        "characterId": character["character_id"],
                        "slot": slot,
                        **BASE_PROFILE,
                    }
                profile["characterRecordId"] = str(character["id"])
                conn.execute(
                    "UPDATE characters SET profile_json = ? WHERE id = ?",
                    (json.dumps(profile, ensure_ascii=False), character["id"]),
                )


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("content-type", "application/json; charset=utf-8")
    handler.send_header("cache-control", "no-cache")
    handler.send_header("content-length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def read_json(handler: BaseHTTPRequestHandler) -> dict:
    try:
        size = min(int(handler.headers.get("content-length", "0")), 32 * 1024)
    except ValueError:
        size = 0
    if size <= 0:
        return {}
    raw = handler.rfile.read(size)
    try:
        return json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError:
        return {}


def password_hash(password: str, salt_hex: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), 150_000).hex()


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    now = time.time()
    with db() as conn:
        conn.execute("DELETE FROM sessions WHERE expires_at < ?", (now,))
        conn.execute(
            "INSERT INTO sessions(token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (token, user_id, now + SESSION_TTL, now),
        )
    return token


def auth_token_from_header(handler: BaseHTTPRequestHandler) -> str:
    auth = handler.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return ""


def user_by_token(token: str) -> sqlite3.Row | None:
    if not token:
        return None
    now = time.time()
    with db() as conn:
        return conn.execute(
            """
            SELECT users.*
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ? AND sessions.expires_at > ?
            """,
            (token, now),
        ).fetchone()


def clean_name(value: object, fallback: str = "同济学术喵") -> str:
    text = str(value or fallback).strip()
    return text[:12] or fallback


def clean_character(value: object, fallback: str = "lina") -> str:
    text = str(value or fallback)
    return text if text in CHARACTER_IDS else fallback


def clean_number(value: object, fallback: int, low: int, high: int) -> int:
    try:
        number = int(float(value))
    except (TypeError, ValueError):
        number = fallback
    return max(low, min(high, number))


def clean_float(value: object, fallback: float, low: float, high: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = fallback
    if not math.isfinite(number):
        number = fallback
    return max(low, min(high, number))


def clean_limited_text(value: object, limit: int) -> str:
    text = CONTROL_CHAR_RE.sub("", str(value or "")).strip()
    return text[:limit]


def sanitize_profile_json_value(value: object, depth: int = 0) -> object:
    if depth > PROFILE_EXTRA_DEPTH:
        return None
    if value is None or isinstance(value, bool):
        return value
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return value if math.isfinite(float(value)) else None
    if isinstance(value, str):
        return clean_limited_text(value, PROFILE_EXTRA_STRING_LIMIT)
    if isinstance(value, list):
        clean_items = []
        for item in value[:PROFILE_EXTRA_ITEMS_LIMIT]:
            clean_item = sanitize_profile_json_value(item, depth + 1)
            if clean_item is not None:
                clean_items.append(clean_item)
        return clean_items
    if isinstance(value, dict):
        clean_items = {}
        for key, item in list(value.items())[:PROFILE_EXTRA_ITEMS_LIMIT]:
            clean_key = clean_limited_text(key, PROFILE_EXTRA_KEY_LIMIT)
            if not clean_key:
                continue
            clean_item = sanitize_profile_json_value(item, depth + 1)
            if clean_item is not None:
                clean_items[clean_key] = clean_item
        return clean_items
    return None


def sanitize_profile_extra_json(value: object) -> object:
    clean_value = sanitize_profile_json_value(value)
    if clean_value is None:
        return None
    try:
        size = len(json.dumps(clean_value, ensure_ascii=False).encode("utf-8"))
    except (TypeError, ValueError):
        return None
    if size > PROFILE_EXTRA_JSON_MAX_BYTES:
        return None
    return clean_value


def sanitize_profile_extras(profile: dict) -> dict:
    extras = {}
    for field in PROFILE_EXTRA_STRING_FIELDS:
        if field in profile and profile[field] is not None:
            extras[field] = clean_limited_text(profile[field], PROFILE_EXTRA_STRING_LIMIT)
    for field in PROFILE_EXTRA_JSON_FIELDS:
        if field not in profile:
            continue
        clean_value = sanitize_profile_extra_json(profile[field])
        if clean_value is not None:
            extras[field] = clean_value
    return extras


def default_profile(user: sqlite3.Row) -> dict:
    return {
        "id": f"u{user['id']}",
        "account": user["username"],
        "name": clean_name(user["nickname"]),
        "characterId": clean_character(user["character_id"]),
        "slot": -1,
        **BASE_PROFILE,
    }


def sanitize_profile(profile: dict, user: sqlite3.Row) -> dict:
    if not isinstance(profile, dict):
        profile = {}
    base = default_profile(user)
    max_hp = clean_number(profile.get("maxHp"), base["maxHp"], 1, 9999)
    previous_max_energy = clean_number(profile.get("maxEnergy"), base["maxEnergy"], 1, 9999)
    max_energy = max(base["maxEnergy"], previous_max_energy)
    incoming_energy = clean_number(profile.get("energy"), min(base["energy"], max_energy), 0, max_energy)
    if previous_max_energy < base["maxEnergy"] and incoming_energy >= previous_max_energy:
        incoming_energy = max_energy
    safe_profile = {
        "id": base["id"],
        "account": base["account"],
        "name": clean_name(profile.get("name"), base["name"]),
        "characterId": clean_character(profile.get("characterId"), base["characterId"]),
        "slot": clean_number(profile.get("slot"), -1, -1, CHARACTER_LIMIT - 1),
        "level": clean_number(profile.get("level"), base["level"], 1, 99),
        "exp": clean_number(profile.get("exp"), base["exp"], 0, 99999),
        "credits": clean_number(profile.get("credits"), base["credits"], 0, 99999),
        "maxHp": max_hp,
        "hp": clean_number(profile.get("hp"), min(base["hp"], max_hp), 0, max_hp),
        "maxEnergy": max_energy,
        "energy": incoming_energy,
        "shield": clean_number(profile.get("shield"), base["shield"], 0, 9999),
        "attackPower": clean_number(profile.get("attackPower"), base["attackPower"], 1, 9999),
        "magicPower": clean_number(profile.get("magicPower"), base["magicPower"], 1, 9999),
    }
    safe_profile.update(sanitize_profile_extras(base))
    safe_profile.update(sanitize_profile_extras(profile))
    return safe_profile


def load_profile(user: sqlite3.Row) -> dict:
    with db() as conn:
        row = conn.execute("SELECT profile_json FROM saves WHERE user_id = ?", (user["id"],)).fetchone()
    if not row:
        return default_profile(user)
    try:
        return sanitize_profile(json.loads(row["profile_json"]), user)
    except json.JSONDecodeError:
        return default_profile(user)


def save_profile(user: sqlite3.Row, profile: dict) -> dict:
    safe_profile = sanitize_profile(profile, user)
    profile_json = json.dumps(safe_profile, ensure_ascii=False)
    now = time.time()
    with db() as conn:
        conn.execute(
            """
            INSERT INTO saves(user_id, profile_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              profile_json = excluded.profile_json,
              updated_at = excluded.updated_at
            """,
            (user["id"], profile_json, now),
        )
        conn.execute(
            "UPDATE users SET character_id = ?, updated_at = ? WHERE id = ?",
            (safe_profile["characterId"], now, user["id"]),
        )
        try:
            character_record_id = int(safe_profile.get("characterRecordId", ""))
        except (TypeError, ValueError):
            character_record_id = -1
        if safe_profile["slot"] >= 0 and character_record_id >= 0:
            conn.execute(
                """
                UPDATE characters
                SET character_id = ?, name = ?, level = ?, exp = ?, credits = ?, max_hp = ?, hp = ?,
                    profile_json = ?, updated_at = ?
                WHERE id = ? AND user_id = ? AND slot = ?
                """,
                (
                    safe_profile["characterId"],
                    DEFAULT_CHARACTER_NAMES.get(safe_profile["characterId"], safe_profile["name"]),
                    safe_profile["level"],
                    safe_profile["exp"],
                    safe_profile["credits"],
                    safe_profile["maxHp"],
                    safe_profile["hp"],
                    profile_json,
                    now,
                    character_record_id,
                    user["id"],
                    safe_profile["slot"],
                ),
            )
    return safe_profile


DEFAULT_CHARACTER_NAMES = {
    "lina": "莉娜",
    "ayu": "阿宇",
    "zhixia": "知夏",
    "laodeng": "老登",
    "jiangxun": "江寻",
}


def character_to_dict(row: sqlite3.Row) -> dict:
    max_hp = clean_number(row["max_hp"], 160, 1, 9999)
    character_id = clean_character(row["character_id"])
    return {
        "slot": int(row["slot"]),
        "characterId": character_id,
        "name": DEFAULT_CHARACTER_NAMES.get(character_id, clean_name(row["name"])),
        "level": clean_number(row["level"], 1, 1, 99),
        "exp": clean_number(row["exp"], 0, 0, 99999),
        "credits": clean_number(row["credits"], 0, 0, 99999),
        "maxHp": max_hp,
        "hp": clean_number(row["hp"], max_hp, 0, max_hp),
    }


def load_character_profile(user: sqlite3.Row, row: sqlite3.Row) -> dict:
    character = character_to_dict(row)
    profile = default_profile(user)
    if row["profile_json"]:
        try:
            saved_profile = json.loads(row["profile_json"])
            if isinstance(saved_profile, dict):
                profile.update(saved_profile)
        except json.JSONDecodeError:
            pass
    profile.update(character)
    profile["characterRecordId"] = str(row["id"])
    return sanitize_profile(profile, user)


def list_characters(user: sqlite3.Row) -> list[dict]:
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM characters WHERE user_id = ? ORDER BY slot", (user["id"],)
        ).fetchall()
    return [character_to_dict(row) for row in rows]


def handle_character_create(user: sqlite3.Row, payload: dict) -> tuple[int, dict]:
    requested = str(payload.get("characterId") or "")
    if requested not in CHARACTER_IDS:
        return 400, {"error": "这个角色暂未开放。"}
    characters = list_characters(user)
    if len(characters) >= CHARACTER_LIMIT:
        return 400, {"error": f"角色仓库已满（最多 {CHARACTER_LIMIT} 个角色）。"}
    used_slots = {item["slot"] for item in characters}
    slot = next(index for index in range(CHARACTER_LIMIT) if index not in used_slots)
    name = DEFAULT_CHARACTER_NAMES.get(requested, clean_name(user["nickname"]))
    now = time.time()
    with db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO characters(
              user_id, slot, character_id, name, level, exp, credits, max_hp, hp,
              profile_json, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, 1, 0, 0, ?, ?, NULL, ?, ?)
            """,
            (user["id"], slot, requested, name, BASE_PROFILE["maxHp"], BASE_PROFILE["hp"], now, now),
        )
        profile = default_profile(user)
        profile.update({
            "name": name,
            "characterId": requested,
            "slot": slot,
            "characterRecordId": str(cursor.lastrowid),
        })
        fresh_profile = sanitize_profile(profile, user)
        conn.execute(
            "UPDATE characters SET profile_json = ? WHERE id = ?",
            (json.dumps(fresh_profile, ensure_ascii=False), cursor.lastrowid),
        )
    return 200, {"slot": slot, "characters": list_characters(user)}


def handle_character_delete(user: sqlite3.Row, payload: dict) -> tuple[int, dict]:
    slot = clean_number(payload.get("slot"), -1, -1, CHARACTER_LIMIT - 1)
    if slot < 0:
        return 400, {"error": "请选择要删除的角色。"}
    with db() as conn:
        cursor = conn.execute(
            "DELETE FROM characters WHERE user_id = ? AND slot = ?", (user["id"], slot)
        )
        deleted = cursor.rowcount
    if not deleted:
        return 404, {"error": "角色不存在。"}
    return 200, {"characters": list_characters(user)}


def handle_character_select(user: sqlite3.Row, payload: dict) -> tuple[int, dict]:
    slot = clean_number(payload.get("slot"), -1, -1, CHARACTER_LIMIT - 1)
    if slot < 0:
        return 400, {"error": "请选择一个角色。"}
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM characters WHERE user_id = ? AND slot = ?", (user["id"], slot)
        ).fetchone()
    if not row:
        return 404, {"error": "角色不存在。"}
    selected_profile = load_character_profile(user, row)
    if selected_profile["hp"] <= 0:
        selected_profile["hp"] = selected_profile["maxHp"]
    profile = save_profile(user, selected_profile)
    return 200, {"profile": profile}


def handle_register(payload: dict) -> tuple[int, dict]:
    username = str(payload.get("username", "")).strip().lower()
    nickname = clean_name(payload.get("nickname"), "同济学术喵")
    password = str(payload.get("password", ""))
    character_id = clean_character(payload.get("characterId"), "lina")
    now = time.time()

    if not USERNAME_RE.match(username):
        return 400, {"error": "账号请使用 3-18 位字母、数字、下划线或短横线。"}
    if len(password) < 6 or len(password) > 32:
        return 400, {"error": "密码长度需要在 6-32 位之间。"}

    salt = secrets.token_hex(16)
    hashed = password_hash(password, salt)
    try:
        with db() as conn:
            cursor = conn.execute(
                """
                INSERT INTO users(username, password_hash, salt, nickname, character_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (username, hashed, salt, nickname, character_id, now, now),
            )
            user_id = cursor.lastrowid
            user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    except sqlite3.IntegrityError:
        return 409, {"error": "这个账号已经被注册了。"}

    save_profile(user, default_profile(user))
    return 200, {"ok": True, "username": username}


def handle_login(payload: dict) -> tuple[int, dict]:
    username = str(payload.get("username", "")).strip().lower()
    password = str(payload.get("password", ""))
    with db() as conn:
        user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    if not user or password_hash(password, user["salt"]) != user["password_hash"]:
        return 401, {"error": "账号或密码不正确。"}
    token = create_session(user["id"])
    return 200, {"token": token, "profile": load_profile(user), "characters": list_characters(user)}


def get_room(name: str = "zhonghe-plaza") -> dict:
    if name not in rooms:
        rooms[name] = {
            "name": name,
            "peers": {},
            "boss": dict(DEFAULT_BOSS),
            "slimes": {},
            "drops": {},
            "progress": {},
            "chat": [],
            "m04": new_m04_session(),
        }
    rooms[name].setdefault("slimes", {})
    rooms[name].setdefault("drops", {})
    rooms[name].setdefault("progress", {})
    rooms[name].setdefault("chat", [])
    rooms[name].setdefault("m04", new_m04_session())
    return rooms[name]


def m04_member_ids(room: dict) -> list[str]:
    return [
        str(peer_id)
        for peer_id, player in room.get("peers", {}).items()
        if str(player.get("mapId", "")) == M04_MAP_ID
    ]


def m04_session_payload(room: dict) -> dict:
    session = room.get("m04") or new_m04_session()
    return {
        "active": bool(session.get("active")),
        "sessionId": str(session.get("sessionId", "")),
        "leaderId": str(session.get("leaderId", "")),
        "leaderName": clean_limited_text(session.get("leaderName", ""), 16),
        "flags": list(session.get("flags") or [])[:240],
        "started": bool(session.get("started")),
        "phase": clean_limited_text(session.get("phase", "idle"), 32),
        "waveIndex": int(clean_number(session.get("waveIndex"), 0, 0, 12)),
        "memberIds": m04_member_ids(room),
    }


def clear_m04_runtime_locked(room: dict) -> None:
    room["boss"] = dict(DEFAULT_BOSS)
    room["slimes"] = {
        enemy_id: enemy
        for enemy_id, enemy in room.get("slimes", {}).items()
        if str(enemy.get("mapId", "")) != M04_MAP_ID
    }
    room["drops"] = {
        drop_id: drop
        for drop_id, drop in room.get("drops", {}).items()
        if str(drop.get("mapId", "")) != M04_MAP_ID
    }
    room["progress"] = {
        event_id: event
        for event_id, event in room.get("progress", {}).items()
        if str(event.get("mapId", "")) != M04_MAP_ID
    }


def update_m04_session_locked(room: dict, client_id: str, player: dict, previous_map_id: str = "") -> tuple[bool, bool]:
    current_map_id = str(player.get("mapId", ""))
    session = room.get("m04") or new_m04_session()
    changed = False
    boss_reset = False
    if current_map_id == M04_MAP_ID:
        if not session.get("active"):
            clear_m04_runtime_locked(room)
            flags = [str(flag) for flag in list(player.get("flags") or [])[:240] if str(flag)]
            session = {
                **new_m04_session(),
                "active": True,
                "sessionId": secrets.token_urlsafe(8),
                "leaderId": str(client_id),
                "leaderName": clean_limited_text(player.get("name", "玩家"), 16),
                "flags": list(dict.fromkeys(flags)),
                "startedAt": int(time.time() * 1000),
            }
            room["m04"] = session
            changed = True
            boss_reset = True
        elif str(session.get("leaderId", "")) == str(client_id):
            merged_flags = list(dict.fromkeys([
                *list(session.get("flags") or []),
                *[str(flag) for flag in list(player.get("flags") or [])[:240] if str(flag)],
            ]))[:240]
            session["flags"] = merged_flags
            session["leaderName"] = clean_limited_text(player.get("name", session.get("leaderName", "玩家")), 16)
    elif previous_map_id == M04_MAP_ID and not m04_member_ids(room):
        clear_m04_runtime_locked(room)
        room["m04"] = new_m04_session()
        changed = True
        boss_reset = True
    return changed, boss_reset


class WsClient:
    def __init__(self, sock: socket.socket, address: tuple[str, int] | None):
        self.sock = sock
        self.address = address
        self.send_lock = threading.Lock()
        self.alive = True
        self.user_id: int | None = None
        self.id = ""
        self.room_name = ""
        self.player: dict = {}
        self.message_times: list[float] = []
        self.chat_times: list[float] = []


def ws_frame(payload: bytes, opcode: int = 0x1) -> bytes:
    first = 0x80 | opcode
    length = len(payload)
    if length < 126:
        return bytes([first, length]) + payload
    if length < 65536:
        return bytes([first, 126]) + struct.pack("!H", length) + payload
    return bytes([first, 127]) + struct.pack("!Q", length) + payload


def send_ws(client: WsClient, payload: dict) -> None:
    if not client.alive:
        return
    raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    try:
        with client.send_lock:
            client.sock.sendall(ws_frame(raw))
    except OSError:
        client.alive = False


def read_exact(sock: socket.socket, size: int) -> bytes | None:
    data = bytearray()
    while len(data) < size:
        try:
            chunk = sock.recv(size - len(data))
        except OSError:
            return None
        if not chunk:
            return None
        data.extend(chunk)
    return bytes(data)


def read_ws_message(sock: socket.socket) -> str | None:
    while True:
        header = read_exact(sock, 2)
        if not header:
            return None
        first, second = header
        opcode = first & 0x0F
        masked = bool(second & 0x80)
        length = second & 0x7F
        if length == 126:
            extended = read_exact(sock, 2)
            if not extended:
                return None
            length = struct.unpack("!H", extended)[0]
        elif length == 127:
            extended = read_exact(sock, 8)
            if not extended:
                return None
            length = struct.unpack("!Q", extended)[0]
        if length > MAX_WS_FRAME_BYTES:
            return None

        mask = read_exact(sock, 4) if masked else b""
        payload = read_exact(sock, length) if length else b""
        if payload is None:
            return None
        if masked and mask:
            payload = bytes(byte ^ mask[index % 4] for index, byte in enumerate(payload))

        if opcode == 0x8:
            return None
        if opcode == 0x9:
            try:
                sock.sendall(ws_frame(payload, 0xA))
            except OSError:
                return None
            continue
        if opcode == 0x1:
            if len(payload) > MAX_WS_MESSAGE_BYTES:
                return None
            return payload.decode("utf-8", errors="ignore")


def broadcast(room_name: str, payload: dict, except_client: WsClient | None = None) -> None:
    with state_lock:
        targets = [
            client
            for client in clients
            if client.room_name == room_name and client is not except_client and client.alive
        ]
    for target in targets:
        send_ws(target, payload)


def allow_rate(timestamps: list[float], limit: int, window_seconds: float) -> bool:
    now = time.time()
    cutoff = now - window_seconds
    while timestamps and timestamps[0] < cutoff:
        timestamps.pop(0)
    if len(timestamps) >= limit:
        return False
    timestamps.append(now)
    return True


def clean_chat_text(value: object) -> str:
    if not isinstance(value, (str, int, float)):
        return ""
    text = CONTROL_CHAR_RE.sub("", str(value))
    text = CHAT_TAG_RE.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:CHAT_TEXT_LIMIT]


def user_by_id(user_id: int) -> sqlite3.Row | None:
    with db() as conn:
        return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def leave_client(client: WsClient) -> None:
    left_room = ""
    left_id = ""
    m04_payload = None
    reset_boss = False
    with state_lock:
        if client in clients:
            clients.remove(client)
        if client.user_id is not None and clients_by_user.get(client.user_id) is client:
            del clients_by_user[client.user_id]
        if client.room_name:
            room = get_room(client.room_name)
            if client.id in room["peers"]:
                previous_map_id = str(room["peers"][client.id].get("mapId", ""))
                del room["peers"][client.id]
                left_room = client.room_name
                left_id = client.id
                if previous_map_id == M04_MAP_ID and not m04_member_ids(room):
                    clear_m04_runtime_locked(room)
                    room["m04"] = new_m04_session()
                    m04_payload = m04_session_payload(room)
                    reset_boss = True
            if not room["peers"]:
                room["boss"] = dict(DEFAULT_BOSS)
                room["slimes"].clear()
                room["drops"].clear()
                room["progress"].clear()
                room["m04"] = new_m04_session()
                m04_payload = m04_session_payload(room)
                reset_boss = True
        client.alive = False
    if left_room and left_id:
        broadcast(left_room, {"type": "peerLeft", "id": left_id}, client)
        if m04_payload is not None:
            broadcast(left_room, {"type": "m04Session", "session": m04_payload}, client)
        if reset_boss:
            broadcast(left_room, {"type": "bossState", "boss": dict(DEFAULT_BOSS)}, client)


def player_state_from_message(user: sqlite3.Row, profile: dict, incoming: dict) -> dict:
    flags = []
    for flag in list(incoming.get("flags") or [])[:240]:
        clean_flag = re.sub(r"[^A-Za-z0-9_-]", "", str(flag))[:96]
        if clean_flag and clean_flag not in flags:
            flags.append(clean_flag)
    return {
        "id": profile["id"],
        "name": profile["name"],
        "characterId": profile["characterId"],
        "x": clean_number(incoming.get("x"), 3200, 0, 20000),
        "y": clean_number(incoming.get("y"), 3200, 0, 20000),
        "flipX": bool(incoming.get("flipX")),
        "action": str(incoming.get("action") or "idle")[:24],
        "hp": clean_number(incoming.get("hp"), profile["hp"], 0, profile["maxHp"]),
        "maxHp": clean_number(incoming.get("maxHp"), profile["maxHp"], 1, 9999),
        "shield": clean_number(incoming.get("shield"), profile.get("shield", 0), 0, 9999),
        "level": clean_number(profile.get("level"), 1, 1, 99),
        "mapId": clean_limited_text(incoming.get("mapId", ""), 64),
        "flags": flags,
        "updatedAt": int(time.time() * 1000),
    }


def handle_join(client: WsClient, message: dict) -> None:
    user = user_by_token(str(message.get("token", "")))
    if not user:
        send_ws(client, {"type": "authError", "text": "登录已过期，请重新登录。"})
        client.alive = False
        return

    profile = load_profile(user)
    player = player_state_from_message(user, profile, message.get("player") or {})
    room_name = str(message.get("room") or "zhonghe-plaza")[:48]

    with state_lock:
        replacing = clients_by_user.get(user["id"])
        if replacing and replacing is not client:
            replacing.alive = False
            try:
                replacing.sock.shutdown(socket.SHUT_RDWR)
                replacing.sock.close()
            except OSError:
                pass

        if user["id"] not in clients_by_user and len(clients_by_user) >= MAX_ONLINE:
            send_ws(
                client,
                {
                    "type": "queue",
                    "position": 1,
                    "text": f"当前在线人数已满（{MAX_ONLINE} 人），请稍后再进入。",
                },
            )
            client.alive = False
            return

        room = get_room(room_name)
        client.user_id = int(user["id"])
        client.id = profile["id"]
        client.room_name = room_name
        client.player = player
        clients.add(client)
        clients_by_user[client.user_id] = client
        room["peers"][client.id] = player
        m04_changed, m04_boss_reset = update_m04_session_locked(room, client.id, player)
        m04_session = m04_session_payload(room)
        peers = [peer for peer_id, peer in room["peers"].items() if peer_id != client.id]
        boss = dict(room["boss"])
        slimes = list(room["slimes"].values())
        now_ms = int(time.time() * 1000)
        expired_drop_ids = [
            drop_id
            for drop_id, drop in room["drops"].items()
            if int(drop.get("expiresAt", 0)) <= now_ms
        ]
        for drop_id in expired_drop_ids:
            room["drops"].pop(drop_id, None)
        drops = list(room["drops"].values())
        progress = list(room["progress"].values())
        chat = list(room["chat"][-CHAT_HISTORY_LIMIT:])

    send_ws(
        client,
        {
            "type": "welcome",
            "id": client.id,
            "peers": peers,
            "boss": boss,
            "slimes": slimes,
            "drops": drops,
            "progress": progress,
            "chat": chat,
            "recentChat": chat,
            "m04Session": m04_session,
            "serverTime": int(time.time() * 1000),
        },
    )
    broadcast(room_name, {"type": "peerJoined", "player": player}, client)
    if m04_changed:
        broadcast(room_name, {"type": "m04Session", "session": m04_session})
    if m04_boss_reset:
        broadcast(room_name, {"type": "bossState", "boss": dict(DEFAULT_BOSS)})


def handle_update(client: WsClient, message: dict) -> None:
    if client.user_id is None or not client.room_name:
        return
    user = user_by_token(str(message.get("token", ""))) if message.get("token") else None
    if not user:
        with db() as conn:
            user = conn.execute("SELECT * FROM users WHERE id = ?", (client.user_id,)).fetchone()
    if not user:
        return
    profile = load_profile(user)
    player = player_state_from_message(user, profile, message.get("player") or {})
    with state_lock:
        previous_map_id = str(client.player.get("mapId", ""))
        client.player = player
        room = get_room(client.room_name)
        room["peers"][client.id] = player
        m04_changed, m04_boss_reset = update_m04_session_locked(room, client.id, player, previous_map_id)
        m04_session = m04_session_payload(room)
    broadcast(client.room_name, {"type": "peerUpdated", "player": player}, client)
    if m04_changed:
        broadcast(client.room_name, {"type": "m04Session", "session": m04_session})
    if m04_boss_reset:
        broadcast(client.room_name, {"type": "bossState", "boss": dict(DEFAULT_BOSS)})


def handle_area_heal(client: WsClient, message: dict) -> None:
    if client.user_id is None or not client.room_name or not client.id:
        return
    amount = clean_number(message.get("amount"), 1, 1, 120)
    radius = clean_number(message.get("radius"), 64, 32, 320)
    targets: list[dict] = []
    with state_lock:
        room = get_room(client.room_name)
        caster = room["peers"].get(client.id)
        if not caster:
            return
        caster_x = float(caster.get("x", 0))
        caster_y = float(caster.get("y", 0))
        caster_map = str(caster.get("mapId", ""))
        for peer_id, peer in room["peers"].items():
            if str(peer.get("mapId", "")) != caster_map:
                continue
            dx = float(peer.get("x", 0)) - caster_x
            dy = float(peer.get("y", 0)) - caster_y
            if dx * dx + dy * dy > radius * radius:
                continue
            max_hp = max(1, float(peer.get("maxHp", 1)))
            hp = min(max_hp, max(0, float(peer.get("hp", 0))) + amount)
            peer["hp"] = hp
            peer["updatedAt"] = int(time.time() * 1000)
            targets.append({"id": peer_id, "hp": hp, "maxHp": max_hp})
            target_client = next(
                (candidate for candidate in clients if candidate.id == peer_id and candidate.room_name == client.room_name),
                None,
            )
            if target_client:
                target_client.player["hp"] = hp
    if targets:
        broadcast(client.room_name, {"type": "areaHeal", "sourceId": client.id, "targets": targets})


def handle_healing_chain(client: WsClient, message: dict) -> None:
    if client.user_id is None or not client.room_name or not client.id:
        return
    healing = clean_number(message.get("healing"), 1, 1, 220)
    shield_gain = clean_number(message.get("shield"), 1, 1, 160)
    radius = clean_number(message.get("radius"), 640, 64, 640)
    jumps = int(clean_number(message.get("jumps"), 5, 1, 5))
    bounces: list[dict] = []
    source: dict = {}
    with state_lock:
        room = get_room(client.room_name)
        caster = room["peers"].get(client.id)
        if not caster:
            return
        source = {"x": float(caster.get("x", 0)), "y": float(caster.get("y", 0))}
        caster_map = str(caster.get("mapId", ""))
        candidates = [
            (peer_id, peer)
            for peer_id, peer in room["peers"].items()
            if str(peer.get("mapId", "")) == caster_map
            and (float(peer.get("x", 0)) - source["x"]) ** 2 + (float(peer.get("y", 0)) - source["y"]) ** 2 <= radius * radius
        ]
        previous_id = ""
        for _ in range(jumps):
            available = [entry for entry in candidates if entry[0] != previous_id] if len(candidates) > 1 else candidates
            if not available:
                break
            wounded = [entry for entry in available if float(entry[1].get("hp", 0)) < float(entry[1].get("maxHp", 1))]
            if wounded:
                target_id, target = min(
                    wounded,
                    key=lambda entry: float(entry[1].get("hp", 0)) / max(1, float(entry[1].get("maxHp", 1))),
                )
            else:
                target_id, target = min(
                    available,
                    key=lambda entry: float(entry[1].get("shield", 0)) / max(1, float(entry[1].get("maxHp", 1))),
                )
            max_hp = max(1, float(target.get("maxHp", 1)))
            hp = max(0, float(target.get("hp", 0)))
            target_shield = max(0, float(target.get("shield", 0)))
            before_hp = hp
            before_shield = target_shield
            if hp < max_hp:
                hp = min(max_hp, hp + healing)
            else:
                target_shield = min(max_hp * 0.5, target_shield + shield_gain)
            target["hp"] = hp
            target["shield"] = target_shield
            target["updatedAt"] = int(time.time() * 1000)
            bounces.append(
                {
                    "targetId": target_id,
                    "hp": hp,
                    "maxHp": max_hp,
                    "shield": target_shield,
                    "healed": hp - before_hp,
                    "shieldGain": target_shield - before_shield,
                    "x": float(target.get("x", 0)),
                    "y": float(target.get("y", 0)),
                }
            )
            target_client = next(
                (candidate for candidate in clients if candidate.id == target_id and candidate.room_name == client.room_name),
                None,
            )
            if target_client:
                target_client.player["hp"] = hp
                target_client.player["shield"] = target_shield
            previous_id = target_id
    if bounces:
        broadcast(
            client.room_name,
            {"type": "healingChain", "sourceId": client.id, "source": source, "bounces": bounces},
        )


def handle_boss_start(client: WsClient, message: dict) -> None:
    if client.user_id is None or not client.room_name:
        return
    map_id = str(client.player.get("mapId", ""))
    if map_id == M04_MAP_ID:
        with state_lock:
            session = (get_room(client.room_name).get("m04") or new_m04_session())
            is_leader = bool(session.get("active")) and str(session.get("leaderId", "")) == str(client.id)
        if not is_leader:
            send_ws(client, {"type": "notice", "text": "本轮 M04 仅首位进入者可推进陆教授考核。"})
            return
    incoming = message.get("boss") or {}
    boss = dict(DEFAULT_BOSS)
    boss["maxHp"] = clean_number(incoming.get("maxHp"), DEFAULT_BOSS["maxHp"], 1, 99999)
    boss["hp"] = clean_number(incoming.get("hp"), boss["maxHp"], 0, boss["maxHp"])
    boss["active"] = bool(incoming.get("active", True))
    boss["x"] = clean_number(incoming.get("x"), 3200, 0, 20000)
    boss["y"] = clean_number(incoming.get("y"), 3200, 0, 20000)
    boss["phase"] = clean_limited_text(incoming.get("phase", boss.get("phase", "summoning")), 32)
    boss["waveIndex"] = clean_number(incoming.get("waveIndex"), 0, 0, 12)
    boss["waveTitle"] = clean_limited_text(incoming.get("waveTitle", ""), 64)
    boss["wavesTotal"] = clean_number(incoming.get("wavesTotal"), boss.get("wavesTotal", 3), 1, 12)
    boss["summonsRemaining"] = clean_number(incoming.get("summonsRemaining"), boss["hp"], 0, 99)
    boss["eliteRemaining"] = clean_number(incoming.get("eliteRemaining"), 1, 0, 9)
    boss["chestReady"] = bool(incoming.get("chestReady", False))
    with state_lock:
        room = get_room(client.room_name)
        room["boss"] = boss
        if map_id == M04_MAP_ID:
            session = room.get("m04") or new_m04_session()
            session["started"] = True
            session["phase"] = boss["phase"]
            session["waveIndex"] = int(boss["waveIndex"])
    broadcast(client.room_name, {"type": "bossState", "boss": boss})


def handle_boss_hit(client: WsClient, message: dict) -> None:
    if client.user_id is None or not client.room_name:
        return
    damage = clean_number(message.get("damage"), 1, 1, 80)
    notice = None
    with state_lock:
        room = get_room(client.room_name)
        boss = room["boss"]
        if not boss.get("active"):
            return
        boss["hp"] = max(0, int(boss.get("hp", 0)) - damage)
        if boss["hp"] <= 0:
            boss["active"] = False
            notice = "陆教授协议考核召唤物已清除"
        boss_state = dict(boss)
    if notice:
        broadcast(client.room_name, {"type": "notice", "text": notice})
    broadcast(client.room_name, {"type": "bossState", "boss": boss_state})


def clean_slime_id(value: object, fallback: bool = True) -> str:
    text = str(value or "").strip()[:64]
    if not text:
        return f"slime-{secrets.token_urlsafe(8)}" if fallback else ""
    cleaned = re.sub(r"[^A-Za-z0-9_-]", "", text)[:64]
    return cleaned or (f"slime-{secrets.token_urlsafe(8)}" if fallback else "")


def handle_slime_spawn(client: WsClient, message: dict) -> None:
    if client.user_id is None or not client.room_name:
        return
    incoming = message.get("slime") or {}
    map_id = clean_limited_text(incoming.get("mapId", client.player.get("mapId", "")), 64)
    if map_id != str(client.player.get("mapId", "")):
        return
    if map_id == M04_MAP_ID and bool(incoming.get("bossSummon", False)):
        with state_lock:
            session = (get_room(client.room_name).get("m04") or new_m04_session())
            if not session.get("active") or str(session.get("leaderId", "")) != str(client.id):
                return
    texture_key = re.sub(r"[^A-Za-z0-9_-]", "", str(incoming.get("textureKey") or ""))[:80]
    rank = clean_limited_text(incoming.get("rank", "mob"), 12)
    if rank not in {"mob", "elite", "rare", "boss"}:
        rank = "mob"
    max_hp = clean_number(incoming.get("maxHp"), 72, 1, 99999)
    slime = {
        "id": clean_slime_id(incoming.get("id")),
        "mapId": map_id,
        "x": clean_number(incoming.get("x"), 3200, 0, 20000),
        "y": clean_number(incoming.get("y"), 3200, 0, 20000),
        "hp": clean_number(incoming.get("hp"), max_hp, 0, max_hp),
        "maxHp": max_hp,
        "damage": clean_number(incoming.get("damage"), 8, 1, 9999),
        "state": "move",
        "textureKey": texture_key,
        "rank": rank,
        "label": clean_limited_text(incoming.get("label", ""), 32),
        "staticImage": bool(incoming.get("staticImage", False)),
        "stationary": bool(incoming.get("stationary", False)),
        "scale": clean_float(incoming.get("scale"), 0.9, 0.05, 3.0),
        "enemyArchetype": clean_limited_text(incoming.get("enemyArchetype", ""), 32),
        "bossForm": int(clean_number(incoming.get("bossForm"), 1, 1, 4)),
        "bossPhase": clean_limited_text(incoming.get("bossPhase", ""), 16),
        "bossCharger": bool(incoming.get("bossCharger", False)),
        "hazardBonus": int(clean_number(incoming.get("hazardBonus"), 0, 0, 6)),
        "groupId": clean_limited_text(incoming.get("groupId", ""), 64),
        "bossSummon": bool(incoming.get("bossSummon", False)),
        "bossWaveId": clean_limited_text(incoming.get("bossWaveId", ""), 32),
        "bossWaveTitle": clean_limited_text(incoming.get("bossWaveTitle", ""), 64),
        "ambientWander": bool(incoming.get("ambientWander", False)),
        "passiveWander": bool(incoming.get("passiveWander", False)),
        "smoothMovement": bool(incoming.get("smoothMovement", False)),
        "wanderSpeed": clean_float(incoming.get("wanderSpeed"), 34, 0, 500),
        "chaseSpeed": clean_float(incoming.get("chaseSpeed"), 48, 0, 800),
        "ownerId": client.id,
        "createdAt": int(time.time() * 1000),
    }
    removed_id = ""
    with state_lock:
        room = get_room(client.room_name)
        slimes = room["slimes"]
        if len(slimes) >= MAX_SLIMES_PER_ROOM:
            oldest_id = min(slimes.values(), key=lambda item: item.get("createdAt", 0)).get("id")
            if oldest_id:
                del slimes[oldest_id]
                removed_id = oldest_id
        slimes[slime["id"]] = slime
    if removed_id:
        broadcast(client.room_name, {"type": "slimeRemove", "id": removed_id})
    broadcast(client.room_name, {"type": "slimeSpawn", "slime": slime}, client)


def handle_slime_remove(client: WsClient, message: dict) -> None:
    if client.user_id is None or not client.room_name:
        return
    slime_id = clean_slime_id(message.get("id"), fallback=False)
    if not slime_id:
        return
    with state_lock:
        room = get_room(client.room_name)
        room["slimes"].pop(slime_id, None)
    broadcast(client.room_name, {"type": "slimeRemove", "id": slime_id}, client)


def clean_drop_id(value: object, fallback: bool = True) -> str:
    text = str(value or "").strip()[:72]
    cleaned = re.sub(r"[^A-Za-z0-9_-]", "", text)[:72]
    if cleaned:
        return cleaned
    return f"drop-{secrets.token_urlsafe(9)}" if fallback else ""


def clean_drop_item(value: object) -> dict | None:
    if not isinstance(value, dict):
        return None
    item_id = re.sub(r"[^A-Za-z0-9_-]", "", str(value.get("id") or ""))[:64]
    definition = DROP_ITEM_CATALOG.get(item_id)
    if not definition:
        return None
    item = {
        "id": item_id,
        "name": definition["name"],
        "type": definition["type"],
        "quality": definition["quality"],
        "qty": 1,
        "source": clean_limited_text(value.get("source", "monster"), 32),
        "description": clean_limited_text(value.get("description", ""), 180),
    }
    if definition.get("damageBonus"):
        item["damageBonus"] = definition["damageBonus"]
    return item


def handle_drop_spawn(client: WsClient, message: dict) -> None:
    if client.user_id is None or not client.room_name:
        return
    incoming = message.get("drop") or {}
    if not isinstance(incoming, dict):
        send_ws(client, {"type": "dropError", "text": "掉落物数据无效。"})
        return
    item = clean_drop_item(incoming.get("item"))
    if not item:
        send_ws(client, {"type": "dropError", "text": "掉落物数据无效。"})
        return
    now_ms = int(time.time() * 1000)
    drop = {
        "id": clean_drop_id(incoming.get("id")),
        "ownerId": client.id,
        "ownerName": clean_limited_text(client.player.get("name", "玩家"), 16),
        "mapId": clean_limited_text(incoming.get("mapId", "ch1_m01_classroom_spawn"), 64),
        "x": clean_number(incoming.get("x"), client.player.get("x", 3200), 0, 20000),
        "y": clean_number(incoming.get("y"), client.player.get("y", 3200), 0, 20000),
        "createdAt": now_ms,
        "expiresAt": now_ms + DROP_TTL_MS,
        "item": item,
    }
    removed_ids: list[str] = []
    with state_lock:
        room = get_room(client.room_name)
        drops = room["drops"]
        for drop_id, existing in list(drops.items()):
            if int(existing.get("expiresAt", 0)) <= now_ms:
                drops.pop(drop_id, None)
                removed_ids.append(drop_id)
        if len(drops) >= MAX_DROPS_PER_ROOM:
            oldest_id = min(drops.values(), key=lambda entry: entry.get("createdAt", 0)).get("id")
            if oldest_id:
                drops.pop(oldest_id, None)
                removed_ids.append(oldest_id)
        drops[drop["id"]] = drop
    for removed_id in removed_ids:
        broadcast(client.room_name, {"type": "dropRemove", "id": removed_id})
    broadcast(client.room_name, {"type": "dropSpawn", "drop": drop})


def handle_drop_collect(client: WsClient, message: dict) -> None:
    if client.user_id is None or not client.room_name:
        return
    drop_id = clean_drop_id(message.get("id"), fallback=False)
    if not drop_id:
        return
    drop = None
    error = ""
    with state_lock:
        room = get_room(client.room_name)
        candidate = room["drops"].get(drop_id)
        if not candidate:
            error = "这个掉落物已经消失了。"
        elif int(candidate.get("expiresAt", 0)) <= int(time.time() * 1000):
            room["drops"].pop(drop_id, None)
            error = "这个掉落物已经消失了。"
        elif candidate.get("ownerId") != client.id:
            error = "这是其他玩家的掉落物，无法拾取。"
        else:
            drop = room["drops"].pop(drop_id)
    if error:
        send_ws(client, {"type": "dropError", "text": error})
        if "消失" in error:
            broadcast(client.room_name, {"type": "dropRemove", "id": drop_id})
        return
    send_ws(client, {"type": "dropCollected", "drop": drop})
    broadcast(client.room_name, {"type": "dropRemove", "id": drop_id})


def handle_combat_event(client: WsClient, message: dict) -> None:
    if client.user_id is None or not client.room_name or not client.id:
        return
    incoming = message.get("event") or {}
    if not isinstance(incoming, dict):
        return
    action = clean_limited_text(incoming.get("action", ""), 32)
    map_id = clean_limited_text(incoming.get("mapId", client.player.get("mapId", "")), 64)
    if action not in COMBAT_EVENT_ACTIONS or map_id != str(client.player.get("mapId", "")):
        return
    visual_type = clean_limited_text(incoming.get("visualType", ""), 24)
    if visual_type not in COMBAT_VISUAL_TYPES:
        visual_type = ""
    points = []
    for point in list(incoming.get("points") or [])[:12]:
        if not isinstance(point, dict):
            continue
        points.append({
            "x": clean_number(point.get("x"), client.player.get("x", 0), 0, 20000),
            "y": clean_number(point.get("y"), client.player.get("y", 0), 0, 20000),
        })
    targets = []
    for target in list(incoming.get("targets") or [])[:2]:
        if not isinstance(target, dict):
            continue
        target_id = clean_slime_id(target.get("id"), fallback=False)
        if not target_id:
            continue
        targets.append({
            "id": target_id,
            "x": clean_number(target.get("x"), client.player.get("x", 0), 0, 20000),
            "y": clean_number(target.get("y"), client.player.get("y", 0), 0, 20000),
        })
    chains = []
    for chain in list(incoming.get("chains") or [])[:4]:
        if not isinstance(chain, dict):
            continue
        chain_points = []
        for point in list(chain.get("points") or [])[:3]:
            if not isinstance(point, dict):
                continue
            target_id = clean_slime_id(point.get("id"), fallback=False)
            if not target_id:
                continue
            chain_points.append({
                "id": target_id,
                "x": clean_number(point.get("x"), client.player.get("x", 0), 0, 20000),
                "y": clean_number(point.get("y"), client.player.get("y", 0), 0, 20000),
            })
        chains.append({
            "sourceTargetId": clean_slime_id(chain.get("sourceTargetId"), fallback=False),
            "branch": int(clean_number(chain.get("branch"), 0, 0, 1)),
            "points": chain_points,
        })
    created_at = int(time.time() * 1000)
    lead_ms = int(clean_number(incoming.get("leadMs"), 0, 0, 2000))
    event = {
        "sourceId": client.id,
        "characterId": clean_character(client.player.get("characterId"), "lina"),
        "mapId": map_id,
        "action": action,
        "visualType": visual_type,
        "x": clean_number(incoming.get("x"), client.player.get("x", 0), 0, 20000),
        "y": clean_number(incoming.get("y"), client.player.get("y", 0), 0, 20000),
        "targetX": clean_number(incoming.get("targetX"), client.player.get("x", 0), 0, 20000),
        "targetY": clean_number(incoming.get("targetY"), client.player.get("y", 0), 0, 20000),
        "aimX": clean_float(incoming.get("aimX"), 0, -1, 1),
        "aimY": clean_float(incoming.get("aimY"), 1, -1, 1),
        "speed": clean_number(incoming.get("speed"), 700, 80, 1600),
        "radius": clean_number(incoming.get("radius"), 96, 24, 640),
        "color": clean_number(incoming.get("color"), 0xFFFFFF, 0, 0xFFFFFF),
        "charged": bool(incoming.get("charged", False)),
        "berserk": bool(incoming.get("berserk", False)),
        "secondary": bool(incoming.get("secondary", False)),
        "pulse": int(clean_number(incoming.get("pulse"), 0, 0, 12)),
        "comboIndex": int(clean_number(incoming.get("comboIndex"), 0, 0, 8)),
        "level": int(clean_number(incoming.get("level"), client.player.get("level", 1), 1, 99)),
        "levels": int(clean_number(incoming.get("levels"), 1, 1, 12)),
        "skillId": clean_limited_text(incoming.get("skillId", ""), 32),
        "enemyId": clean_slime_id(incoming.get("enemyId"), fallback=False),
        "damageAmount": clean_number(incoming.get("damageAmount"), 0, 0, 9999),
        "damage": clean_number(incoming.get("damage"), 0, 0, 9999),
        "healAmount": clean_number(incoming.get("healAmount"), 0, 0, 9999),
        "shieldSpent": clean_number(incoming.get("shieldSpent"), 0, 0, 9999),
        "shieldGain": clean_number(incoming.get("shieldGain"), 0, 0, 9999),
        "down": bool(incoming.get("down", False)),
        "side": clean_limited_text(incoming.get("side", ""), 8),
        "sequence": int(clean_number(incoming.get("sequence"), 0, 0, 1000000000)),
        "targets": targets,
        "chains": chains,
        "points": points,
        "createdAt": created_at,
        "executeAt": created_at + lead_ms,
    }
    broadcast(client.room_name, {"type": "combatEvent", "event": event}, client)


def handle_enemy_state(client: WsClient, message: dict) -> None:
    if client.user_id is None or not client.room_name or not client.id:
        return
    incoming = message.get("enemy") or {}
    if not isinstance(incoming, dict):
        return
    enemy_id = clean_slime_id(incoming.get("id"), fallback=False)
    map_id = clean_limited_text(incoming.get("mapId", client.player.get("mapId", "")), 64)
    state = clean_limited_text(incoming.get("state", "move"), 12)
    if not enemy_id or map_id != str(client.player.get("mapId", "")) or state not in ENEMY_STATES:
        return
    if map_id == M04_MAP_ID and state in {"transform", "charging", "phase2Combat", "phase3"}:
        with state_lock:
            session = (get_room(client.room_name).get("m04") or new_m04_session())
            leader_id = str(session.get("leaderId", ""))
        if leader_id and leader_id != str(client.id):
            return
    texture_key = re.sub(r"[^A-Za-z0-9_-]", "", str(incoming.get("textureKey") or ""))[:80]
    rank = clean_limited_text(incoming.get("rank", "mob"), 12)
    if rank not in {"mob", "elite", "rare", "boss"}:
        rank = "mob"
    max_hp = clean_number(incoming.get("maxHp"), 72, 1, 99999)
    scale = clean_float(incoming.get("scale"), 0.9, 0.05, 3.0)
    enemy = {
        "id": enemy_id,
        "mapId": map_id,
        "x": clean_number(incoming.get("x"), client.player.get("x", 0), 0, 20000),
        "y": clean_number(incoming.get("y"), client.player.get("y", 0), 0, 20000),
        "hp": clean_number(incoming.get("hp"), max_hp, 0, max_hp),
        "maxHp": max_hp,
        "damage": clean_number(incoming.get("damage"), 8, 1, 9999),
        "state": state,
        "textureKey": texture_key,
        "rank": rank,
        "label": clean_limited_text(incoming.get("label", ""), 32),
        "staticImage": bool(incoming.get("staticImage", False)),
        "stationary": bool(incoming.get("stationary", False)),
        "scale": scale,
        "enemyArchetype": clean_limited_text(incoming.get("enemyArchetype", ""), 32),
        "bossForm": int(clean_number(incoming.get("bossForm"), 1, 1, 4)),
        "bossPhase": clean_limited_text(incoming.get("bossPhase", ""), 16),
        "bossCharger": bool(incoming.get("bossCharger", False)),
        "hazardBonus": int(clean_number(incoming.get("hazardBonus"), 0, 0, 6)),
        "groupId": clean_limited_text(incoming.get("groupId", ""), 64),
        "bossSummon": bool(incoming.get("bossSummon", False)),
        "bossWaveId": clean_limited_text(incoming.get("bossWaveId", ""), 32),
        "bossWaveTitle": clean_limited_text(incoming.get("bossWaveTitle", ""), 64),
        "damageAmount": clean_number(incoming.get("damageAmount"), 0, 0, 99999),
        "critical": bool(incoming.get("critical", False)),
        "hitKind": clean_limited_text(incoming.get("hitKind", "magic"), 12),
        "energyGained": clean_number(incoming.get("energyGained"), 0, 0, 999),
        "sourceCharacterId": clean_character(client.player.get("characterId"), "lina"),
        "ownerId": client.id,
        "createdAt": int(time.time() * 1000),
    }
    with state_lock:
        room = get_room(client.room_name)
        existing = room["slimes"].get(enemy_id)
        if existing and state in {"visualHit", "hit", "dead"} and enemy["damageAmount"] > 0:
            authoritative_max_hp = max(1, float(existing.get("maxHp", enemy["maxHp"])))
            authoritative_hp = max(0, float(existing.get("hp", authoritative_max_hp)) - enemy["damageAmount"])
            enemy["maxHp"] = authoritative_max_hp
            enemy["hp"] = authoritative_hp
        room["slimes"][enemy_id] = enemy
    broadcast(client.room_name, {"type": "enemyState", "enemy": enemy}, client)


def handle_enemy_batch(client: WsClient, message: dict) -> None:
    if client.user_id is None or not client.room_name or not client.id:
        return
    map_id = clean_limited_text(message.get("mapId", client.player.get("mapId", "")), 64)
    if map_id != str(client.player.get("mapId", "")) or map_id != M04_MAP_ID:
        return
    with state_lock:
        room = get_room(client.room_name)
        session = room.get("m04") or new_m04_session()
        if session.get("active") and str(session.get("leaderId", "")) != str(client.id):
            return
        stored = room["slimes"]
        enemies = []
        for incoming in list(message.get("enemies") or [])[:24]:
            if not isinstance(incoming, dict):
                continue
            enemy_id = clean_slime_id(incoming.get("id"), fallback=False)
            existing = stored.get(enemy_id)
            if not enemy_id or not existing or str(existing.get("mapId", "")) != map_id:
                continue
            max_hp = clean_number(incoming.get("maxHp"), existing.get("maxHp", 1), 1, 99999)
            state = clean_limited_text(incoming.get("state", "move"), 16)
            if state not in ENEMY_STATES:
                state = "move"
            snapshot = {
                "id": enemy_id,
                "x": clean_number(incoming.get("x"), existing.get("x", 0), 0, 20000),
                "y": clean_number(incoming.get("y"), existing.get("y", 0), 0, 20000),
                "hp": clean_number(incoming.get("hp"), existing.get("hp", max_hp), 0, max_hp),
                "maxHp": max_hp,
                "state": state,
                "bossPhase": clean_limited_text(incoming.get("bossPhase", existing.get("bossPhase", "")), 16),
                "bossForm": int(clean_number(incoming.get("bossForm"), existing.get("bossForm", 1), 1, 4)),
                "flipX": bool(incoming.get("flipX", False)),
            }
            existing.update(snapshot)
            enemies.append(snapshot)
    if enemies:
        broadcast(client.room_name, {
            "type": "enemyBatch",
            "mapId": map_id,
            "serverTime": int(time.time() * 1000),
            "enemies": enemies,
        }, client)


def handle_progress_event(client: WsClient, message: dict) -> None:
    if client.user_id is None or not client.room_name or not client.id:
        return
    incoming = message.get("event") or {}
    if not isinstance(incoming, dict):
        return
    map_id = clean_limited_text(incoming.get("mapId", client.player.get("mapId", "")), 64)
    if map_id != str(client.player.get("mapId", "")):
        return
    if map_id == M04_MAP_ID:
        with state_lock:
            session = (get_room(client.room_name).get("m04") or new_m04_session())
            if not session.get("active") or str(session.get("leaderId", "")) != str(client.id):
                send_ws(client, {"type": "notice", "text": "M04 区域进度由本轮首位进入者统一推进。"})
                return
    kind = clean_limited_text(incoming.get("kind", "flag"), 16)
    if kind not in {"flag", "node", "encounter"}:
        kind = "flag"
    event_id = re.sub(r"[^A-Za-z0-9_-]", "", str(incoming.get("eventId") or ""))[:96]
    if not event_id:
        return
    flags = []
    for flag in list(incoming.get("flags") or [])[:16]:
        clean_flag = re.sub(r"[^A-Za-z0-9_-]", "", str(flag))[:96]
        if clean_flag and clean_flag not in flags:
            flags.append(clean_flag)
    event = {
        "id": f"{map_id}:{kind}:{event_id}",
        "sourceId": client.id,
        "sourceName": clean_limited_text(client.player.get("name", ""), 16),
        "mapId": map_id,
        "kind": kind,
        "eventId": event_id,
        "flags": flags,
        "x": clean_number(incoming.get("x"), client.player.get("x", 0), 0, 20000),
        "y": clean_number(incoming.get("y"), client.player.get("y", 0), 0, 20000),
        "createdAt": int(time.time() * 1000),
    }
    with state_lock:
        room = get_room(client.room_name)
        existing = room["progress"].get(event["id"])
        room["progress"][event["id"]] = event
        if map_id == M04_MAP_ID:
            session = room.get("m04") or new_m04_session()
            session["flags"] = list(dict.fromkeys([
                *list(session.get("flags") or []),
                *flags,
            ]))[:240]
    if not existing:
        broadcast(client.room_name, {"type": "progressEvent", "event": event}, client)


def handle_chat_send(client: WsClient, message: dict) -> None:
    if client.user_id is None or not client.room_name:
        return
    if not allow_rate(client.chat_times, MAX_CHAT_MESSAGES_PER_WINDOW, CHAT_RATE_WINDOW_SECONDS):
        send_ws(client, {"type": "chatError", "code": "rate_limited", "text": "Please slow down."})
        return

    text = clean_chat_text(message.get("text", message.get("message", "")))
    if not text:
        return

    user = user_by_id(client.user_id)
    if user:
        profile = load_profile(user)
        name = clean_name(profile.get("name"), client.player.get("name") or client.id)
        if name in DEFAULT_CHARACTER_NAMES.values():
            account_name = clean_name(user["nickname"], user["username"])
            name = user["username"] if account_name in DEFAULT_CHARACTER_NAMES.values() else account_name
        character_id = clean_character(profile.get("characterId"), client.player.get("characterId", "lina"))
        player_id = profile["id"]
    else:
        name = clean_name(client.player.get("name"), client.id)
        character_id = clean_character(client.player.get("characterId"), "lina")
        player_id = client.id

    chat_message = {
        "id": f"chat-{int(time.time() * 1000)}-{secrets.token_urlsafe(4)}",
        "room": client.room_name,
        "playerId": player_id,
        "name": name,
        "characterId": character_id,
        "text": text,
        "createdAt": int(time.time() * 1000),
    }

    with state_lock:
        room = get_room(client.room_name)
        room["chat"].append(chat_message)
        if CHAT_HISTORY_LIMIT <= 0:
            room["chat"].clear()
        elif len(room["chat"]) > CHAT_HISTORY_LIMIT:
            del room["chat"][:-CHAT_HISTORY_LIMIT]

    broadcast(client.room_name, {"type": "chatMessage", "message": chat_message})


def handle_ws_message(client: WsClient, raw: str) -> None:
    if len(raw.encode("utf-8")) > MAX_WS_MESSAGE_BYTES:
        client.alive = False
        return
    if not allow_rate(client.message_times, MAX_WS_MESSAGES_PER_WINDOW, WS_RATE_WINDOW_SECONDS):
        send_ws(client, {"type": "rateLimited", "code": "message_rate"})
        return
    try:
        message = json.loads(raw)
    except json.JSONDecodeError:
        return
    if not isinstance(message, dict):
        return
    message_type = message.get("type")
    if message_type == "join":
        handle_join(client, message)
    elif message_type == "update":
        handle_update(client, message)
    elif message_type == "bossStart":
        handle_boss_start(client, message)
    elif message_type == "bossHit":
        handle_boss_hit(client, message)
    elif message_type == "slimeSpawn":
        handle_slime_spawn(client, message)
    elif message_type == "slimeRemove":
        handle_slime_remove(client, message)
    elif message_type == "dropSpawn":
        handle_drop_spawn(client, message)
    elif message_type == "dropCollect":
        handle_drop_collect(client, message)
    elif message_type == "healingChain":
        handle_healing_chain(client, message)
    elif message_type == "combatEvent":
        handle_combat_event(client, message)
    elif message_type == "enemyState":
        handle_enemy_state(client, message)
    elif message_type == "enemyBatch":
        handle_enemy_batch(client, message)
    elif message_type == "progressEvent":
        handle_progress_event(client, message)
    elif message_type == "chatSend":
        handle_chat_send(client, message)


class GameHandler(BaseHTTPRequestHandler):
    server_version = "EFVPlay/1.0"

    def log_message(self, fmt: str, *args) -> None:
        print(f"{self.address_string()} - {fmt % args}")

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/me":
            user = user_by_token(auth_token_from_header(self))
            if not user:
                json_response(self, 401, {"error": "请先登录。"})
                return
            json_response(self, 200, {"profile": load_profile(user), "characters": list_characters(user)})
            return
        if path == "/api/characters":
            user = user_by_token(auth_token_from_header(self))
            if not user:
                json_response(self, 401, {"error": "请先登录。"})
                return
            json_response(self, 200, {"characters": list_characters(user)})
            return
        if path == "/ws" and self.headers.get("upgrade", "").lower() == "websocket":
            self.handle_websocket()
            return
        self.serve_static(path)

    def do_HEAD(self) -> None:
        self.serve_static(urlparse(self.path).path, head_only=True)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        payload = read_json(self)
        if path == "/api/register":
            status, body = handle_register(payload)
            json_response(self, status, body)
            return
        if path == "/api/login":
            status, body = handle_login(payload)
            json_response(self, status, body)
            return
        if path == "/api/save":
            user = user_by_token(auth_token_from_header(self))
            if not user:
                json_response(self, 401, {"error": "登录已过期，请重新登录。"})
                return
            profile = save_profile(user, payload.get("profile") or {})
            json_response(self, 200, {"profile": profile})
            return
        if path == "/api/characters/create":
            user = user_by_token(auth_token_from_header(self))
            if not user:
                json_response(self, 401, {"error": "登录已过期，请重新登录。"})
                return
            status, body = handle_character_create(user, payload)
            json_response(self, status, body)
            return
        if path == "/api/characters/select":
            user = user_by_token(auth_token_from_header(self))
            if not user:
                json_response(self, 401, {"error": "登录已过期，请重新登录。"})
                return
            status, body = handle_character_select(user, payload)
            json_response(self, status, body)
            return
        if path == "/api/characters/delete":
            user = user_by_token(auth_token_from_header(self))
            if not user:
                json_response(self, 401, {"error": "登录已过期，请重新登录。"})
                return
            status, body = handle_character_delete(user, payload)
            json_response(self, status, body)
            return
        json_response(self, 404, {"error": "接口不存在。"})

    def serve_static(self, raw_path: str, head_only: bool = False) -> None:
        pathname = unquote(raw_path or "/")
        if pathname == "/":
            pathname = "/play.html"
        requested = (ROOT / pathname.lstrip("/")).resolve()
        blocked_parts = {".git", ".agents", ".codex", "__pycache__"}
        if (
            requested != ROOT
            and ROOT not in requested.parents
            or any(part in blocked_parts for part in requested.parts)
            or requested.name.startswith("play-data.sqlite3")
        ):
            self.send_error(403)
            return
        if not requested.is_file():
            self.send_error(404)
            return
        ctype = CONTENT_TYPES.get(requested.suffix.lower()) or mimetypes.guess_type(str(requested))[0] or "application/octet-stream"
        file_stat = requested.stat()
        file_size = file_stat.st_size
        etag = f'"{file_stat.st_mtime_ns:x}-{file_size:x}"'
        relative_parts = requested.relative_to(ROOT).parts
        is_versioned_asset = bool(relative_parts and relative_parts[0] == "assets")
        cache_control = "public, max-age=2592000, immutable" if is_versioned_asset else "no-cache"
        if not self.headers.get("range") and self.headers.get("if-none-match") == etag:
            self.send_response(304)
            self.send_header("etag", etag)
            self.send_header("cache-control", cache_control)
            self.end_headers()
            return
        start = 0
        end = max(0, file_size - 1)
        status = 200
        range_header = self.headers.get("range", "")
        range_match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip(), re.IGNORECASE) if range_header else None
        if range_header and not range_match:
            self.send_response(416)
            self.send_header("content-range", f"bytes */{file_size}")
            self.end_headers()
            return
        if range_match and file_size:
            first, last = range_match.groups()
            if not first and last:
                length = min(file_size, max(0, int(last)))
                start = file_size - length
            else:
                start = int(first or 0)
                end = min(end, int(last)) if last else end
            if start >= file_size or end < start:
                self.send_response(416)
                self.send_header("content-range", f"bytes */{file_size}")
                self.end_headers()
                return
            status = 206
        content_length = max(0, end - start + 1) if file_size else 0
        self.send_response(status)
        self.send_header("content-type", ctype)
        self.send_header("cache-control", cache_control)
        self.send_header("etag", etag)
        self.send_header("accept-ranges", "bytes")
        if status == 206:
            self.send_header("content-range", f"bytes {start}-{end}/{file_size}")
        self.send_header("content-length", str(content_length))
        self.end_headers()
        if head_only or not content_length:
            return
        try:
            with requested.open("rb") as source:
                source.seek(start)
                remaining = content_length
                while remaining > 0:
                    chunk = source.read(min(256 * 1024, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            return

    def handle_websocket(self) -> None:
        key = self.headers.get("sec-websocket-key")
        if not key:
            self.send_error(400)
            return
        accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode("ascii")).digest()).decode("ascii")
        self.send_response(101, "Switching Protocols")
        self.send_header("upgrade", "websocket")
        self.send_header("connection", "Upgrade")
        self.send_header("sec-websocket-accept", accept)
        self.end_headers()

        client = WsClient(self.connection, self.client_address)
        try:
            while client.alive:
                raw = read_ws_message(self.connection)
                if raw is None:
                    break
                handle_ws_message(client, raw)
        finally:
            leave_client(client)
            try:
                self.connection.close()
            except OSError:
                pass
            self.close_connection = True


def main() -> None:
    init_db()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), GameHandler)
    print(f"EFV online server: http://127.0.0.1:{PORT}/play.html")
    print(f"SQLite database: {DB_PATH}")
    print(f"Max online players: {MAX_ONLINE}")
    server.serve_forever()


if __name__ == "__main__":
    main()
