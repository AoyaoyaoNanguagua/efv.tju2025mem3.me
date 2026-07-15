import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("efv_play_server_m04_session", ROOT / "play-server.py")
SERVER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SERVER)


def player(player_id: str, map_id: str, flags=None) -> dict:
    return {
        "id": player_id,
        "name": f"Player {player_id}",
        "characterId": "lina",
        "mapId": map_id,
        "x": 640,
        "y": 720,
        "flags": list(flags or []),
    }


class M04SessionTests(unittest.TestCase):
    def setUp(self):
        SERVER.rooms.clear()
        self.room = SERVER.get_room("m04-session-test")

    def tearDown(self):
        SERVER.rooms.clear()

    def update_player(self, player_id: str, next_player: dict, previous_map_id: str = ""):
        self.room["peers"][player_id] = next_player
        return SERVER.update_m04_session_locked(self.room, player_id, next_player, previous_map_id)

    def test_first_entry_remains_leader_until_everyone_leaves(self):
        first = player("first", SERVER.M04_MAP_ID, ["ch1_m03_small_boss_cleared"])
        changed, reset = self.update_player("first", first)
        self.assertTrue(changed)
        self.assertTrue(reset)
        self.assertEqual(self.room["m04"]["leaderId"], "first")

        second = player("second", SERVER.M04_MAP_ID, ["ch1_complete"])
        changed, reset = self.update_player("second", second)
        self.assertFalse(changed)
        self.assertFalse(reset)
        self.assertEqual(self.room["m04"]["leaderId"], "first")
        self.assertNotIn("ch1_complete", self.room["m04"]["flags"])

        first_out = player("first", "ch1_m03_agent_lab")
        changed, reset = self.update_player("first", first_out, SERVER.M04_MAP_ID)
        self.assertFalse(changed)
        self.assertFalse(reset)
        self.assertTrue(self.room["m04"]["active"])
        self.assertEqual(self.room["m04"]["leaderId"], "first")

        second_out = player("second", "ch1_m03_agent_lab")
        changed, reset = self.update_player("second", second_out, SERVER.M04_MAP_ID)
        self.assertTrue(changed)
        self.assertTrue(reset)
        self.assertFalse(self.room["m04"]["active"])

    def test_new_session_uses_new_first_players_flags(self):
        first = player("first", SERVER.M04_MAP_ID, ["ch1_m03_small_boss_cleared"])
        self.update_player("first", first)
        first_out = player("first", "ch1_m03_agent_lab")
        self.update_player("first", first_out, SERVER.M04_MAP_ID)

        newcomer = player("new", SERVER.M04_MAP_ID, ["ch1_complete", "ch1_final_boss_defeated"])
        self.update_player("new", newcomer)
        session = SERVER.m04_session_payload(self.room)
        self.assertEqual(session["leaderId"], "new")
        self.assertIn("ch1_complete", session["flags"])
        self.assertIn("ch1_final_boss_defeated", session["flags"])


if __name__ == "__main__":
    unittest.main()
