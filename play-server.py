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
SESSION_TTL = 7 * 24 * 60 * 60
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
USERNAME_RE = re.compile(r"^[A-Za-z0-9_-]{3,18}$")
CHARACTER_IDS = {"lina", "ayu"}
CHARACTER_LIMIT = 5
PROFILE_EXTRA_STRING_FIELDS = {"chapterId", "mapId", "spawnId", "characterRecordId"}
PROFILE_EXTRA_JSON_FIELDS = {"flags", "quests", "inventory", "equipment", "collections"}
PROFILE_EXTRA_JSON_MAX_BYTES = 12 * 1024
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
CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
CHAT_TAG_RE = re.compile(r"<[^>\r\n]{0,120}>")

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
            "UPDATE users SET nickname = ?, character_id = ?, updated_at = ? WHERE id = ?",
            (safe_profile["name"], safe_profile["characterId"], now, user["id"]),
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
                    safe_profile["name"],
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


DEFAULT_CHARACTER_NAMES = {"lina": "莉娜", "ayu": "阿宇"}


def character_to_dict(row: sqlite3.Row) -> dict:
    max_hp = clean_number(row["max_hp"], 160, 1, 9999)
    return {
        "slot": int(row["slot"]),
        "characterId": clean_character(row["character_id"]),
        "name": clean_name(row["name"]),
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
    name = clean_name(payload.get("name"), DEFAULT_CHARACTER_NAMES.get(requested, user["nickname"]))
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
            "chat": [],
        }
    rooms[name].setdefault("slimes", {})
    rooms[name].setdefault("chat", [])
    return rooms[name]


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
    with state_lock:
        if client in clients:
            clients.remove(client)
        if client.user_id is not None and clients_by_user.get(client.user_id) is client:
            del clients_by_user[client.user_id]
        if client.room_name:
            room = get_room(client.room_name)
            if client.id in room["peers"]:
                del room["peers"][client.id]
                left_room = client.room_name
                left_id = client.id
            if not room["peers"]:
                room["boss"] = dict(DEFAULT_BOSS)
                room["slimes"].clear()
        client.alive = False
    if left_room and left_id:
        broadcast(left_room, {"type": "peerLeft", "id": left_id}, client)


def player_state_from_message(user: sqlite3.Row, profile: dict, incoming: dict) -> dict:
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
        peers = [peer for peer_id, peer in room["peers"].items() if peer_id != client.id]
        boss = dict(room["boss"])
        slimes = list(room["slimes"].values())
        chat = list(room["chat"][-CHAT_HISTORY_LIMIT:])

    send_ws(
        client,
        {
            "type": "welcome",
            "id": client.id,
            "peers": peers,
            "boss": boss,
            "slimes": slimes,
            "chat": chat,
            "recentChat": chat,
        },
    )
    broadcast(room_name, {"type": "peerJoined", "player": player}, client)


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
        client.player = player
        get_room(client.room_name)["peers"][client.id] = player
    broadcast(client.room_name, {"type": "peerUpdated", "player": player}, client)


def handle_boss_start(client: WsClient, message: dict) -> None:
    if client.user_id is None or not client.room_name:
        return
    incoming = message.get("boss") or {}
    boss = dict(DEFAULT_BOSS)
    boss["maxHp"] = clean_number(incoming.get("maxHp"), DEFAULT_BOSS["maxHp"], 1, 99999)
    boss["hp"] = boss["maxHp"]
    boss["active"] = True
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
        get_room(client.room_name)["boss"] = boss
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
    slime = {
        "id": clean_slime_id(incoming.get("id")),
        "x": clean_number(incoming.get("x"), 3200, 0, 20000),
        "y": clean_number(incoming.get("y"), 3200, 0, 20000),
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

    def serve_static(self, raw_path: str) -> None:
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
        body = requested.read_bytes()
        self.send_response(200)
        self.send_header("content-type", ctype)
        self.send_header("cache-control", "no-cache")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

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
