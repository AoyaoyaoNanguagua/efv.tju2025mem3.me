(function () {
  "use strict";

  const studentId = "2025000000";
  const pack = {
    studentId,
    id: `s${studentId}_demo_pack`,
    title: "示例关卡包",
    type: "level-pack",
    version: "0.1.0",
    entry: `${studentId}-level.js`,
    zone: "zhonghe-plaza",
    assets: {
      sprites: [],
      portraits: [],
      tilesets: [],
      props: [],
      enemies: [],
      npc: []
    },
    data: {
      manifest: "data/manifest.json",
      points: "data/points.json",
      triggers: "data/triggers.json"
    },
    getOfficialCharacter() {
      return window.EFVOfficial?.getMainCharacter?.() || null;
    }
  };

  window.EFVContrib?.register(pack);
})();
