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

click --long | map --forever 'async (x, {home, w}) => {
  const npc = w.npc.npc[home.selectedNpcKey];
  if (x.meta.floor === true && !npc.s.doMeta) npc.look(x);
  else await npc.do(x);
}' &

# click navmesh to move selectedNpcKey
click | filter meta.floor | map --forever '(input, { w, home }) => {
  const npc = w.npc.npc[home.selectedNpcKey];
  npc.s.run = input.keys?.includes("shift") ?? false;
  npc.moveTo(input).catch(() => {}); // can override
}' &

w update 'w => {
  w.e.pressMenuFilters.push((meta) => meta.do || meta.floor);
  w.decor.showLabels = true;
  w.view.targetFov = 20;
}'
