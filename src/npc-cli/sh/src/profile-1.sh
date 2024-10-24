awaitWorld

# 🚧 introduce `spawn` command
w npc.spawn '{ npcKey: "rob", point: { x: 0.5 * 1.5, y: 5 * 1.5 }, angle: -1.5707963268 }'  >/dev/null
w npc.spawn '{ npcKey: "will", point: { x: 2.5, y: 3 * 1.5 }, agent: true }' >/dev/null
w npc.spawn '{ npcKey: "kate", point: { x: 4.5 * 1.5, y: 7 * 1.5 }, agent: true }' >/dev/null

selectedNpcKey="rob"
w npc.npc.rob.showSelector true
w npc.npc.rob.setLabel Robbo
w e.changeNpcAccess rob . +

# write selectedNpcKey on click npc
# click | map meta.npcKey >selectedNpcKey &
click | filter meta.npcKey | map '({ meta }, { home, w }) => {
  w.npc.npc[home.selectedNpcKey]?.showSelector(false);
  w.npc.npc[meta.npcKey]?.showSelector(true);
  home.selectedNpcKey = meta.npcKey;
}' &

# open door on click
# 🚧 use switch instead of door
click | map '({meta}, {w}) => {
  meta.door && w.e.toggleDoor(meta.gdKey)
}' &

# call '({w}) => w.e.shouldIgnoreLongClick = (meta) => meta.do || meta.floor'
w | map 'w => (w.e.shouldIgnoreLongClick = (meta) => meta.do || meta.floor)'

# click --long | run '({ api, home, w, datum }) {
#   while ((datum = await api.read()) !== api.eof) {
#     const npc = w.npc.npc[home.selectedNpcKey];
#     await npc.do(datum).catch(() => {});
#   }
# }' &
click --long | while take 1 >lastClick; do
  w npc.npc.${selectedNpcKey} | map '(npc, {home}) => npc.do(home.lastClick)'
done &

# click navmesh to move selectedNpcKey
# click | filter meta.nav | walkTest &
click | filter meta.nav | map --forever '(input, { w, home }) => {
  const npc = w.npc.npc[home.selectedNpcKey];
  npc.s.run = input.keys?.includes("shift") ?? false;
  npc.moveTo(input).catch(() => {}); // can override
}' &

w update 'w => w.decor.showLabels = true'
w update 'w => w.ui.targetFov = 20'
