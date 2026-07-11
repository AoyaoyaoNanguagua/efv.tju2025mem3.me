import importlib.util
import unittest
from pathlib import Path
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("efv_play_server", ROOT / "play-server.py")
SERVER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SERVER)


class WorldDropTests(unittest.TestCase):
    def setUp(self):
        SERVER.rooms.clear()
        self.sent = []
        self.broadcasts = []
        self.original_send = SERVER.send_ws
        self.original_broadcast = SERVER.broadcast
        SERVER.send_ws = lambda client, payload: self.sent.append((client.id, payload))
        SERVER.broadcast = lambda room, payload, except_client=None: self.broadcasts.append((room, payload))
        self.owner = SimpleNamespace(
            user_id=1,
            room_name="drop-test",
            id="owner-character",
            player={"name": "Owner", "x": 100, "y": 120},
        )

    def tearDown(self):
        SERVER.send_ws = self.original_send
        SERVER.broadcast = self.original_broadcast
        SERVER.rooms.clear()

    def spawn_drop(self):
        SERVER.handle_drop_spawn(self.owner, {
            "drop": {
                "id": "drop-test-1",
                "mapId": "ch1_m01_classroom_spawn",
                "x": 110,
                "y": 130,
                "item": {"id": "ch1_boost_academic_bookmark", "source": "monster"},
            }
        })
        return SERVER.get_room("drop-test")["drops"]["drop-test-1"]

    def test_drop_is_server_owned_and_only_owner_can_collect(self):
        drop = self.spawn_drop()
        self.assertEqual(drop["ownerId"], self.owner.id)
        self.assertEqual(drop["item"]["damageBonus"], 0.05)
        self.assertEqual(drop["expiresAt"] - drop["createdAt"], SERVER.DROP_TTL_MS)

        other = SimpleNamespace(
            user_id=2,
            room_name="drop-test",
            id="other-character",
            player={"name": "Other", "x": 110, "y": 130},
        )
        SERVER.handle_drop_collect(other, {"id": drop["id"]})
        self.assertIn(drop["id"], SERVER.get_room("drop-test")["drops"])
        self.assertEqual(self.sent[-1][1]["type"], "dropError")

        SERVER.handle_drop_collect(self.owner, {"id": drop["id"]})
        self.assertNotIn(drop["id"], SERVER.get_room("drop-test")["drops"])
        self.assertEqual(self.sent[-1][1]["type"], "dropCollected")
        self.assertEqual(self.broadcasts[-1][1], {"type": "dropRemove", "id": drop["id"]})

    def test_unknown_item_is_rejected(self):
        SERVER.handle_drop_spawn(self.owner, {
            "drop": {"id": "bad", "item": {"id": "not-in-catalog"}}
        })
        self.assertEqual(SERVER.get_room("drop-test")["drops"], {})
        self.assertEqual(self.sent[-1][1]["type"], "dropError")

    def test_garden_boss_drop_is_whitelisted(self):
        SERVER.handle_drop_spawn(self.owner, {
            "drop": {
                "id": "garden-boss-drop",
                "mapId": "ch1_m03_agent_lab",
                "x": 120,
                "y": 140,
                "item": {"id": "ch1_drop_carnivora_core", "source": "garden_boss"},
            }
        })
        drop = SERVER.get_room("drop-test")["drops"]["garden-boss-drop"]
        self.assertEqual(drop["item"]["name"], "食人花院核")
        self.assertEqual(drop["item"]["quality"], "epic")


if __name__ == "__main__":
    unittest.main()
