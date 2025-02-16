awaitWorld

w npc.updateLabels rob will kate # efficiency

spawn rob '{ x: 0.5 * 1.5, y: 5 * 1.5 + 0.2 }'
spawn will '{ x: 2.5, y: 3 * 1.5 + 0.2 }'
spawn '{ npcKey: "kate", angle: -Math.PI/2 }' '{ x: 4.5 * 1.5, y: 7 * 1.5 }'

w n.rob.showSelector true
selectedNpcKey="rob"

w e.grantNpcAccess rob .
# temp debug doors:
w e.grantNpcAccess will .

# write selectedNpcKey on click npc
ptags=no-pause; click | filter meta.npcKey | map '({ meta, keys }, { home, w }) => {
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
ptags=no-pause; click | filter meta.floor | map --forever '(input, { w, home }) => {
  const npc = w.n[home.selectedNpcKey];
  npc.s.run = input.keys?.includes("shift") ?? false;
  npc.moveTo(input).catch(() => {}); // can override
}' &

w update 'w => w.decor.showLabels = true'
w update 'w => w.view.targetFov = w.smallViewport ? 20 : 20'

setupContextMenu
ptags=no-pause; events | handleContextMenu &

ptags=no-pause; events | handleLoggerLinks & 

setupOnSlowNpc
