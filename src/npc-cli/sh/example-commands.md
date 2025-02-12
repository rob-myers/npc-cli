# Examples of commands

🚧 needs a clean!
🚧 e.g. separate abstract tty vs npc


```sh
# directly invoking native functions
echo foo >bar
bar
# foo
bar | keysAll
# ["length","constructor","anchor","at","big","blink","bold","charAt","charCodeAt","codePointAt","concat","endsWith","fontcolor","fontsize","fixed","includes","indexOf","isWellFormed","italics","lastIndexOf","link","localeCompare","match","matchAll","normalize","padEnd","padStart","repeat","replace","replaceAll","search","slice","small","split","strike","sub","substr","substring","sup","startsWith","toString","toWellFormed","trim","trimStart","trimLeft","trimEnd","trimRight","toLocaleLowerCase","toLocaleUpperCase","toLowerCase","toUpperCase","valueOf","name","prototype","fromCharCode","fromCodePoint","raw","0","1","2"]
bar/charAt'(0)'
# f
bar/toUpperCase'()'
# FOO

# wc -l is `reduce '(sum, x) => sum + 1' 0` e.g.
w gms | split | flatMap 'x => x.rooms' | reduce '(sum, x) => sum + 1' 0

# join together some strings
{ echo foo; echo bar; echo baz; } | reduce '(agg, item) => agg + "\n" + item'
# split a file into lines and count each length
PROFILE | split '/\n/' | map length

# can use `take` like `read`
seq 5 | while take 1 >foo; do foo; done

# then copy paste as location in e.g. chrome
w decor.label.tex.image.toDataURL | log
# likewise
w npc.updateLabels '["foo", "bar", "baz qux"]'
w npc.label.tex.image.toDataURL | log

w debug.npc.add $( click 1 ) foo cuboid-man

while true; do
  w debug.npc.add $( click 1 )
done

w decor.byRoom.0.2 | split | filter /collider/


w debug.npc.remove
w debug.npc.add $( click 1 )
w debug.npc.npc.npc-0.act.Idle.stop
w debug.npc.npc.npc-0.act.Idle.play
w debug.npc.npc.npc-0.act.Idle.fadeOut 1
w debug.npc.npc.npc-0.act.Idle.reset
w debug.npc.npc.npc-0.act.Walk.fadeIn 0.5
w debug.npc.npc.npc-0.act.Walk.play
w debug.npc.npc.npc-0.mixer | map 'm => m.timeScale = 0.5'

w debug.npc.npc.npc-0.act.Walk.reset
w debug.npc.npc.npc-0.act.Walk.fadeIn 0.5
w debug.npc.npc.npc-0.act.Walk.play

w debug.npc.npc.npc-0 > npc
# npc/act/Idle/stop'()'
npc | map act.Idle.stop
npc | map act.Idle.reset
npc | map act.Idle.fadeOut 1
npc | map 'x => x.mixer.timeScale = 0.6'

# change fov
w update 'w => w.r3f.camera.fov = 30'
w update 'w => w.r3f.camera.fov = 15'

numPets=0
while true; do 
  # better increment? we intentionally lack shell arithmetic operators
  call '({ home }) => home.numPets++'
  w debug.npc.add $( click 1 ) pet-${numPets} cuboid-pet
done

 w n.rob.position | map '(input, { w }) => w.r3f.camera.position.distanceTo(input)'
```

```sh
expr 'new Set([1, 2, 3])' | map Array.from
```

```sh
w decor.byKey | map Object.values | split | take 1
w decor.byKey | map 'x => Object.values(x)[0]' | pretty
w decor.byKey | map Object.values | map length

w decor.rmInstantiatedDecor 1
w decor.updateInstanceLists

d=0
test $( call 'x => x.home.d === 0' )
# exit code 0

# example of bounded loop
seq 29 | map '(x, {w}) => w.c.say(`rob_${x}`, "yoyoyoy")'

w npc.remove rob_{0..10}
```

```sh
# inspecting a function
w door | map 'x => x.npcNearDoor' | pretty

# log a "chunk"
seq 100000 | log

events
events | map key

call '() => { throw Error("bad") }'

{
  call '() => { throw "❌" }' | true
  true | { sleep 1; echo 🔔; }
}

w gmsData.g-102--research-deck.hitCtxt.canvas.toDataURL | log

# log events with timestamp
events | flatMap 'x => [new Date().toGMTString(), x]'

# unlock/lock specific door
w es.toggleLock g0d16

# 🔔 Function('return 09') is 9, so if
# 🔔 an npc was named "09" we'd have to:
w npc.remove '"09"'

w physics.worker.postMessage '{ type: "get-debug-data" }'

w npc.npc.rob.look Math.PI/2
w npc.npc.rob.look -Math.PI/2 # ❌

w n.rob.agent.parameters
w n.rob.agent.parameters | map updateFlags

# also supported whilst paused
w npc.spawn '{ npcKey: "rob", point: '$( click 1 )' }' >/dev/null
```

```sh
# two agents "rob" and "will" in untransformed 301
# assume npc.s.run is false for both

p=$( expr '{"x":1.703,"y":0,"z":3.672,"meta":{"picked":"floor","gmId":0,"floor":true,"instanceId":0,"roomId":1,"grKey":"g0r1","nav":true},"xz":{"x":1.703,"y":3.672}}' )
q=$( expr '{x:2.298,y:0,z:3.315,meta:{picked:"floor",gmId:0,floor:true,instanceId:0,roomId:1,grKey:"g0r1",nav:true},xz:{x:2.298,y:3.315}}' )
r=$( expr '{x:1.666,y:0,z:6.581,meta:{picked:"floor",gmId:0,floor:true,instanceId:0,roomId:2,grKey:"g0r2",nav:true},xz:{x:1.666,y:6.581}}' )
s=$( expr '{x:3.36,y:0,z:7.882,meta:{picked:"floor",gmId:0,floor:true,instanceId:0,roomId:2,grKey:"g0r2",nav:true},xz:{x:3.36,y:7.882}}' )

# one
w n.rob.moveTo ${p} & w n.will.moveTo ${q} &
# two
w n.rob.moveTo ${r} & w n.will.moveTo ${s} &

# sometimes 2nd agent gets blocked, but usually not because
# pushed out of the way before starts offMeshConnection

w npc.onSlowNpcCustom.toString
```

## Local variables

```sh
( local y; y=42; echo $y )
( local y; y='{ foo: 42 }'; y/foo )
```

## if then elif else

```sh
if true; then echo foo; else echo bar; fi
if false; then echo foo; else echo bar; fi
if false; then echo foo; elif true; then echo bar; else echo baz; fi
if false; then echo foo; elif false; then echo bar; else echo baz; fi

# using builtin `test`
if test '1 > 2'; then echo TEST PASSED; else echo TEST FAILED; fi
if test '2 > 1'; then echo TEST PASSED; else echo TEST FAILED; fi
```

## Pipe semantics

pipe-child termination info

```sh
# `foo`
echo foo | map 'x => x'
# `3`, `3`
{ echo foo; echo bar; } | map length
# [3,3]
{ echo foo | map length; } | map 'x => [x,x]'
# `0`, `1`, `2`, `3`, `4`
seq 10 | take 5
# if type foo⏎ then `102`, `111`, `111`
split | map charCodeAt 0
# ctrl-c should exit early
# exit code 130 on ctrl-c
echo foo | sleep 10
# `foo` then terminates immediately
sleep 10 | echo foo
# `foo` (pause) `bar` then hangs (can ctrl-c)
{ echo foo; echo bar; } | while true; do take 1; sleep 2; done
# hi rob
echo hi $( echo rob | take 1 )
# `1`
false; echo ${?}
# `1`
( false; echo ${?} )
# `1`
echo | false; echo $?
# `1` `0`
{ false; echo ${?}; } & sleep 1; echo $?
# take 3 terminates immediately
take 3 | true
# should output `hi`
echo hi $( echo rob | false )
# should output `hi`
echo hi $( echo rob | true )
# should output `hello` continually
while true; do echo | false; echo hello; done
# terminates because first pipe-child killed
# exit code 130
run '({ api }) { throw api.getKillError(); }' | take 1
# terminates because last pipe-child killed
# exit code 130
take 1 | run '({ api }) { throw api.getKillError(); }'
# ctrl-c should kill whole while loop
awaitWorld
while true; do click 1 >clicked; clicked/meta/nav; done
```

## Invoke JS function

```sh
call '({ home }) => { home.func = () => console.log("wow") }'
# we cannot simply `func()` because collides with shell function syntax
func'()'
```

```sh
call '() => "foo\nbar\nbaz"'
```

```sh
$ run '({ api, home }) {  await new Promise(resolve => { api.addCleanup(home.resolve = resolve); }); yield "done"; }' &
$ ps
pid   ppid  pgid
0     0     0    ▶️  ps
12    0     12   ▶️  run '({ api, home }) {  await  ...
$ resolve'()'
done
```

## Builtins

```sh
echo 'echo hello $@' >foo
source foo rob m
```

## History

```sh
history | filter 'x => /zhodani/.test(x)'
history | filter 'x => /nav/.test(x)'
```

## NPC

```sh
w decor.decor.door-g0r0-0
npc decor | map 0

npc cfg '{ colliders: true }'

npc decor '{ key: "foo", type: "circle", center: {"x":207,"y":384}, radius: 30 }'
npc decor foo
echo foo | npc decor
npc decor '{ key: "bar", type: "rect", "x":207,"y":384,"width":100,"height":50 }'
npc rm-decor foo bar

npc decor '{ key: "foo", type: "point", ...'$( click 1 )', tags:["decor"] }'
npc rm-decor foo

npc decor '{ key: "foo", type: "circle", center: '$( click 1 )', radius: 60 }'
npc rm-decor foo

nav $( click 2 ) >navPath # then click twice
w debug.addNavPath foo ${navPath} && w debug.render
```

```sh
view '{ point:'$( click 1 )', ms: 2000, zoom: 2 }'
view 2 "$( click 1 )" 2
```

```sh
spawn rob $( click 1 )
npc rob lookAt $( click 1 )
click | npc rob lookAt
click | npc rob lookAt - {ms:500}
click | lookAt rob
```

```sh
# spawn close to stand/sit point
spawn rob $( click 1 )
npc set-player rob
npc events |
  filter '({ key, decor }) =>
    key === "decor-click" && (decor.meta.stand || decor.meta.sit)' |
  filter '(e, { api, home }) => {
    const { npcs } = api.getCached(home.WORLD_KEY);
    const player = npcs.getPlayer();
    return player?.getPosition().distanceTo(e.decor) <= player?.getInteractRadius();
  }'
```

```sh
spawn rob $( click 1 )
npc rob >me
me/animateRotate'(0.5, 0)'
npc rob animateRotate -0.5 0
me/animateOpacity'(0.5, 0)'
npc rob animateOpacity 0.5 1000
```

```sh
click | npc rob fadeSpawn
```

```sh
spawn rob $( click 1 ) --zhodani
npc rob do $( click 1 )
click | npc rob do

# foo close door at
npc rob do "$( click 1 )" '{ extraParams: [0] }'
# foo open door at
npc rob do "$( click 1 )" '{ extraParams: [1] }'

{ echo foo; echo bar; echo baz; } |
  map 'async (input, {api}) => { await new Promise(r => setTimeout(r, 1000)); return input }'
```


```sh
spawn rob $( click 1 ) --zhodani
npc set-player rob
nav $( click 2 ) >navPath
walk rob "$navPath"
```

```sh
# multiple spawn
multiSpawn () {
  echo Enter npc name, e.g. "rob --zhodani"
  echo then click somewhere:
  while true; do
    npcKey=$( take 1 )
    spawn ${npcKey} $( click 1 )
  done
}
multiSpawn
```

```sh
npc events | filter 'x => x.key === "stopped-moving"'
npc events | filter /stopped-moving/
```

```sh
npc set-player
click | filter meta.door | api doors.onRawDoorClick
```

```sh
expr '{ npcKey: "foo", point: '$( click 1 )' }' | spawn
spawn bar zhodani "$( click 1 )"

click |
  map 'point => ({ npcKey: `bot_${Date.now()}`, point  })' |
  spawn --class=zhodani
# then we can remove them
npc rm $( w npcs.npc | keys | split | filter /bot_/ )

npc get | split | map 'x => x.key'
# or
npc get | map 'xs => xs.map(x => x.key)'
```

```sh
spawn rob $( click 1 )
spawn rob2 $( click 1 ) --zhodani
npc rob lookAt $( npc rob2 getPosition)
```

## Migrating

> https://github.com/rob-myers/rob-myers.github.io/blob/codev/docs/commands.md

```sh
call '() => ({ x: 2, y: -9 })'
{ x: 2, y: -9 }
# gold because not a string

call '() => ({ x: 2, y: -9 })' >bar
bar
{ x: 2, y: -9 }

bar/x
2
```

```sh
# get roomGraph nodes ≤ 4 edges away from $roomId
gm 0 "gm => gm.roomGraph.getReachableUpto($roomId, (_ , depth) => depth > 4)"
```

## Demo

```sh
declare -F
declare -f range
range
range 10
declare -f split
range 10
range 10 | split
range 10 | split | map 'x => x + 1'
range 10 | split | map 'x => x + 1' |
  run '({ api, datum }) {
    while ((datum = await api.read()) !== api.eof) {
      await api.sleep(1);
      yield datum;
    } }'
# Ctrl-C
```

```sh
range 5 |
  split |
  run '({ api, datum }) {
    while ((datum = await api.read()) !== api.eof) {
      await api.sleep(1);
      yield datum;
    } }' |
  map 'x => `Hello ${x}`'
```

```sh
seq 5 | flatMap 'x => x < 2 ? [] : [x,x]'
seq 10 | sponge | map reverse | split
seq 10 | filter window.Boolean
```

```sh
npc map show
npc map hide
npc map # returns real number in [0, 1]
npc map show-for-secs 2
npc map show 2
npc map hide 2

npc light $( click 1 )
npc light $( click 1 ) 0
npc light $( click 1 ) 1
```

```sh
w
w 'x => x.fov'
w fov
w "x => x.gmGraph.findRoomContaining($( click 1 ))"
w gmGraph.findRoomContaining $( click 1 ) true
w gmGraph.getRoomsVantages "$( npc rob gmRoomId )" "$( npc foo gmRoomId )"
w panZoom.distanceTo $( npc rob getPosition )
call 'x => x.w' # see CACHE_SHORTCUTS

click | filter meta.door | w doors.onRawDoorClick &
w fov.setRoom 0 2

gm 0 'x => x.roomGraph'
gm 0 hullDoors | map length
gm 0 hullDoors | split | map meta
```

```sh
w 'x => x.npcs.getRandomRoom(
  (meta, gmId) => gmId === 1, // in geomorph 1
  (meta) => !meta.hull && !meta.leaf, // not a hull/leaf room
)'
# {"gmId":1,"roomId":14}
w 'x => x.npcs.getRandomRoomNavpoint(1, 14)'
# {"x":674.04,"y":784.8199999999999}
nav rob $_ | walk --open rob
# off we go...

nav rob $(
  w 'x => x.npcs.getRandomRoomNavpoint(4, 5)'
) | walk --open rob
```

```sh
# slice a navPath
nav rob $( click 1 ) > navPath
w '(x, { home }) => x.npcs.service.sliceNavPath(home.navPath, 4, -1)' >navPath2
```

```sh
npc events | map 'x => [x.key, x.meta?.key]'
```

```sh
# using brace expansion
choice '[ '{a..h}{1..8}' ]()'
# with newlines
choice "$( call '() => "foo [ 1 ]()\n\rbar [ 2 ]()\nbaz [ 3 ]()"' )"
# using newline via `call '() => "\n"' >nl`
choice "$nl"'[ '{a..h}{1..8}' ]()'
```

```sh
while true; do
  walk rob $navPath
done
```

```sh
# lock doorId 8 of gmId 0
w 'x => x.doors.toggleLock(0, 8)'
w doors.toggleLock 0 8
# give key to npc "rob"
npc rob 'x => x.has.key[0][8] = true'

# navigate, weighting nav nodes near locked doors
nav --locked=10000 $( click 2 )
```

```sh
# try close a door
npc do rob $( click 1 ) 0
# npc: run: Error: cannot close door

# try toggle a door
npc do rob $( click 1 )
# npc: run: Error: cannot toggle door
```

```sh
npc rob inFrustum $( click 1 )
npc rob inFrustum $( npc foo getPosition )
npc foo inFrustum $( npc rob getPosition )
```

```sh
# speech synthesis
say --v=?
say {a..z}
# online only:
say --v="Google UK English Female" {1..5}Hello
```

```sh
spawn --zhodani foo $( click 1 )
w gmRoomGraph.getVantages "$( npc rob gmRoomId )" "$( npc foo gmRoomId )"
w gmRoomGraph.getVantages "$( npc rob gmRoomId )" "$( npc foo gmRoomId )" false
w gmRoomGraph.getVantages "$( click 1 | map meta )" "$( click 1 | map meta )"

# get a gmRoomId
click 1 | map meta

w npcs.canSee "$( click 1 )" "$( click 1 )"
api npcs.canSee $( npc rob getPosition ) $( npc foo getPosition )
```

```sh
spawn --zhodani foo $( click 1 )

# basic follow
while true; do
  nav foo rob | walk --open foo
done

# follow rob when out of sight
while true; do
  test $(
    w npcs.canSee $( npc rob getPosition ) $( npc foo getPosition )
  ) || (
    nav foo rob | walk --open foo
  )
done
```

```sh
seq 10 | take 5
click | take 1
# longClick 1
click | filter meta.longClick | take 1
```

```sh
# click 4 places on other side of doors
nav rob $( click 4 ) | walk --open rob

# BASIC throwback
echo What is your name?
echo Hello $( take 1 )

# ansi colour code
call '() => "\u001b[36mRob"'

click | filter meta.nav | nav rob | walk --forever rob

npc rob walk $( nav rob $( click 1 ) )
```

```sh
# create a square i.e. 5th point is 1st point
nav $( click 5 ) >np
# spawn foo
spawn --zhodani foo $( click 1 )
# walk in a cyclic manner
while true; do walk foo ${np}; done
```

```sh
# errors when click outside navmesh
$ nav rob $( click 1 )
nav: run: point outside navmesh: {"x":536.84,"y":435.18,"meta":{"roomId":15,"decor":true,"do":true,"sit":true,"chair":true,"orient":0,"ui":true,"gmId":0,"targetPos":{"x":534,"y":432},"longClick":false,"distance":0,"nav":false}}
$ npc rob walk $( click 1 )
npc: run: invalid global navpath: {"npcKey":"rob","navPath":{"x":535.98,"y":435.42,"meta":{"roomId":15,"decor":true,"do":true,"sit":true,"chair":true,"orient":0,"ui":true,"gmId":0,"targetPos":{"x":534,"y":432},"longClick":false,"distance":0,"nav":false}},"opts":{}}
$ walk rob $( click 1 )
walk: run: point (dst) outside navmesh: {"x":537.11,"y":432.58,"meta":{"roomId":15,"decor":true,"do":true,"sit":true,"chair":true,"orient":0,"ui":true,"gmId":0,"targetPos":{"x":534,"y":432},"longClick":false,"distance":0,"nav":false}}
```

```sh
# 🚧 saw issue
npc rob setSpeedFactor 2
click | walk --open rob
```

```sh
w decor.byRoom.0 | map length
w decor.byRoom.0.1.points | split

api decor.byRoom.0.2.points | split | map key
npc rm-decor $( foo/key )

click 1 >fixed
click | w npcs.canSee $fixed -
```

```sh
# spawn a bunch of bots and make them all look at some point

# spawner
multiSpawn() {
  echo name⏎ click, e.g. "rob --zhodani"
  take | filter '(text, {api}) =>
    /^[a-z-]+(\s+--[a-z]+)?$/.test(text) ||
    api.info("lowercase/hyphens only")
  ' | while true; do
    spawn $( take 1 ) $( click 1 )
  done
}
multiSpawn

# make them look
click 1 | run '({ api, w: { npcs } }) {
  const point = await api.read()
  for (const npcKey in npcs.npc) {
    const npc = npcs.getNpc(npcKey);
    npc.lookAt(point, { ms: 500 });
  }
}'

# make them walk
while true; do
  click 1 | run '({ api, w: { npcs } }) {
    const point = await api.read()
    for (const npcKey in npcs.npc) {
      const npc = npcs.getNpc(npcKey);
      npc.walk(point, point);
    }
  }'
done

# using cli without while delay?
# try `api ...` reading from stdin
```
