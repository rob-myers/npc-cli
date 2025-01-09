awaitWorld

w npc.updateLabels rob will kate # efficiency

# 🚧 introduce `spawn` command
w npc.spawn '{ npcKey: "rob", point: { x: 0.5 * 1.5, y: 5 * 1.5 + 0.2 }, angle: -1.5707963268 }' >/dev/null
w npc.spawn '{ npcKey: "will", point: { x: 2.5, y: 3 * 1.5 + 0.2 }, agent: true }' >/dev/null
w npc.spawn '{ npcKey: "kate", point: { x: 4.5 * 1.5, y: 7 * 1.5 }, agent: true }' >/dev/null

w n.rob.showSelector true
selectedNpcKey="rob"

w e.changeNpcAccess rob . +
# temp debug doors:
w e.changeNpcAccess will . +

# write selectedNpcKey on click npc
click | filter meta.npcKey | map '({ meta, keys }, { home, w }) => {
  w.n[home.selectedNpcKey]?.showSelector(false);
  w.n[meta.npcKey].showSelector(true);
  home.selectedNpcKey = meta.npcKey;
}' &

# open door on click
click | map '({meta}, {w}) => {
  meta.door && w.e.toggleDoor(meta.gdKey, {})
}' &

w | map 'w => w.e.pressMenuFilters.push(
  (meta) => meta.do === true || meta.floor === true
)'

click --long | map --forever 'async (input, {home, w}) => {
  const npc = w.n[home.selectedNpcKey];
  if (input.meta.floor === true && !npc.s.doMeta) npc.look(input);
  else await npc.do(input);
}' &

# click navmesh to move selectedNpcKey
click | filter meta.floor | map --forever '(input, { w, home }) => {
  const npc = w.n[home.selectedNpcKey];
  npc.s.run = input.keys?.includes("shift") ?? false;
  npc.moveTo(input).catch(() => {}); // can override
}' &

w update 'w => w.decor.showLabels = true'
w update 'w => w.view.targetFov = w.smallViewport ? 20 : 30'

setupContextMenu
events | handleContextMenu &
