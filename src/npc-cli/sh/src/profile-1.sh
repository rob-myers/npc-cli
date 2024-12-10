awaitWorld

# 🚧 introduce `spawn` command
w npc.spawn '{ npcKey: "rob", point: { x: 0.5 * 1.5, y: 5 * 1.5 }, angle: -1.5707963268 }'  >/dev/null
w npc.spawn '{ npcKey: "will", point: { x: 2.5, y: 3 * 1.5 }, agent: true }' >/dev/null
w npc.spawn '{ npcKey: "kate", point: { x: 4.5 * 1.5, y: 7 * 1.5 }, agent: true }' >/dev/null

selectedNpcKey="rob"
w n.rob.showSelector true
w n.rob.setLabel Robbo
w e.changeNpcAccess rob . +

# write selectedNpcKey on click npc
click | filter meta.npcKey | map '({ meta }, { home, w }) => {
  w.n[home.selectedNpcKey]?.showSelector(false);
  w.n[meta.npcKey]?.showSelector(true);
  home.selectedNpcKey = meta.npcKey;
}' &

# open door on click
click | map '({meta}, {w}) => {
  meta.door && w.e.toggleDoor(meta.gdKey, {})
}' &

w | map 'w => w.e.pressMenuFilters.push( (meta) => meta.do || meta.floor )'

click --long | map --forever 'async (x, {home, w}) => {
  const npc = w.n[home.selectedNpcKey];
  if (x.meta.floor === true && !npc.s.doMeta) npc.look(x);
  else await npc.do(x);
}' &

# click navmesh to move selectedNpcKey
click | filter meta.floor | map --forever '(input, { w, home }) => {
  const npc = w.n[home.selectedNpcKey];
  npc.s.run = input.keys?.includes("shift") ?? false;
  npc.moveTo(input).catch(() => {}); // can override
}' &

w update 'w => w.decor.showLabels = true'
w update 'w => w.view.targetFov = w.lib.isSmallViewport() ? 20 : 30'
