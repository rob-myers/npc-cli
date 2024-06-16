# usage: `cat foo/bar`
cat() {
  get "$@"
}

clone() {
  map 'x => JSON.parse(JSON.stringify(x))'
}

# empty() {
#   return $(
#     call '({ args }) => args.some(Boolean) ? 1 : 0' "$@"
#   )
# }

# usage: `expr location | pretty`
keys() {
  map Object.keys
}

# usage: `expr location | pretty`
pretty() {
  map '(x, { api }) => api.pretty(x)'
}

# usage: `range 10`
range() {
  call '({ args }) =>
    Array.from({ length: Number(args[0]) }).map((_, i) => i);
  ' "$1"
}

# usage: `readtty`
readtty() {
  call '({ api, args }) => api.isTtyAt(...args.map(Number))' $1
}

# usage: `seq 10`
seq() {
  range "$1" | split
}
