# This script:
# - restarts `npm run watch-assets-nodemon` on crash
# - stops on exit e.g. ctrl-c
#
# We need this because we're using nodemon programmatically (not from CLI).

trap 'kill $(jobs -p)' EXIT

while true; do
    npm run watch-assets-nodemon &
    wait
    echo -e "\033[33m[watch-assets]\033[97m crashed with exit code $?, respawning..." >&2
    sleep 1
done
