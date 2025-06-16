# Performance Baseline: Anarchy & Associates Discord Bot (Updated)

## Previous Hotspots (now optimized)
1. Channel message fetching in button handlers: ~120-180ms → <10ms
2. Case DB lookups (findById, update): ~40-70ms/call → 1 roundtrip
3. Role/job list fetching: ~30-50ms/call → <1ms (cache)

## Next Profiling Steps
- Re-profile with the same workload (high-volume Discord events, button interactions, etc.)
- Use Node.js profiler or `clinic.js` to capture new call trees and wall-clock breakdowns.
- Focus on:
  - Any remaining I/O or CPU spikes in event handlers
  - Memory usage under sustained load
  - Latency of less-frequent but heavy operations (e.g., case list, audit log, onboarding)

## TODO
- Paste new flamegraph/call tree output here
- List any new top-3 hotspots
- Summarize further optimization opportunities

---
*Update this file after each profiling/optimization round.*
