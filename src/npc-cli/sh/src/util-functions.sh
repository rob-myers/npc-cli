# usage: `range 10`
range() {
  call '({ args }) =>
    Array.from({ length: Number(args[0]) }).map((_, i) => i);
  ' "$1"
}

# usage: `seq 10`
seq() {
  range "$1" | split
}

# usage: `expr location | pretty`
pretty() {
  map '(x, { api }) => api.pretty(x)'
}

# usage: `expr location | pretty`
keys() {
  map Object.keys
}

# cat() {
#   get "$@" | split;
# }

# usage: `cat foo/bar`
cat() {
  get "$@"
}


# usage: `log $foo bar`, `seq 10 | log`
# ℹ️ initially logs args, then stdin.
# ℹ️ `map console.log` would log 2nd arg too
# ℹ️ logs chunks larger than 1000, so e.g. `seq 1000000 | log` works
log() {
  run '({ api, args, datum }) {
    args.forEach(arg => console.log(arg))
    if (api.isTtyAt(0)) return
    while ((datum = await api.read(true)) !== api.eof) {
      if (api.isDataChunk(datum) && datum.items.length <= 1000) {
        datum.items.forEach(x => console.log(x));
      } else {
        console.log(datum);
      }
    }
  }' $@
}

# empty() {
#   return $(
#     call '({ args }) => args.some(Boolean) ? 1 : 0' "$@"
#   )
# }

clone() {
  map 'x => JSON.parse(JSON.stringify(x))'
}

readtty() {
  call '({ api, args }) => api.isTtyAt(...args.map(Number))' $1
}
