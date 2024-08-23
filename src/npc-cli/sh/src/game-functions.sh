# Usage: gm {gmId} [selector]
gm() {
  local gmId selector
  gmId="${1:-0}"
  selector="${2:-x=>x}"
  shift 2
  call '({ api, home }) => api.getCached(home.WORLD_KEY).gms['$gmId']' |
    map "$selector" "$@"
}

# 🔔 initial ctrl-c test
# echo sleeping... && sleep 10 && echo done

# OLD BELOW 👇
# some possibly salvagable

# look() {
#   npc $1 lookAt
# }

# # Usage: doLoop {npcKey}
# doLoop() {
#   click |
#     filter 'p => p.meta.do || p.meta.nav || p.meta.door' |
#     npc $1 do
# }

# #
# # Usage: goLoop {npcKey}
# # - ℹ️ when off-mesh, starts from closest navigable
# goLoop() {
#   click |
#     filter '({ meta }) => meta.nav && !meta.ui && !meta.do && !meta.longClick' |
#     nav $1 |
#     walk $1
# }

# # Usage: goOnce {npcKey}
# # goOnce() {
# #   nav $1 $(click 1) | walk $1
# # }

# # Usage: lookLoop {npcKey}
# lookLoop() {
#   click |
#     # do not look towards navigable or doable points
#     filter 'x => !x.meta.nav && !x.meta.do' |
#     look $1
# }

# # Usage: thinkLoop {npcKey}
# thinkLoop() {
#   click |
#     filter 'x => x.meta.npc && x.meta.npcKey === "'$1'"' |
#     run '({ api, home }) {
#       const { fov } = api.getCached(home.WORLD_KEY)
#       while (await api.read(true) !== api.eof)
#         fov.mapAct("show-for", 3000)
#     }'
# }

# # Usage:
# # - longClick 1
# # - longClick
# longClick() {
#   click | filter meta.longClick | take $1
# }

# pausableNpcs() {
#   click |
#     filter '({ meta }) => meta.npc && !meta.longClick' |
#     map '(p, { w }) => {
#       const npc = w.npcs.getNpc(p.meta.npcKey)
#       npc.forcePaused ? npc.resume() : npc.pause()
#   }'
# }
