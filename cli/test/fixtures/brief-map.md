---
complex_md: "0.3"
hotspots:
  - path: src/core.js
    churn: 9
    fixes: 3
    fan_in: 5
    tests: 1
    score: 900
load_bearing:
  - path: src/legacy.js
    fan_in: 6
    tests: 0
co_change:
  - files: [src/render.js, src/render.css]
    count: 4
    coupling: 100
---

## Where the risk lives

x

## Why these files are hot

src/core.js is the hub every module imports. Before editing this file, run test/core.test.js.

## Change coupling

x

## What to read first

1. src/core.js
