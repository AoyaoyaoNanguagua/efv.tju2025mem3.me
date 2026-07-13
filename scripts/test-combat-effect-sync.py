import importlib.util
import unittest
from pathlib import Path
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("efv_play_server_combat_sync", ROOT / "play-server.py")
SERVER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SERVER)


class CombatEffectSyncTests(unittest.TestCase):
    def setUp(self):
        SERVER.rooms.clear()
        self.broadcasts = []
        self.original_broadcast = SERVER.broadcast
        SERVER.broadcast = lambda room, payload, except_client=None: self.broadcasts.append(
            (room, payload, except_client)
        )
        self.client = SimpleNamespace(
            user_id=1,
            room_name="combat-effect-sync-test",
            id="ayu-player",
            player={
                "id": "ayu-player",
                "name": "Player A",
                "characterId": "ayu",
                "mapId": "ch1_m01_classroom_spawn",
                "x": 640,
                "y": 720,
                "level": 4,
            },
        )

    def tearDown(self):
        SERVER.broadcast = self.original_broadcast
        SERVER.rooms.clear()

    def test_level_up_event_keeps_visual_payload(self):
        SERVER.handle_combat_event(
            self.client,
            {
                "event": {
                    "action": "levelUp",
                    "mapId": "ch1_m01_classroom_spawn",
                    "x": 650,
                    "y": 730,
                    "level": 5,
                    "levels": 1,
                }
            },
        )
        event = self.broadcasts[-1][1]["event"]
        self.assertEqual(event["action"], "levelUp")
        self.assertEqual(event["level"], 5)
        self.assertEqual(event["levels"], 1)
        self.assertEqual(event["characterId"], "ayu")

    def test_enemy_hit_broadcast_keeps_damage_particles_metadata(self):
        SERVER.handle_enemy_state(
            self.client,
            {
                "enemy": {
                    "id": "combat-sync-slime",
                    "mapId": "ch1_m01_classroom_spawn",
                    "x": 710,
                    "y": 740,
                    "hp": 41,
                    "maxHp": 72,
                    "state": "hit",
                    "damageAmount": 31,
                    "critical": True,
                    "hitKind": "physical",
                    "energyGained": 6,
                }
            },
        )
        enemy = self.broadcasts[-1][1]["enemy"]
        self.assertEqual(enemy["damageAmount"], 31)
        self.assertTrue(enemy["critical"])
        self.assertEqual(enemy["hitKind"], "physical")
        self.assertEqual(enemy["energyGained"], 6)
        self.assertEqual(enemy["sourceCharacterId"], "ayu")

    def test_client_has_remote_replay_paths_for_every_combat_visual(self):
        source = (ROOT / "play.js").read_text(encoding="utf-8")
        for action in (
            "projectile",
            "melee",
            "linaGale",
            "chainLightning",
            "zhixiaUltimate",
            "berserk",
            "laodengShockwave",
            "laodengFireExplosion",
            "levelUp",
        ):
            self.assertIn(f'event.action === "{action}"', source, action)
        self.assertIn("playEnemyHitImpact(slime, critical, enemy.sourceCharacterId)", source)
        self.assertIn("this.playHealingChainCastBurst(previous.x, previous.y)", source)
        self.assertIn("const damageTaken = Math.max(0, previousHp - nextHp)", source)
        self.assertIn("const shieldSpent = Math.max(0, previousShield - nextShield)", source)


if __name__ == "__main__":
    unittest.main()
