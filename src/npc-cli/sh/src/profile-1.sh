awaitWorld

setupDemo1

api npc.spawn '{ npcKey: "kate", point: { x: 5 * 1.5, y: 0, z: 7 * 1.5 }, agent: true }' >/dev/null
api npc.spawn '{ npcKey: "will", point: { x: 2.5, y: 0, z: 3 * 1.5 }, agent: true }' >/dev/null
api npc.spawn '{ npcKey: "rob", point: { x: 1 * 1.5, y: 0, z: 5 * 1.5 }, agent: true }'  >/dev/null

api '({ npc }) => { npc.select.curr = "rob" }'
