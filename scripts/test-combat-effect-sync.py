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

    def test_enemy_skill_event_keeps_shared_telegraph_payload(self):
        SERVER.handle_combat_event(
            self.client,
            {
                "event": {
                    "action": "enemySkill",
                    "mapId": "ch1_m01_classroom_spawn",
                    "enemyId": "structural-boss",
                    "skillId": "shearCross",
                    "radius": 48,
                    "points": [
                        {"x": 640, "y": 720},
                        {"x": 940, "y": 720},
                    ],
                }
            },
        )
        event = self.broadcasts[-1][1]["event"]
        self.assertEqual(event["action"], "enemySkill")
        self.assertEqual(event["enemyId"], "structural-boss")
        self.assertEqual(event["skillId"], "shearCross")
        self.assertEqual(event["radius"], 48)
        self.assertEqual(len(event["points"]), 2)

    def test_player_status_event_keeps_exact_damage_and_shield_numbers(self):
        SERVER.handle_combat_event(
            self.client,
            {
                "event": {
                    "action": "playerStatus",
                    "mapId": "ch1_m01_classroom_spawn",
                    "x": 650,
                    "y": 730,
                    "damageAmount": 27,
                    "shieldSpent": 11,
                    "healAmount": 0,
                    "shieldGain": 0,
                    "down": False,
                }
            },
        )
        event = self.broadcasts[-1][1]["event"]
        self.assertEqual(event["damageAmount"], 27)
        self.assertEqual(event["shieldSpent"], 11)
        self.assertFalse(event["down"])

    def test_structural_boss_phase_events_keep_multiplayer_payload(self):
        SERVER.handle_combat_event(
            self.client,
            {
                "event": {
                    "action": "structuralBossDash",
                    "mapId": "ch1_m01_classroom_spawn",
                    "enemyId": "structural-final-boss",
                    "damage": 64,
                    "points": [{"x": 640, "y": 720}, {"x": 920, "y": 760}],
                }
            },
        )
        event = self.broadcasts[-1][1]["event"]
        self.assertEqual(event["action"], "structuralBossDash")
        self.assertEqual(event["damage"], 64)
        self.assertEqual(len(event["points"]), 2)

        SERVER.handle_enemy_state(
            self.client,
            {
                "enemy": {
                    "id": "structural-final-boss",
                    "mapId": "ch1_m01_classroom_spawn",
                    "state": "charging",
                    "bossForm": 2,
                    "bossPhase": "charging",
                    "bossCharger": False,
                    "hp": 1000,
                    "maxHp": 2000,
                }
            },
        )
        enemy = self.broadcasts[-1][1]["enemy"]
        self.assertEqual(enemy["bossPhase"], "charging")
        self.assertEqual(enemy["bossForm"], 2)
        self.assertFalse(enemy["bossCharger"])

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
            "physicalImpactBurst",
            "levelUp",
            "enemySkill",
            "structuralChargeAoe",
            "structuralSideLightning",
            "structuralBossDash",
            "structuralMarkedLightning",
            "playerStatus",
        ):
            self.assertIn(f'event.action === "{action}"', source, action)
        self.assertIn("playEnemyHitImpact(slime, critical, enemy.sourceCharacterId)", source)
        self.assertIn("this.playHealingChainCastBurst(previous.x, previous.y)", source)
        self.assertIn("const damageTaken = Math.max(0, previousHp - nextHp)", source)
        self.assertIn("const shieldSpent = Math.max(0, previousShield - nextShield)", source)
        self.assertIn("slime.body.pushable = false", source)
        self.assertIn("this.actorLeafSlimeCollider = null", source)
        self.assertIn("Players and enemies intentionally have no mutual physics contact", source)
        self.assertNotIn("this.physics.add.collider(this.actor, this.leafSlimes", source)
        self.assertNotIn("this.physics.add.overlap(\n        this.actor,\n        this.leafSlimes", source)
        self.assertIn("if (options.knockback && slime.rank !== \"boss\"", source)
        self.assertIn("if (projectile.knockbackForce > 0", source)
        self.assertIn("triggerProjectileImpactAoe(projectile, primaryTarget)", source)
        self.assertIn("createSwordWaveVisual(x, y, rotation, depth)", source)
        self.assertIn("setScale(0.66, 0.13)", source)
        self.assertIn("lineTo(146, 0)", source)
        self.assertIn("impactAoeRadius: JIANGXUN_BARRAGE_AOE_RADIUS", source)
        self.assertIn("impactAoeRadius: AYU_SWORD_WAVE_AOE_RADIUS", source)
        self.assertIn("allowComboHit: !!projectile.allowComboHit", source)
        self.assertIn("ZHIXIA_ULTIMATE_CHAIN_DURATION = 1500", source)
        self.assertIn("ZHIXIA_ULTIMATE_CHAIN_INTERVAL = 250", source)
        self.assertIn("ZHIXIA_ULTIMATE_CHAIN_HOP_INTERVAL = 42", source)
        self.assertIn("index * ZHIXIA_ULTIMATE_CHAIN_HOP_INTERVAL", source)
        self.assertIn("ZHIXIA_PROJECTILE_CAST_OFFSET = 86", source)
        self.assertIn("ZHIXIA_PROJECTILE_SPEED = 1080", source)
        self.assertIn("speed: ZHIXIA_PROJECTILE_SPEED", source)
        self.assertIn('app.profile.characterId === "zhixia"', source)
        self.assertIn("ZHIXIA_ULTIMATE_CHAIN_REFRACTIONS = 3", source)
        self.assertIn("startZhixiaUltimateAftershock(aftershockSeeds", source)
        self.assertIn("lightningChainPulse(pulseIndex = 0)", source)
        self.assertIn("beginStructuralBossChargingPhase(slime", source)
        self.assertIn("spawnStructuralBossChargers(slime)", source)
        self.assertIn("enterStructuralBossPhaseThree(slime", source)
        self.assertIn("STRUCTURAL_CHARGE_INTERVAL_MS = 10000", source)
        self.assertIn("STRUCTURAL_FIRE_PATH_DELAY_MS = 5000", source)
        self.assertIn("STRUCTURAL_PURSUIT_KNOCKBACK_DISTANCE = MAP_TILE_SIZE * 5", source)
        self.assertIn("STRUCTURAL_PHASE3_MARK_TELEGRAPH_MS = 2000", source)
        self.assertIn("recoverStructuralBossDash(slime)", source)
        self.assertNotIn("STRUCTURAL_PURSUIT_STUN_MS", source)

    def test_structural_marked_lightning_keeps_timeline_targets_and_chains(self):
        SERVER.handle_combat_event(
            self.client,
            {
                "event": {
                    "action": "structuralMarkedLightning",
                    "mapId": "ch1_m01_classroom_spawn",
                    "enemyId": "structural-final-boss",
                    "leadMs": 650,
                    "sequence": 7,
                    "targets": [
                        {"id": "ayu-player", "x": 640, "y": 720},
                        {"id": "lina-player", "x": 760, "y": 720},
                    ],
                    "chains": [
                        {
                            "sourceTargetId": "ayu-player",
                            "branch": 0,
                            "points": [
                                {"id": "lina-player", "x": 760, "y": 720},
                                {"id": "zhixia-player", "x": 870, "y": 730},
                            ],
                        }
                    ],
                }
            },
        )
        event = self.broadcasts[-1][1]["event"]
        self.assertEqual(event["action"], "structuralMarkedLightning")
        self.assertEqual(event["sequence"], 7)
        self.assertEqual(len(event["targets"]), 2)
        self.assertEqual(len(event["chains"]), 1)
        self.assertEqual(len(event["chains"][0]["points"]), 2)
        self.assertGreaterEqual(event["executeAt"] - event["createdAt"], 650)

    def test_m04_damage_is_merged_from_authoritative_hp(self):
        self.client.player["mapId"] = SERVER.M04_MAP_ID
        room = SERVER.get_room(self.client.room_name)
        room["m04"].update({"active": True, "leaderId": "another-player"})
        room["slimes"]["structural-final-boss"] = {
            "id": "structural-final-boss",
            "mapId": SERVER.M04_MAP_ID,
            "hp": 100,
            "maxHp": 100,
        }
        for incoming_hp, damage, expected_hp in ((70, 30, 70), (50, 20, 50)):
            SERVER.handle_enemy_state(
                self.client,
                {
                    "enemy": {
                        "id": "structural-final-boss",
                        "mapId": SERVER.M04_MAP_ID,
                        "state": "visualHit",
                        "bossPhase": "phase2Combat",
                        "hp": incoming_hp,
                        "maxHp": 100,
                        "damageAmount": damage,
                    }
                },
            )
            self.assertEqual(self.broadcasts[-1][1]["enemy"]["hp"], expected_hp)
        broadcast_count = len(self.broadcasts)
        SERVER.handle_enemy_state(
            self.client,
            {
                "enemy": {
                    "id": "structural-final-boss",
                    "mapId": SERVER.M04_MAP_ID,
                    "state": "phase3",
                    "bossPhase": "phase3",
                    "hp": 100,
                    "maxHp": 100,
                }
            },
        )
        self.assertEqual(len(self.broadcasts), broadcast_count, "non-leader cannot advance boss phases")

    def test_m04_leader_batch_keeps_enemy_motion_together(self):
        self.client.player["mapId"] = SERVER.M04_MAP_ID
        room = SERVER.get_room(self.client.room_name)
        room["m04"].update({"active": True, "leaderId": self.client.id})
        room["slimes"]["structural-final-boss"] = {
            "id": "structural-final-boss",
            "mapId": SERVER.M04_MAP_ID,
            "x": 100,
            "y": 100,
            "hp": 100,
            "maxHp": 100,
        }
        SERVER.handle_enemy_batch(
            self.client,
            {
                "mapId": SERVER.M04_MAP_ID,
                "enemies": [{
                    "id": "structural-final-boss",
                    "x": 340,
                    "y": 520,
                    "hp": 88,
                    "maxHp": 100,
                    "state": "move",
                    "bossPhase": "phase2Combat",
                    "bossForm": 2,
                    "flipX": True,
                }],
            },
        )
        payload = self.broadcasts[-1][1]
        self.assertEqual(payload["type"], "enemyBatch")
        self.assertEqual(payload["enemies"][0]["x"], 340)
        self.assertEqual(payload["enemies"][0]["bossPhase"], "phase2Combat")
        self.assertEqual(room["slimes"]["structural-final-boss"]["hp"], 88)

    def test_secondary_explosion_and_chain_metadata_are_forwarded(self):
        for event in (
            {
                "action": "physicalImpactBurst",
                "mapId": "ch1_m01_classroom_spawn",
                "x": 720,
                "y": 735,
                "radius": 84,
                "color": 0xF0BB62,
                "comboIndex": 2,
            },
            {
                "action": "chainLightning",
                "mapId": "ch1_m01_classroom_spawn",
                "secondary": True,
                "pulse": 4,
                "points": [
                    {"x": 720, "y": 735},
                    {"x": 780, "y": 720},
                    {"x": 840, "y": 742},
                    {"x": 900, "y": 710},
                    {"x": 960, "y": 735},
                ],
            },
        ):
            SERVER.handle_combat_event(self.client, {"event": event})
        burst = self.broadcasts[-2][1]["event"]
        chain = self.broadcasts[-1][1]["event"]
        self.assertEqual(burst["radius"], 84)
        self.assertEqual(burst["comboIndex"], 2)
        self.assertTrue(chain["secondary"])
        self.assertEqual(chain["pulse"], 4)
        self.assertEqual(len(chain["points"]), 5)


if __name__ == "__main__":
    unittest.main()
