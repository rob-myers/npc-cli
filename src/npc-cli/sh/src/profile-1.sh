awaitWorld

# open door on click
click | map '({meta}, {w}) => {
  meta.door && w.e.toggleDoor(meta.gdKey)
}' &

# 🚧 maybe can cover door and move
# 🚧 maybe cover click switch instead of door
# click | filter 'x => x.meta.door || x.meta.do'

# write selectedNpcKey on click npc
# click | map meta.npcKey >selectedNpcKey &
click | map '({ meta }, { home, w }) => {
  if (meta.npcKey) {
    w.npc.npc[home.selectedNpcKey]?.showSelector(false);
    w.npc.npc[meta.npcKey]?.showSelector(true);
    home.selectedNpcKey = meta.npcKey;
  }
}' &

# click navmesh to move selectedNpcKey
# see `declare -f walkTest`
# click | filter meta.navigable | walkTest &
click | filter meta.floor | walkTest &

# 🚧 clean
setupDemo1

# 🚧 introduce `spawn` command
w npc.spawn '{ npcKey: "kate", point: { x: 4.5 * 1.5, y: 7 * 1.5 }, agent: true }'
w npc.spawn '{ npcKey: "will", point: { x: 2.5, y: 3 * 1.5 }, agent: true }' >/dev/null
w npc.spawn '{ npcKey: "rob", point: { x: 0.5 * 1.5, y: 5 * 1.5 }, agent: true }'  >/dev/null

w e.changeNpcAccess rob . +

selectedNpcKey="rob"
w npc.npc.rob.showSelector true
w npc.npc.rob.setLabel Robbo

w update 'w => w.decor.showLabels = true'
