awaitWorld

# open door on click
click | filter meta.door | map '({meta},{w}) => {
  w.door.toggleDoor(meta.instanceId)
}' &

# write selectedNpcKey on click npc
click | filter meta.npcKey |
  map '({meta},{home}) => {
    home.selectedNpcKey = meta.npcKey
  }' &

# click navmesh to move selectedNpcKey
# see `declare -f walkTest`
click | filter meta.navigable | walkTest &

# 🚧 clean
setupDemo1

# 🚧 introduce `spawn` command
w npc.spawn '{ npcKey: "kate", point: { x: 5 * 1.5, y: 0, z: 7 * 1.5 }, agent: true }' >/dev/null
w npc.spawn '{ npcKey: "will", point: { x: 2.5, y: 0, z: 3 * 1.5 }, agent: true }' >/dev/null
w npc.spawn '{ npcKey: "rob", point: { x: 1 * 1.5, y: 0, z: 5 * 1.5 }, agent: true }'  >/dev/null

selectedNpcKey="rob"
