# Usage: gm [gmId] [selector]
# e.g. gm 0 key
# e.g. gm 0 rooms | split | map meta
gm() {
  local gmId="${1:-0}" selector="${2:-x=>x}"
  shift 2
  call '({ w }) => w.gms['$gmId']' | map "$selector" "$@"
}

spawn() {
  w npc.spawn "$@" >/dev/null
}
