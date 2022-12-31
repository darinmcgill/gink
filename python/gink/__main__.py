#!/usr/bin/env python3

import sys
import copy
from . import *
store = LmdbStore("/tmp/gink.mdb")
database = Database(store)
root = Directory.global_instance(database=database)
args = copy.copy(sys.argv)
args.pop(0) # remove script
cmd = args.pop(0)
key = args.pop(0)
if cmd == "get":
    gotten = root.get(key)
    if gotten:
        print(gotten, end="")
        sys.exit(0)
    else:
        print("key not found", file=sys.stderr)
        sys.exit(1)
if cmd == "set":
    root[key] = sys.stdin.read()
    sys.exit(0)
print("command not recognized", file=sys.stderr)
