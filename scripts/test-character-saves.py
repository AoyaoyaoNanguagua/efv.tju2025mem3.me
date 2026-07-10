import importlib.util
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("efv_play_server", ROOT / "play-server.py")
SERVER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SERVER)


class CharacterSaveTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        SERVER.DB_PATH = Path(self.temp_dir.name) / "play-data.sqlite3"
        SERVER.init_db()
        status, _ = SERVER.handle_register({
            "username": "save_test",
            "nickname": "Save Test",
            "password": "test-pass-123",
        })
        self.assertEqual(status, 200)
        with SERVER.db() as conn:
            self.user = conn.execute(
                "SELECT * FROM users WHERE username = ?", ("save_test",)
            ).fetchone()

    def tearDown(self):
        self.temp_dir.cleanup()

    def select(self, slot):
        status, body = SERVER.handle_character_select(self.user, {"slot": slot})
        self.assertEqual(status, 200)
        return body["profile"]

    def test_character_progress_is_isolated_and_reused_slot_starts_fresh(self):
        status, _ = SERVER.handle_character_create(self.user, {"characterId": "lina"})
        self.assertEqual(status, 200)
        old_lina = self.select(0)
        old_record_id = old_lina["characterRecordId"]
        old_lina.update({
            "mapId": "ch1_m04_library_lawn_boss",
            "spawnId": "ch1_m04_spawn_lawn_gate",
            "flags": {"ch1_final_boss_defeated": True},
        })
        SERVER.save_profile(self.user, old_lina)

        status, _ = SERVER.handle_character_create(self.user, {"characterId": "ayu"})
        self.assertEqual(status, 200)
        ayu = self.select(1)
        self.assertEqual(ayu["mapId"], "ch1_m01_classroom_spawn")
        ayu["mapId"] = "ch1_m02_prompt_archive"
        ayu["spawnId"] = "ch1_m02_spawn_from_classroom"
        SERVER.save_profile(self.user, ayu)

        self.assertEqual(self.select(0)["mapId"], "ch1_m04_library_lawn_boss")
        self.assertEqual(self.select(1)["mapId"], "ch1_m02_prompt_archive")

        status, _ = SERVER.handle_character_delete(self.user, {"slot": 0})
        self.assertEqual(status, 200)
        status, body = SERVER.handle_character_create(self.user, {"characterId": "lina"})
        self.assertEqual(status, 200)
        self.assertEqual(body["slot"], 0)

        new_lina = self.select(0)
        self.assertNotEqual(new_lina["characterRecordId"], old_record_id)
        self.assertEqual(new_lina["level"], 1)
        self.assertEqual(new_lina["mapId"], "ch1_m01_classroom_spawn")
        self.assertEqual(new_lina["spawnId"], "ch1_m01_spawn_player_start")
        self.assertEqual(new_lina["flags"], {})

        SERVER.save_profile(self.user, old_lina)
        self.assertEqual(self.select(0)["mapId"], "ch1_m01_classroom_spawn")

    def test_legacy_account_save_migrates_to_selected_character(self):
        legacy_db = Path(self.temp_dir.name) / "legacy.sqlite3"
        SERVER.DB_PATH = legacy_db
        profile = {
            "id": "u1",
            "account": "legacy",
            "name": "Legacy Lina",
            "characterId": "lina",
            "slot": 0,
            **SERVER.BASE_PROFILE,
            "level": 5,
            "exp": 420,
            "credits": 16,
            "mapId": "ch1_m04_library_lawn_boss",
            "spawnId": "ch1_m04_spawn_lawn_gate",
        }
        now = 1.0
        with closing(sqlite3.connect(legacy_db)) as conn:
            conn.executescript(
                """
                CREATE TABLE users (
                  id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE,
                  password_hash TEXT NOT NULL, salt TEXT NOT NULL, nickname TEXT NOT NULL,
                  character_id TEXT NOT NULL DEFAULT 'lina', created_at REAL NOT NULL,
                  updated_at REAL NOT NULL
                );
                CREATE TABLE saves (
                  user_id INTEGER PRIMARY KEY, profile_json TEXT NOT NULL, updated_at REAL NOT NULL
                );
                CREATE TABLE characters (
                  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, slot INTEGER NOT NULL,
                  character_id TEXT NOT NULL DEFAULT 'lina', name TEXT NOT NULL,
                  level INTEGER NOT NULL DEFAULT 1, exp INTEGER NOT NULL DEFAULT 0,
                  credits INTEGER NOT NULL DEFAULT 0, max_hp INTEGER NOT NULL DEFAULT 160,
                  hp INTEGER NOT NULL DEFAULT 160, created_at REAL NOT NULL, updated_at REAL NOT NULL,
                  UNIQUE(user_id, slot)
                );
                """
            )
            conn.execute(
                "INSERT INTO users VALUES (1, 'legacy', 'hash', 'salt', 'Legacy Lina', 'lina', ?, ?)",
                (now, now),
            )
            conn.execute(
                "INSERT INTO saves VALUES (1, ?, ?)",
                (json.dumps(profile), now),
            )
            conn.execute(
                "INSERT INTO characters VALUES (7, 1, 0, 'lina', 'Legacy Lina', 5, 420, 16, 160, 160, ?, ?)",
                (now, now),
            )
            conn.commit()

        SERVER.init_db()
        with SERVER.db() as conn:
            columns = {row["name"] for row in conn.execute("PRAGMA table_info(characters)")}
            migrated = conn.execute("SELECT profile_json FROM characters WHERE id = 7").fetchone()
        migrated_profile = json.loads(migrated["profile_json"])
        self.assertIn("profile_json", columns)
        self.assertEqual(migrated_profile["characterRecordId"], "7")
        self.assertEqual(migrated_profile["mapId"], "ch1_m04_library_lawn_boss")

    def test_legacy_fresh_character_with_advanced_map_resets_to_m01(self):
        legacy_db = Path(self.temp_dir.name) / "legacy-fresh.sqlite3"
        SERVER.DB_PATH = legacy_db
        profile = {
            "id": "u1",
            "account": "legacy_fresh",
            "name": "Fresh Lina",
            "characterId": "lina",
            "slot": 0,
            **SERVER.BASE_PROFILE,
            "mapId": "ch1_m04_library_lawn_boss",
            "spawnId": "ch1_m04_spawn_lawn_gate",
            "flags": {"ch1_final_boss_defeated": True},
        }
        now = 1.0
        with closing(sqlite3.connect(legacy_db)) as conn:
            conn.executescript(
                """
                CREATE TABLE users (
                  id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE,
                  password_hash TEXT NOT NULL, salt TEXT NOT NULL, nickname TEXT NOT NULL,
                  character_id TEXT NOT NULL DEFAULT 'lina', created_at REAL NOT NULL,
                  updated_at REAL NOT NULL
                );
                CREATE TABLE saves (
                  user_id INTEGER PRIMARY KEY, profile_json TEXT NOT NULL, updated_at REAL NOT NULL
                );
                CREATE TABLE characters (
                  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, slot INTEGER NOT NULL,
                  character_id TEXT NOT NULL DEFAULT 'lina', name TEXT NOT NULL,
                  level INTEGER NOT NULL DEFAULT 1, exp INTEGER NOT NULL DEFAULT 0,
                  credits INTEGER NOT NULL DEFAULT 0, max_hp INTEGER NOT NULL DEFAULT 160,
                  hp INTEGER NOT NULL DEFAULT 160, created_at REAL NOT NULL, updated_at REAL NOT NULL,
                  UNIQUE(user_id, slot)
                );
                """
            )
            conn.execute(
                "INSERT INTO users VALUES (1, 'legacy_fresh', 'hash', 'salt', 'Fresh Lina', 'lina', ?, ?)",
                (now, now),
            )
            conn.execute("INSERT INTO saves VALUES (1, ?, ?)", (json.dumps(profile), now))
            conn.execute(
                "INSERT INTO characters VALUES (8, 1, 0, 'lina', 'Fresh Lina', 1, 0, 0, 160, 160, ?, ?)",
                (now, now),
            )
            conn.commit()

        SERVER.init_db()
        with SERVER.db() as conn:
            row = conn.execute("SELECT profile_json FROM characters WHERE id = 8").fetchone()
        migrated_profile = json.loads(row["profile_json"])
        self.assertEqual(migrated_profile["mapId"], "ch1_m01_classroom_spawn")
        self.assertEqual(migrated_profile["spawnId"], "ch1_m01_spawn_player_start")
        self.assertEqual(migrated_profile["flags"], {})


if __name__ == "__main__":
    unittest.main()
