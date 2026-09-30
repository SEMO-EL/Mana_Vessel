#!/usr/bin/env bash
# Print the JSON chunk of a .glb (header: 12 bytes, then chunk0 length:uint32 LE, type:'JSON').
f="$1"
len=$(od -An -t u4 -j 12 -N 4 "$f" | tr -d ' ')
dd if="$f" bs=1 skip=20 count="$len" status=none
