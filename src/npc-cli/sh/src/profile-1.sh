awaitWorld

# open door on click
click | map '({meta}, {w}) => {
  meta.door && w.s.toggle({ type: "door", gdKey: meta.gdKey })
}' &

# write selectedNpcKey on click npc
click | map meta.npcKey >selectedNpcKey &

# click navmesh to move selectedNpcKey
# see `declare -f walkTest`
click | filter meta.navigable | walkTest &

# 🚧 clean
setupDemo1

# 🚧 introduce `spawn` command
w npc.spawn '{ npcKey: "kate", point: { x: 4.5 * 1.5, y: 0, z: 7 * 1.5 }, agent: true }' >/dev/null
w npc.spawn '{ npcKey: "will", point: { x: 2.5, y: 0, z: 3 * 1.5 }, agent: true }' >/dev/null
w npc.spawn '{ npcKey: "rob", point: { x: 0.5 * 1.5, y: 0, z: 5 * 1.5 }, agent: true }'  >/dev/null

selectedNpcKey="rob"

w update 'w => w.decor.showLabels = true'
