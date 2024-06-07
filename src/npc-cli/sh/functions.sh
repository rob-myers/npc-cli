# e.g. `range 10`
range() {
  call '({ args }) =>
    Array.from({ length: Number(args[0]) }).map((_, i) => i);
  ' "$1"
}

# e.g. `seq 10`
seq() {
  range "$1" | split
}

# e.g. `expr location | pretty`
pretty() {
  map '(x, { api }) => api.pretty(x)'
}
