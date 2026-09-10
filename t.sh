ARGS=""
[ "false" = "true" ] && ARGS="$ARGS --plan"
[ "true" = "true" ] || ARGS="$ARGS --from-cache"
echo "reached end: [$ARGS]"
