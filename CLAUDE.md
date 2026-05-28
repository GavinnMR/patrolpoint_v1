# CLAUDE.md — PatrolPoint

## Section 1: Project Overview

**Project Name:** PatrolPoint

**Description:** A client-side web application for barangay-level patrol deployment optimization. Given user-plotted crime incident coordinates, the system derives a danger zone boundary, optimally spreads n patrol units across that zone, and optionally generates optimal closed-loop roaming circuits for each patrol through their assigned crime nodes. Everything runs in the browser with no backend.

**Project Root:** C:\Users\Gavinn\Documents\DAA\patrolpoint

**Target Barangay:** Barangay Commonwealth, Quezon City, Metro Manila, Philippines

**GitHub Repository:** Create a public repository named PatrolPoint on the connected GitHub account. Use this repository for version control throughout development. Commit after each completed build step with a descriptive commit message. Push to GitHub after every commit so GitHub Pages can be enabled early.

---

**File Structure:**
```
patrolpoint/
├── index.html
├── style.css
├── main.js
├── algorithms/
│   ├── convexHull.js
│   ├── hillClimbing.js
│   ├── zoneAssignment.js
│   ├── tsp.js
│   └── dijkstra.js
├── data/
│   └── road_network.json
└── README.md
```

---

**Tech Stack:**
- HTML, CSS, vanilla JavaScript — no frameworks, no build tools, no backend
- Leaflet.js — interactive map rendering loaded via CDN
- OpenStreetMap tiles — base map layer
- No backend — all computation runs client-side in the browser
- GitHub Pages — deployment platform

---

**Road Network Data:**

road_network.json is located at data/road_network.json. It already exists at C:\Users\Gavinn\Documents\DAA\patrolpoint\data\road_network.json — do not overwrite or regenerate it. It contains the pre-processed road network of Barangay Commonwealth with the following structure:

```json
{
  "nodes": [
    { "id": "n0", "lat": 14.7001238, "lng": 121.0889791 }
  ],
  "edges": [
    { "from": "n0", "to": "n1", "weight": 12.8241 }
  ]
}
```

- 3,613 total nodes — every road vertex in Barangay Commonwealth
- 3,971 edges — road segments connecting nodes
- Edge weights are in meters computed using the Haversine formula — they represent true road segment lengths
- All coordinates are in EPSG:4326 — latitude/longitude decimal degrees

**On page load, immediately build two lookup structures from road_network.json — never use raw arrays for lookup:**

nodeMap maps node ID to node object for O(1) coordinate lookup. adjacencyList maps node ID to array of neighbor objects each containing neighborId and weight for O(degree) Dijkstra traversal. Both are built in a single O(V+E) pass through the JSON. Every algorithm uses these structures exclusively.

**Intersection nodes** are nodes with road degree >= 3 — meaning at least 3 edges connect to them. Pre-compute and store the list of intersection nodes immediately after building nodeMap and adjacencyList. There are 914 intersection nodes in Barangay Commonwealth.

**Soft cap:** n_max = floor(sqrt(914)) = 30. Compute this from the actual intersection node count — not hardcoded — so it works correctly for any barangay.

**Network connectivity check:** On load, run BFS from the first node and verify all other nodes are reachable. Remove disconnected nodes from the valid node set entirely. Log how many were removed to the browser console.

---

**Distance Function:**

Define a single canonical haversineDistance function at the top of main.js. Every distance computation in the entire system calls this function — never compute distance inline anywhere else. Parameters are always lat1, lng1, lat2, lng2 in that exact order — lat always before lng. This is critical — accidentally swapping lat and lng produces plausible-looking wrong values with no error thrown.

The Haversine formula:
```
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlng/2)
distance = 2 × 6371000 × arcsin(√a)
```

Returns distance in meters.

---

**Coordinate Convention:**

All coordinates stored as objects with lat and lng properties. Shoelace formula uses lng as x and lat as y — this must be consistent throughout. Add a comment in the code at the Shoelace implementation marking this convention explicitly. Never swap this convention.

---

**All file references use relative paths — never absolute paths.** road_network.json is always referenced as ./data/road_network.json.

---

## Section 2: UI Layout and Behavior

**Overall Layout:**

The application is a single page — index.html. The layout consists of two main areas side by side:

- Left side — Map area: Takes up the majority of screen width. Contains the Leaflet map.
- Right side — Control panel: Contains all user inputs, buttons, warning banners, and the algorithm trace panel.

The control panel is fixed width. The map fills the remaining space. On the map, a small legend in the bottom-left corner explains marker types.

---

**Leaflet Map Setup:**

Initialize the Leaflet map with the following configuration:
- Center: 14.7028, 121.0944 — approximate centroid of Barangay Commonwealth
- Initial zoom: 15 — shows the entire Commonwealth road network
- Minimum zoom: 14 — prevents zooming out beyond Commonwealth
- Maximum zoom: 19 — standard OSM maximum zoom
- Tiles: OpenStreetMap standard tile layer

Add a Reset View button on the map that snaps back to the initial center and zoom level.

---

**Map Layer Rendering Order — bottom to top:**

1. OSM base map tiles
2. Commonwealth administrative boundary — thin dashed grey polygon
3. Hull polygon H — semi-transparent shaded area
4. Zone assignment lines — thin dashed colored lines from crime nodes to their assigned patrol
5. Patrol route polylines — TSP circuits per patrol
6. Patrol position markers — colored circle markers
7. Crime node markers — always on top, always clickable

Use zIndexOffset on crime node markers to force them above all other layers regardless of add order.

---

**Map Layer Update Behavior:**

Never wipe and redraw all layers on recalculate. Update layers in place:
- Hull polygon: call setLatLngs() with new hull vertices
- Patrol markers: call setLatLng() to animate markers to new positions
- Route polylines: remove only changed route polylines and redraw them
- Zone lines: remove all zone lines and redraw after zone assignment completes
- Crime node markers: never moved by pipeline — only user adds or removes them

At the very start of every pipeline run — before any stage executes — clear all previous pipeline results unconditionally: hull polygon, patrol markers, route polylines, zone lines, warning banners, and trace panel. Crime node markers are never cleared by the pipeline.

---

**Crime Node Markers:**

When user clicks the map, plot a red circle marker at the clicked location. Before plotting, check:

1. Duplicate check — if a point within 1e-7 degrees of the clicked location already exists in P, show warning banner: "Incident already plotted at this location." Do not add the duplicate.

2. Hull membership check — only after a hull exists from a previous pipeline run. If clicked location is outside the current hull, show warning banner: "Incident plotted outside the current danger zone boundary. Point ignored." Do not add the point.

When user clicks an existing crime node marker, show a brief visual confirmation — marker flashes or changes color for 300ms — then remove it from P and remove the marker from the map. Show an Undo Last Action button that restores the most recently removed crime node. Undo only keeps one level of history.

Disable map click events during pipeline execution. Re-enable when pipeline completes.

---

**Control Panel Elements — top to bottom:**

1. PatrolPoint title and subtitle
2. Warning banner area — consolidates all warnings into one banner with list format
3. Number of patrols input — type number, min 1, step 1, placeholder showing n_max
4. Deployment mode toggle — Stationary / Roaming
5. Recalculate button
6. Bulk coordinate import section — collapsible, closed by default
7. Algorithm trace panel — collapsible side panel, closed by default
8. Settings gear icon — opens settings modal

---

**Number of Patrols Input:**

- HTML type="number" with min="1" and step="1" to prevent decimals and negatives at UI level
- Show inline validation feedback as user types — red border and message if value is non-integer, zero, or negative
- Show n_max as placeholder: "Enter number of patrols (max: 30)"
- If n > n_max, show warning in warning banner — do not block pipeline

---

**Deployment Mode Toggle:**

Stationary and Roaming are the two options. Default is Stationary. Toggle is always accessible — before adding crime nodes, after pipeline runs, and between recalculations. Changing the toggle does not auto-trigger the pipeline — user must click Recalculate.

---

**Recalculate Button:**

- Disabled on page load until road_network.json finishes loading
- Disabled during pipeline execution — re-enabled when pipeline completes or errors
- Shows loading state text during execution — updated per stage: "Running Stage 1 — Convex Hull...", "Running Stage 2 — Hill Climbing...", "Running Stage 3 — Zone Assignment...", "Running Stage 4 — TSP..."
- Keyboard shortcut: Ctrl+Enter triggers Recalculate — only when textarea and other inputs are not focused. Show hint on button: "Recalculate (Ctrl+Enter)"

---

**Reset Button:**

Separate from Recalculate. Clears all crime node markers, all pipeline results, and resets P to empty. Show confirmation dialog before resetting: "Reset will clear all incident coordinates and results. Continue?" Two buttons — Confirm Reset and Cancel.

---

**Bulk Coordinate Import:**

Collapsible section, closed by default. Opens via a small Import Coordinates link below the map click instruction text.

Contains:
- A textarea for pasting coordinates — one per line in format: "lat, lng"
- An Import button
- A brief format hint: "One coordinate per line. Format: 14.7023, 121.0934"

**Import behavior — Option A — Replace:**
1. Parse all lines — skip malformed lines, count skipped
2. Validate each coordinate — lat between -90 and 90, lng between -180 and 180
3. Check each coordinate against Commonwealth bounding box — derived from road_network.json node extents. Flag coordinates outside bounding box with warning: "X coordinates fall outside Barangay Commonwealth. These points may produce no valid patrol positions." Still import them — let user decide.
4. Run outlier detection on imported points immediately — flag outliers with distinct visual marker style rather than silently removing. User sees which points are flagged before running pipeline.
5. Show confirmation dialog: "Importing will replace X existing incident points. Continue?"
6. On confirm — clear all existing crime node markers, plot imported coordinates as crime node markers
7. Clear textarea automatically after successful import
8. Show brief success message: "X points imported successfully." — disappears after 3 seconds
9. Count and report skipped lines: "8 points imported, 2 lines skipped due to invalid format"

---

**Warning Banner:**

Single banner area at top of control panel. Consolidates multiple warnings into one banner with list format when multiple special cases trigger simultaneously. Each pipeline run clears all previous banners before showing new ones. Banners do not stack — only current run's warnings are shown.

Banner types:
- Warning — yellow — non-blocking, pipeline continues
- Error — red — blocking, pipeline stopped

---

**Settings Modal:**

Opens via gear icon. Slides in as an overlay panel on top of the map. Contains all tunable constants organized by stage.

**Hill Climbing settings:**
- Number of restarts r — default 10
- Maximum iterations per restart — default 500
- Radius multiplier k — default 2

**Convex Hull settings:**
- Area threshold divisor c — default 100
- Outlier detection multiplier — default 2.5

**TSP settings:**
- Maximum crime nodes per zone — default 10

**Display settings:**
- Show zone assignment lines — toggle, default on
- Show route direction arrows — toggle, default on
- Show overlap coloring — toggle, default on

**Behavior:**
- When modal opens, always show currently active CONFIG values — not defaults
- Apply button updates CONFIG and closes modal
- Cancel button closes modal without updating CONFIG
- Reset to Defaults button restores all CONFIG values to defaults
- All pipeline constants read exclusively from CONFIG — never hardcoded elsewhere

---

**Algorithm Trace Panel:**

Collapsible side panel on the right edge of the screen. Toggle button to show/hide. Closed by default. On small screens the panel overlaps the map — this is acceptable since it is primarily a demo tool.

Panel is accessible during pipeline execution — logs appear in real time as each stage completes using async yield points between stages.

Structure per stage:
```
▼ Stage N — Algorithm Name          [Expand]
  ┌─ Summary ──────────────────────────────┐
  │ Key metrics and decisions              │
  │ Status: ✅ / ⚠️ / ❌                   │
  │ Runtime: Xms                           │
  └────────────────────────────────────────┘
  [Full Log ▼] — collapsible detailed log
```

**Stage status indicators:**

Stage 1 — Brute Force Convex Hull:
- Success: valid hull computed, area above threshold
- Warning: hull area below threshold, or linear handler triggered, or outliers detected and flagged
- Error: |P| = 0 or |P| = 1, or hull produced fewer than 3 valid edges, or hull area is zero or negative, or validCandidates empty

Stage 2 — Hill Climbing:
- Success: valid patrol positions found, meaningful spread achieved
- Warning: radius R expanded due to zero neighbors, or all restarts converged to same configuration, or maximum iterations reached without convergence on any restart
- Error: zero valid candidates inside hull, or n capped to 0 after Hole 24 handler

Stage 3 — Zone Assignment:
- Success: all crime nodes assigned, no empty zones
- Warning: one or more patrols have empty zones, or maximum snapping distance exceeded 200 meters
- Error: valid candidates empty — defensive check failed

Stage 4 — Backtracking TSP:
- Success: optimal circuits generated for all non-empty zones
- Warning: route overlap detected, or k=2 zones found, or unreachable crime nodes excluded
- Error: no valid circuit found for any patrol zone

**Pipeline summary at bottom of trace panel:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pipeline Complete — Total time: Xms
N roaming patrols | M stationary | K overlapping edges
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Trace panel behavior:**
- Cleared completely at start of every pipeline run
- Expand/collapse state per stage preserved across recalculations
- Auto-scrolls to bottom when pipeline completes
- Node IDs in logs shown with coordinates: "n234 (14.7023, 121.0934)"
- Stage 3 summary explicitly states: "Zone assignment using final optimized patrol positions from Hill Climbing restart X"
- Stage 4 TSP sequence shown in summary: "Patrol s1 optimal circuit: n234 → n089 → n156 → n234, distance: 237m"

---

**Map Legend:**

Small fixed legend in bottom-left corner of map showing:
- Red circle — crime incident coordinate
- Colored filled circle — roaming patrol position
- Colored hollow circle — stationary patrol position
- Colored dashed line — zone assignment
- Colored solid line — patrol route
- Blue/Orange/Red line — route overlap indicator

---

**Loading State:**

On page load show a loading spinner overlay on the map and disable Recalculate button until road_network.json finishes loading. Show specific error messages for different load failures:
- File not found: "Road network data file not found. Please verify road_network.json is in the data folder."
- Malformed JSON: "Road network data file is corrupted. Please regenerate road_network.json."
- Network error: "Failed to load road network data. Please check your internet connection."

On Recalculate click — show loading spinner overlay on map and change button text to current stage name. Update stage text as each stage begins.

---

**Browser Navigation Warning:**

Add a beforeunload event listener. If P has any plotted crime nodes or pipeline results exist, show browser confirmation dialog when user tries to navigate away: "You have unsaved patrol deployment data. Leave away?"

---

**Leaflet Map Resize:**

Add a window resize event listener that calls map.invalidateSize() on every resize. This forces Leaflet to recalculate container dimensions and re-render correctly after browser window resize.

---

**Patrol Marker Colors:**

Assign each patrol a color from this predefined palette in order:
- #e74c3c red
- #3498db blue
- #2ecc71 green
- #f39c12 orange
- #9b59b6 purple
- #1abc9c teal
- #e67e22 dark orange
- #34495e dark grey
- #e91e63 pink
- #00bcd4 cyan

Use modulo for n > 10. Color used consistently across patrol marker, route polyline, zone assignment lines, and trace panel entry for that patrol.

Roaming patrol marker — filled colored circle with patrol number label.
Stationary patrol marker — hollow circle with dashed border in patrol color plus S label.

---

**Route Overlap Visualization:**

After all TSP routes computed, track edge usage across all patrol routes. Normalize edge keys numerically — extract numeric part of node ID, sort smaller first, join with pipe character: "n89|n234". Render overlapping edges as a separate overlay layer on top of patrol route polylines — do not modify original route colors. Original routes keep patrol colors. Overlay draws semi-transparent lines on top:
- 2 patrols on same edge → orange overlay
- 3+ patrols on same edge → red overlay

---

**Commonwealth Administrative Boundary:**

Load commonwealth_boundary GeoJSON and render as a thin dashed grey polygon on the map below the hull polygon. This gives geographic context and makes it immediately obvious when the hull extends beyond the barangay boundary. This layer never changes — render it once on load and leave it permanently visible.

---

## Section 3: Pipeline Architecture

**Pipeline Execution Model:**

The pipeline is asynchronous. Use async/await with deliberate yield points between stages. After each stage completes, yield control back to the browser using a small Promise.resolve() or setTimeout(0) before the next stage begins. This allows the browser to repaint the UI, update the trace panel, and update the loading indicator text between stages. The added delay per yield point is 4-16 milliseconds — imperceptible to the user.

The pipeline must never be triggered while already running. The Recalculate button is disabled immediately on click and re-enabled only after the pipeline fully completes or errors.

---

**Pipeline Entry Point:**

On Recalculate click:
1. Disable Recalculate button immediately
2. Disable map click events
3. Clear all previous pipeline results — hull polygon, patrol markers, route polylines, zone lines, warning banners, trace panel
4. Validate inputs — run all pre-pipeline checks before any stage executes
5. Show loading spinner on map
6. Run pipeline stages sequentially with yield points between each
7. Re-enable Recalculate button and map click events when done

---

**Pre-Pipeline Input Validation:**

Run these checks before Stage 1 executes. If any blocking check fails, show error banner and stop:

- n = 0 or negative or non-integer: Error — "Number of patrols must be a positive whole number."
- n is decimal: Error — "Number of patrols must be a whole number."
- |P| = 0: Error — "No incident coordinates plotted. Please click the map to add incident coordinates."
- |P| = 1: Error — "At least 2 incident coordinates are needed. Please plot more points."
- Roaming mode selected and |P| = 0: Error — "Roaming mode requires at least one incident coordinate. Plot incidents or switch to Stationary mode."

---

**CONFIG Object:**

Define a single CONFIG object at the top of main.js containing all tunable constants. Every algorithm reads constants from CONFIG — never hardcoded elsewhere:

```javascript
CONFIG = {
    hillClimbing: {
        restarts: 10,
        maxIterations: 500,
        radiusMultiplier: 2
    },
    convexHull: {
        areaThresholdDivisor: 100,
        outlierMultiplier: 2.5,
        collinearityEpsilon: 1e-10
    },
    tsp: {
        maxCrimeNodesPerZone: 10
    },
    snapping: {
        boundingBoxEpsilon: 1e-7
    },
    display: {
        showZoneLines: true,
        showRouteArrows: true,
        showOverlapColoring: true
    }
}
```

---

**State Variables:**

Define these module-level variables at the top of main.js:

- P — array of raw incident coordinate objects with lat and lng properties
- S_star — array of optimal patrol position objects from Hill Climbing
- zones — array of n zone arrays each containing assigned crime node objects
- currentHull — ordered array of hull vertex coordinates — null before first pipeline run
- validCandidates — pre-filtered intersection nodes inside hull — null before first pipeline run
- validCandidatesHullCache — the hull vertices that produced the current validCandidates
- lastRemovedPoint — single crime node object for undo functionality — null if nothing removed
- pipelineRunning — boolean flag — true during execution, false otherwise
- nodeMap — node ID to node object lookup
- adjacencyList — node ID to neighbor array lookup
- dijkstraCache — Dijkstra result cache for current pipeline run — cleared at start of each run

---

**Pipeline Stage Sequence:**

```
Pre-pipeline validation
        ↓
[yield]
Stage 1: Brute Force Convex Hull
        ↓
[yield — hull polygon renders on map]
Shoelace area computation
Winding order normalization
Hull validation
Outlier detection result applied
Area threshold check
Pre-filtering: Ray Casting on 914 intersection nodes
        ↓
[yield — valid candidates computed]
Stage 2: Hill Climbing
        ↓
[yield — patrol markers render on map]
Stage 3: Zone Assignment
        ↓
[yield — zone lines render on map]
Special case routing:
    |Zi| = 0 → patrol stationary
    |Zi| = 1 → direct visit route
    |Zi| > 1 → proceed to Stage 4
        ↓
Stage 4: Backtracking TSP (roaming mode only)
    Stage 4.1: Dijkstra road path computation
        ↓
[yield — routes render on map]
Pipeline complete — update trace panel summary
Re-enable Recalculate and map click events
```

---

**Stage Result Objects:**

Each stage function returns a result object:

```javascript
{
    status: 'success' | 'warning' | 'error',
    message: 'human readable description',
    warnings: [],
    data: {}
}
```

The pipeline checks status after each stage. On error — show error banner, log to trace panel, stop pipeline, re-enable controls. On warning — show warning in trace panel, continue pipeline. On success — continue pipeline.

---

**Per-Stage Runtime Tracking:**

Record performance.now() before and after each stage. Store per-stage runtime in the trace panel summary. Record total pipeline runtime from pre-validation start to final render complete.

---

**Wrap entire pipeline in try-catch:**

If any unexpected uncaught error occurs anywhere in the pipeline, show generic error banner: "An unexpected error occurred. Please check your inputs and try again." Log full error details to browser console. Re-enable Recalculate button and map click events. Never leave the UI in a disabled state due to an unexpected error.

---

**State Reset Per Special Case:**

Use a single clearMapResults function that accepts flags for what to clear:

```javascript
clearMapResults({
    clearHull: false,
    clearPatrols: false,
    clearRoutes: false,
    clearZoneLines: false,
    clearNearestHighlights: false
})
```

| Trigger | clearHull | clearPatrols | clearRoutes | clearZoneLines | clearNearestHighlights |
|---|---|---|---|---|---|
| Linear handler | true | true | true | true | false |
| Empty valid candidates | false | true | true | true | false |
| Hull area zero/negative | true | true | true | true | false |
| Edge ordering failure | true | true | true | true | false |
| n capped to 0 | false | true | true | true | false |
| Warning only cases | false | false | false | false | false |

Crime node markers are never cleared by any pipeline special case handler.

---

**Valid Candidates Cache:**

After pre-filtering produces validCandidates, store both the result and the hull vertices that produced it in validCandidatesHullCache. At the start of each pipeline run before pre-filtering, compare current hull vertices to cached hull vertices. If identical — same vertex coordinates in same order — reuse cached validCandidates and skip Ray Casting pre-filtering entirely. If different, recompute and update cache. Hull comparison is vertex-by-vertex coordinate comparison using the collinearity epsilon tolerance.

---

**Dijkstra Cache:**

Initialize an empty dijkstraCache object at the start of Stage 4. Cache key is always normalized — extract numeric part of node ID, sort numerically smaller first, join with pipe: "n89|n234". Store full path and distance for each computed pair. Before running Dijkstra for any pair, check cache first. If hit — use cached result. If miss — run Dijkstra and store result in cache. Cache is discarded after pipeline completes — it is not persistent across pipeline runs.

---

## Section 4: Stage 1 — Brute Force Convex Hull

**Purpose:**
Compute the smallest convex polygon enclosing all user-plotted incident coordinates. This polygon defines the operational danger zone within which all subsequent computation is constrained.

**Input:**
P — array of raw incident coordinate objects with lat and lng properties

---

**Execution Sequence:**

```
Outlier detection on P
        ↓
Validity check
        ↓
Collinearity check
        ↓        ↓
   Linear       Brute Force
   Handler      Convex Hull
                    ↓
             Edge deduplication
                    ↓
             Edge ordering
                    ↓
             Edge count validation
                    ↓
             Shoelace area computation
                    ↓
             Winding order normalization
                    ↓
             Hull area validation
                    ↓
             Ray Casting pre-filtering
```

---

**Step 1 — Outlier Detection:**

Compute centroid of all points in P:

centroid = (sum of all lat / |P|, sum of all lng / |P|)

Compute average Haversine distance from centroid to all points in P.

Flag any point whose Haversine distance from centroid exceeds CONFIG.convexHull.outlierMultiplier x average distance as an outlier. Default multiplier is 2.5.

Outlier markers are displayed with a distinct visual style — different color or icon — rather than being silently removed. User sees which points are flagged. Log flagged outliers in trace panel.

After flagging, check if remaining non-outlier points in P have fewer than 3 points. If yes, show warning banner: "Outlier removal reduced incident points below minimum required for danger zone computation. Either plot more points or adjust the outlier sensitivity in Settings." Add an Include Outliers toggle in Settings screen that bypasses outlier detection entirely. Do not trigger linear handler automatically — wait for user action.

If remaining non-outlier P has 3 or more points, proceed with those points only.

---

**Step 2 — Validity Check:**

If |P| after outlier removal < 3 and linear handler not already triggered:
- |P| = 2 — trigger linear special case handler with warning: "Only 2 incident points available. Patrols placed along incident line."

---

**Step 3 — Collinearity Check:**

Fix first two points A and B as baseline. Evaluate every remaining point C using cross product:

k = (B.x - A.x)(C.y - A.y) - (B.y - A.y)(C.x - A.x)

Where x is lng and y is lat — this convention must be consistent throughout.

If |k| < CONFIG.convexHull.collinearityEpsilon (1e-10) → point is collinear with baseline.

If every remaining point C produces |k| < epsilon → all points collinear → trigger linear special case handler.

If any point produces |k| >= epsilon → not all collinear → proceed with Convex Hull.

This approach reduces the collinearity check to O(n) rather than O(n³).

---

**Step 4 — Linear Special Case Handler:**

Triggered when |P| = 2 or all points collinear or fewer than 3 valid hull edges.

Fit a line through all incident points. Compute total line length L using Haversine between first and last point along the line. Place n patrol units at equal intervals:

position_k = (k x L) / (n + 1), for k = 1, 2, ..., n

Dividing by n+1 places patrols inward from both endpoints with equal buffer on both sides.

Show warning banner with appropriate message:
- |P| = 2: "Only 2 incident coordinates plotted. Patrols placed along incident line. Plot at least 3 non-collinear points for full danger zone analysis."
- All collinear: "All incident coordinates are collinear. Patrols placed along the incident line. Plot points in different directions for full danger zone analysis."
- Fewer than 3 hull edges: "Incident coordinates are too nearly collinear to form a valid danger zone. Patrols placed along incident line."

Render n patrol markers along the line. Set Stage 1 status to Warning. Stop pipeline — do not proceed to Stage 2.

---

**Step 5 — Brute Force Convex Hull Execution:**

For every ordered pair (pi, pj) in P x P where pi != pj, evaluate whether all remaining points lie on the same side of the directed line formed by that pair.

For each remaining point pk, compute:

d = (pj.x - pi.x)(pk.y - pi.y) - (pj.y - pi.y)(pk.x - pi.x)

Where x is lng and y is lat.

The sign of d determines which side pk falls on:
- d > 0 → pk is to the left of the directed edge
- d < 0 → pk is to the right of the directed edge
- d = 0 → pk lies directly on the line

A pair (pi, pj) forms a valid boundary edge if and only if all remaining points produce the same sign of d. If any point falls on the opposite side, disqualify this pair.

**Edge deduplication:**
Both (pi, pj) and (pj, pi) might pass the side consistency check with opposite signs. Treat each edge as an unordered pair. Keep only the direction where all d values are positive — meaning all points are to the left of the directed edge. This ensures consistent counterclockwise winding naturally.

Collect all valid deduplicated hull edges.

Time complexity: O(n³) — acceptable at n = 5 to 30 incident points.

---

**Step 6 — Edge Count Validation:**

After collecting valid hull edges, check edge count. If fewer than 3 valid edges produced, trigger linear special case handler as fallback. Stop pipeline.

---

**Step 7 — Edge Ordering:**

Sort collected hull edges into a proper ordered sequence where each edge's endpoint connects to the next edge's start point. Start with any edge. Find the next edge whose start point matches the current edge's end point. Repeat until all edges are ordered. If at any point no connecting edge is found, the hull is broken — show error banner: "Danger zone boundary could not be constructed. Please try different incident coordinates." Stop pipeline.

Extract ordered hull vertices from sorted edges. The last vertex automatically connects back to the first — forming a closed polygon.

---

**Step 8 — Shoelace Area Computation:**

Compute hull area from ordered vertices. Use lng as x and lat as y — add a comment in code explicitly marking this convention:

A_deg = (1/2) x |sum from i=0 to m-1 of (lng_i x lat_(i+1) - lng_(i+1) x lat_i)|

Indices taken modulo m so last vertex connects back to first.

Convert area from square degrees to square meters using dynamic longitude scale factor computed from hull centroid latitude:

lng_scale = 111000 x cos(centroid_lat in radians)
A_m2 = A_deg x 111000 x lng_scale

Store both A_deg and A_m2 — A_deg used for Shoelace validation, A_m2 used for R computation in Stage 2.

---

**Step 9 — Winding Order Normalization:**

Check winding order using the sign of the Shoelace signed area — before taking absolute value. Positive signed area means counterclockwise winding. Negative means clockwise. If clockwise, reverse the vertex order to force counterclockwise winding. All Ray Casting logic assumes counterclockwise winding consistently.

---

**Step 10 — Hull Validation:**

If A_deg = 0 or negative after winding normalization, show error banner and stop pipeline.

If A_m2 < barangay_area_m2 / CONFIG.convexHull.areaThresholdDivisor → hull is too small. Show warning banner: "Incident coordinates are tightly clustered. Patrol spread may be limited. Consider spreading incident coordinates across a wider area." Set Stage 1 status to Warning. Continue pipeline — do not stop.

Barangay area is computed once on load from the road network bounding box: (max_lat - min_lat) x (max_lng - min_lng) converted to m² using the same dynamic scale factor.

---

**Step 11 — Ray Casting Pre-Filtering:**

This step runs after hull validation and winding normalization — never before. This ordering is mandatory.

Check valid candidates cache first. If current hull vertices match cached hull vertices, reuse cached validCandidates and skip Ray Casting.

If cache miss, run Ray Casting on all 914 intersection nodes:

For each intersection node v, cast a ray in a fixed direction — rightward, increasing lng — and count how many hull edges the ray crosses:
- Odd crossings → v is inside hull → add to validCandidates
- Even crossings → v is outside hull → exclude

**Bounding box pre-filter before Ray Casting:**
Reject any node obviously outside the hull bounding box before running full Ray Casting. Expand bounding box by 1e-7 degrees epsilon buffer to avoid floating point edge cases on boundary.

Store result in validCandidates and update validCandidatesHullCache.

If validCandidates is empty after pre-filtering:
- Clear patrol markers and routes from previous run
- Keep hull polygon
- Show error banner: "No road intersections found inside the danger zone. Please plot incident coordinates closer to road intersections or expand the incident area."
- Find 5 nearest intersection nodes to hull centroid that fall outside the hull. Render as distinct pulsing markers. Show tooltip: "Nearest available road intersection — plot incident coordinates near here."
- Stop pipeline

If n capped to 0 after Hole 24 handler, show error banner and stop pipeline.

---

**Output:**

- Hull polygon H — ordered array of vertex coordinate objects with lat and lng
- Hull area A_m2 in square meters
- validCandidates — filtered intersection nodes inside hull

**Stage 1 Trace Panel Summary Contents:**
- Input: X incident coordinates after outlier removal
- Outliers detected and flagged: X points
- Collinearity check: passed / triggered linear handler
- Valid hull edges found: X
- Hull vertices: X
- Hull area: X m²
- Area threshold check: passed / warning
- Valid candidates inside hull: X of 914 intersection nodes
- Runtime: Xms
- Status with message

---

## Section 5: Stage 2 — Hill Climbing Patrol Placement

**Purpose:**
Determine the optimal positions for n patrol units inside the danger zone by maximizing the minimum pairwise Haversine distance between all patrol positions. Uses Hill Climbing heuristic with multiple random restarts.

**Input:**
- Hull polygon H from Stage 1
- Hull area A_m2 in square meters from Stage 1
- validCandidates from Stage 1
- n from user input
- CONFIG.hillClimbing settings

---

**Special Case — n = 1:**

Before any Hill Climbing runs, check if n = 1. If yes, skip Hill Climbing entirely. Place the sole patrol at the valid candidate node most central to the hull — the node with minimum average Haversine distance to all other valid candidates. Compute in a single O(|validCandidates|²) pass. Set S_star to this single node. Log in trace panel: "Single patrol mode — placed at most central intersection node." Proceed directly to Stage 3.

---

**Special Case — n > validCandidates.length:**

Check immediately before Hill Climbing initialization. If n > validCandidates.length, cap n to validCandidates.length. Show warning banner: "Only X valid patrol positions exist inside the danger zone. Number of patrols reduced from Y to X." Update patrol count input field to show capped value. If capped n = 0, show error banner and stop pipeline.

---

**Step 1 — Compute Radius R:**

R = sqrt(A_m2 / |validCandidates|) x CONFIG.hillClimbing.radiusMultiplier

R is in meters — consistent with Haversine distances throughout. Default multiplier k = 2.

---

**Step 2 — Initialization:**

For each restart, generate unique starting positions for n patrols using shuffle-and-slice:

Shuffle the validCandidates array randomly using Math.random(). Use a different random seed per restart — do not use a fixed seed. Take the first n nodes from the shuffled array as starting positions. This guarantees unique starting positions since shuffled array has no duplicates.

Shuffle patrol processing order at the start of each iteration using Math.random(). This prevents systematic bias from always processing patrols in the same order within an iteration.

Log restart number and initial configuration in trace panel full log.

---

**Step 3 — Neighbor Definition:**

For each patrol si, candidate neighbors are all valid candidates within Haversine distance R of si's current position — excluding si's own position and nodes currently occupied by other patrols.

**Bounding box pre-filter:**

Before computing full Haversine distance to any candidate, first check if the candidate falls within a rectangular bounding box of R meters around si:

delta_lat = R / 111000
delta_lng = R / (111000 x cos(si.lat in radians))

Expand bounding box by CONFIG.snapping.boundingBoxEpsilon (1e-7 degrees) on all sides to handle floating point boundary edge cases.

Reject any candidate outside bounding box instantly — no Haversine needed. Only candidates passing bounding box check get evaluated with full Haversine.

Occupied node check: before adding a node to the neighbor set, verify no other patrol currently occupies it. Skip occupied nodes.

---

**Step 4 — Iteration:**

```
iteration = 0
anyPatrolMoved = true

while anyPatrolMoved and iteration < CONFIG.hillClimbing.maxIterations:
    anyPatrolMoved = false
    anyPatrolHadUnoccupiedNeighbor = false

    shuffle patrol processing order

    for each patrol si in shuffled order:
        find neighbors within R — bounding box pre-filter then Haversine
        remove occupied nodes from neighbors

        if neighbors is empty:
            log: "Patrol si: no unoccupied neighbors within R"
            continue

        anyPatrolHadUnoccupiedNeighbor = true

        precompute min pairwise distance excluding si — O(n²) once per patrol

        bestNeighbor = null
        bestMinDist = current global minimum pairwise distance

        for each neighbor v:
            compute Haversine distance from v to all other patrols — O(n)
            new global min = min(min excluding si, min distance from v to others)
            if new global min > bestMinDist:
                bestMinDist = new global min
                bestNeighbor = v

        if bestNeighbor found:
            move si to bestNeighbor
            anyPatrolMoved = true
            log full log: "Patrol si moved from nodeA to nodeB (improved min dist: X → Y meters)"

    if not anyPatrolHadUnoccupiedNeighbor:
        expand R globally by 50%
        log: "All patrols surrounded. Expanding radius R to Xm"
        reset anyPatrolMoved to true to continue iterations

    iteration++

if iteration >= CONFIG.hillClimbing.maxIterations:
    log warning: "Restart X reached maximum iterations without converging. Result may be suboptimal."
    set restart status to Warning
```

---

**Step 5 — Termination and Restart Tracking:**

After each restart terminates, record final patrol positions, final minimum pairwise distance, number of iterations, and whether max iterations was reached.

Compare result to all previously found restart results. If identical patrol node IDs in any order — same configuration found before — log: "Restart X converged to previously found configuration. Solution diversity low — consider increasing radius R in Settings."

Keep the restart with highest minimum pairwise distance as current best.

After all restarts complete, S_star = best result across all restarts. Log: "Best result found at restart X. Min pairwise distance: Y meters."

---

**Step 6 — Multiple Random Restarts:**

Run exactly CONFIG.hillClimbing.restarts (default 10) restarts. Each restart uses Math.random() for initialization — different random positions each restart. Do not use a fixed seed across restarts. Within a single session results will vary between page loads — this is acceptable.

---

**Output:**

- S_star — array of n optimal patrol position node objects with id, lat, lng, and color
- Final minimum pairwise distance in meters
- Best restart index

Render patrol markers on map immediately after Stage 2 completes using setLatLng() for existing markers. Assign patrol colors from predefined palette in order.

**Stage 2 Trace Panel Summary Contents:**
- Valid candidates used: X nodes
- Number of patrols: n
- Radius R: Xm
- Restarts completed: X of CONFIG value
- Best result at restart: X
- Best minimum pairwise distance: Xm
- Any radius expansions: X times
- Any max iteration warnings: X restarts
- Any duplicate configuration warnings: X restarts
- Runtime: Xms
- Status with message

---

## Section 6: Stage 3 — Zone Assignment

**Purpose:**
Assign each crime node to its nearest patrol unit using Haversine distance, producing n patrol zones defining the subset of crime nodes each patrol is responsible for visiting in Stage 4.

**Input:**
- S_star from Stage 2
- P — raw incident coordinate objects from user input
- validCandidates from Stage 1
- Hull diameter — maximum Haversine distance between any two hull vertices — computed once after Stage 1

---

**Step 1 — Silent Snapping — Option C:**

For each raw incident coordinate p in P, find the nearest valid candidate node — intersection nodes inside the hull only. Do not snap to the full 3,613 node set — restrict to validCandidates to guarantee all snapped positions are inside the hull.

**Bounding box pre-filter before Haversine:**

For each crime node p, define an initial search radius of 500 meters. Convert to degree bounds using dynamic scale factor. Check all valid candidates against bounding box first. Only candidates inside bounding box get full Haversine evaluation. If no candidate found within 500 meters, expand by 50% and retry. Cap expansion at hull diameter — if no candidate found within hull diameter, log: "Crime node at (lat, lng) has no reachable road intersection inside the danger zone. Point excluded." Remove from computation — visual marker stays on map.

Visual marker stays at original clicked position throughout — user never sees snapping.

**Duplicate snapping check:**

After snapping all crime nodes, check for duplicate snapped positions — two crime nodes mapped to the same valid candidate node. If duplicates found, merge them — keep one, discard other. Log: "Crime node merged with nearby incident at node nX." Visual markers for both remain on map.

**Zero distance waypoint check:**

After snapping, check if any crime node's snapped position matches its assigned patrol's position exactly. If yes, log: "Crime node already at patrol position — zero distance waypoint for patrol si."

---

**Step 2 — Zone Assignment:**

For each snapped crime node cj, compute Haversine distance to every patrol position in S_star. Assign cj to the nearest patrol:

assign(cj) = argmin over si in S_star of haversineDistance(cj.lat, cj.lng, si.lat, si.lng)

**Tiebreaker:**
If two patrols are exactly equidistant from a crime node, assign to the patrol with lower patrol index — the patrol assigned its position earlier during Hill Climbing. This avoids geographic bias from node ID ordering.

Produce n patrol zones Z1 through Zn:

Zi = { cj in P | assign(cj) = si }

---

**Step 3 — Zone Cap Enforcement:**

After zone formation, check each zone size against CONFIG.tsp.maxCrimeNodesPerZone (default 10).

If any zone exceeds the cap:
- Sort crime nodes in that zone by Haversine distance to their assigned patrol — ascending
- Keep only the nearest maxCrimeNodesPerZone nodes
- Excluded nodes retain visual markers but with grey style — indicating unassigned
- Log warning: "Zone for patrol si capped at X nodes. Y nodes excluded. Consider adding more patrols."
- Set Stage 3 status to Warning

---

**Step 4 — Special Case Detection Per Zone:**

**Empty zone — |Zi| = 0:**
- Patrol si stays stationary at its assigned position
- No route generated regardless of deployment mode
- Render si marker as hollow circle with dashed border and S label
- Log: "Patrol si: empty zone — stationary deployment"
- Show warning banner if any empty zones exist: "X patrol(s) have no assigned crime nodes and will remain stationary."

**Single node zone — |Zi| = 1:**
- Route: si → c1 → si
- Render as dashed line between si and c1
- Total distance: 2 x haversineDistance(si, c1)
- Skip TSP for this zone
- Log: "Patrol si: single node zone — direct visit route. Distance: Xm"

**Multiple nodes — |Zi| > 1:**
- Proceed to Stage 4 Backtracking TSP for this zone

---

**Step 5 — Aggregate Snapping Summary:**

After all snapping is complete, compute average and maximum snapping distance across all crime nodes in meters. Log in trace panel Stage 3 summary: "X crime nodes snapped. Average snapping distance: Xm. Maximum snapping distance: Xm." If maximum snapping distance exceeds 200 meters, set Stage 3 status to Warning.

---

**Step 6 — Defensive Empty Candidates Check:**

At the start of Stage 3, assert that validCandidates is non-empty before proceeding. If empty, show error banner: "No valid patrol positions available. Please recalculate." Stop pipeline.

---

**Step 7 — Zone Visualization:**

Draw thin dashed colored lines from each crime node marker to its assigned patrol marker using the patrol's assigned color. Opacity 0.4, weight 1, dashArray "4 6". These lines are rendered below patrol markers and crime node markers in the layer order.

In roaming mode, zone lines are replaced by TSP route polylines after Stage 4 completes. In stationary mode, zone lines remain visible as the final output.

---

**Output:**

- zones — array of n zone arrays each containing snapped crime node objects
- Zone classification per patrol — empty, single, multiple
- Aggregate snapping statistics

Log: "Zone assignment using final optimized patrol positions from Hill Climbing restart X."

**Stage 3 Trace Panel Summary Contents:**
- Crime nodes processed: X
- Crime nodes excluded due to no nearby intersection: X
- Duplicate snapped nodes merged: X
- Zero distance waypoints: X
- Average snapping distance: Xm
- Maximum snapping distance: Xm
- Zone summary per patrol: "Patrol si: X nodes" for each patrol
- Empty zones: X patrols stationary
- Single node zones: X patrols direct visit
- Multiple node zones: X patrols proceeding to TSP
- Zones capped: X zones reduced to maxCrimeNodesPerZone
- Runtime: Xms
- Status with message

---

## Section 7: Stage 4 — Backtracking TSP and Stage 4.1 — Dijkstra Road Path Computation

**Purpose:**
Stage 4 generates the optimal closed-loop roaming circuit for each patrol unit through their assigned crime nodes. Stage 4.1 computes actual road-following paths between consecutive TSP waypoints using Dijkstra's algorithm. Stage 4 is triggered exclusively when roaming deployment mode is selected.

**Input:**
For each patrol si with |Zi| > 1:
- Starting position si from S_star
- Assigned crime node subset Zi from Stage 3
- nodeMap and adjacencyList from road network load
- dijkstraCache — shared across all patrol zones this pipeline run

---

**Stage 4 Execution Per Patrol:**

Run Stage 4 independently for each patrol zone with |Zi| > 1. Process each patrol sequentially using async yield points between patrol zones to keep UI responsive.

---

**Step 1 — Precompute Distance Matrix:**

Before backtracking search begins, compute shortest road network distance between every pair of nodes in {si} ∪ Zi using Dijkstra's algorithm.

**Dijkstra single-source optimization:**

Run Dijkstra once per unique source node — not once per pair. For a zone with crime nodes {c1, c2, c3} and patrol start si, run Dijkstra from si once getting distances and paths to all nodes including c1, c2, c3. Run from c1 once getting distances to c2, c3, si. Run from c2 once getting c3 and si. Run from c3 getting si. Total: k+1 Dijkstra runs instead of k(k-1)/2.

**Cache check before every Dijkstra call:**

Before running Dijkstra for any source node, check dijkstraCache using normalized key — numeric sort, pipe separator: "n89|n234". If hit, use cached distance and path. If miss, run Dijkstra and store result. Cache stores both distance in meters and full intermediate node path array.

Distance matrix D is symmetric — D[a][b] = D[b][a] on undirected graph. Store only once — cache lookup handles both directions via normalized key.

---

**Stage 4.1 — Dijkstra Algorithm:**

Dijkstra finds the shortest weighted path from a source node to all other nodes in the road network graph. Uses a binary min-heap priority queue for O((V+E)logV) performance.

**Binary min-heap implementation:**
Implement a complete binary min-heap as a supporting data structure. Required operations: insert with priority, extract minimum, decrease key. Implement as a separate class in dijkstra.js. Every Dijkstra call uses this heap — never a sorted array. Without binary min-heap, Dijkstra degrades to O(V²) — do not use array sort as priority queue.

**Dijkstra execution:**

Initialize distance array — all Infinity except source = 0. Initialize parent map — all null. Insert source node into heap with priority 0.

```
while heap is not empty:
    current = heap.extractMin()
    for each neighbor of current in adjacencyList:
        newDist = distance[current] + neighbor.weight
        if newDist < distance[neighbor.nodeId]:
            distance[neighbor.nodeId] = newDist
            parent[neighbor.nodeId] = current
            heap.insert or decreaseKey neighbor
```

**Dijkstra traverses the full road network graph:**
Dijkstra runs from intersection node sources but traverses all 3,613 nodes and 3,971 edges including non-intersection intermediate nodes. Do not restrict Dijkstra to intersection nodes only — intermediate nodes are essential for finding correct road paths through the network.

**Path reconstruction:**
After Dijkstra completes, reconstruct path from source to any destination by following parent pointers from destination back to source then reversing:

```
function reconstructPath(source, destination, parent):
    path = [destination]
    current = destination
    while current != source:
        current = parent[current]
        if current is null:
            return null  // no path exists
        path.unshift(current)
    return path  // ordered from source to destination
```

**No path found:**
If reconstructPath returns null for any pair, that crime node is unreachable from the patrol's starting position. Remove it from the zone. Log: "Crime node unreachable from patrol position via road network — excluded from route." If removing it empties the zone, treat as empty zone — patrol stays stationary.

**Dijkstra returns for each source node:**
- distances — map of node ID to shortest distance in meters from source
- paths — map of node ID to full intermediate node sequence from source

Store both in dijkstraCache under normalized key.

Time complexity per call: O((V+E)logV) = approximately O(89,500) operations with binary min-heap.

---

**Step 2 — Build Distance Matrix D:**

From Dijkstra results, build complete distance matrix for TSP. Matrix size: (k+1) x (k+1).

If any D[a][b] = Infinity — no road path exists — remove the unreachable crime node from the zone per the no path found handler above.

---

**Step 3 — Backtracking TSP Search:**

Find permutation pi* of crime nodes in Zi minimizing total closed-loop circuit distance:

pi* = argmin over pi of [ D[si][pi_1] + sum from j=1 to k-1 of D[pi_j][pi_(j+1)] + D[pi_k][si] ]

**Initialize:**
- bestCircuit = Infinity
- optimalSequence = []
- currentRoute = []
- visited = empty set

**Backtracking search:**

```
function backtrack(currentNode, accumulatedDist, visited, currentRoute):

    if accumulatedDist >= bestCircuit:
        return  // prune

    if visited.size == k:
        totalCircuit = accumulatedDist + D[currentNode][si]
        if totalCircuit < bestCircuit:
            bestCircuit = totalCircuit
            optimalSequence = copy of currentRoute
        return

    for each unvisited crime node c:
        visited.add(c)
        currentRoute.push(c)
        backtrack(c, accumulatedDist + D[currentNode][c], visited, currentRoute)
        currentRoute.pop()
        visited.delete(c)

// Initial call
backtrack(si, 0, empty set, [])
```

**k=2 special case:**
With exactly 2 crime nodes, both permutations produce identical circuit distance due to symmetry. Log: "2 crime nodes in zone — both visiting sequences are equivalent. First sequence selected."

Time complexity: O(k!) worst case per patrol. Zone cap of CONFIG.tsp.maxCrimeNodesPerZone (default 10) enforces tractability.

---

**Step 4 — Route Rendering via Dijkstra Paths:**

After optimal sequence is found, render the route following actual road edges — not straight lines. For each consecutive pair in the circuit including the return leg:

Full circuit pairs: (si, pi_1), (pi_1, pi_2), ..., (pi_(k-1), pi_k), (pi_k, si)

The return leg (pi_k, si) must be explicitly rendered — do not omit it.

For each pair (A, B), retrieve the full intermediate node path from dijkstraCache. Convert path node IDs to lat/lng coordinates using nodeMap. Render as Leaflet polyline using patrol color. The polyline connects all intermediate nodes in sequence — not just A and B directly. This ensures routes follow actual road edges and never cut through buildings.

**Overlap tracking:**
After all patrol routes rendered, track edge usage across all routes. For each consecutive pair of nodes in each rendered path, create normalized edge key — extract numeric part of node ID, sort smaller first, join with pipe: "n89|n234". Increment edge usage counter.

Render overlap overlay as a separate layer on top of all patrol route polylines — do not modify original route colors:
- 2 patrols on same edge → semi-transparent orange overlay polyline
- 3+ patrols on same edge → semi-transparent red overlay polyline

---

**Step 5 — Route Direction Indicators:**

Add direction arrows along each patrol route polyline using Leaflet Polyline Decorator plugin. Small arrows at regular intervals indicate travel direction. Use same color as patrol route polyline.

---

**Output Per Patrol:**

- Optimal visiting sequence: si → pi_1 → pi_2 → ... → pi_k → si
- Total circuit distance in meters
- Full road-following route rendered on map as colored polyline with direction arrows
- Overlap overlay rendered as separate layer

**Stage 4 Trace Panel Summary Contents:**
- Patrols with TSP routes: X
- Patrols stationary (empty zone): X
- Patrols with direct visit (single node): X
- Per patrol: "Patrol si: optimal circuit: nA (lat,lng) → nB (lat,lng) → nC (lat,lng) → nA (lat,lng). Total: Xm"
- Total Dijkstra calls across all patrols: X
- Total cache hits: X
- Route overlap: X edges with 2 patrols, Y edges with 3+ patrols
- Runtime: Xms
- Status with message

---

**Pipeline Complete — Final Actions:**

After Stage 4 completes and all routes are rendered:
- Remove zone assignment lines — replaced by route polylines in roaming mode
- Update pipeline summary in trace panel bottom
- Auto-scroll trace panel to bottom
- Re-enable Recalculate button and map click events
- Remove loading spinner
- Restore button text to "Recalculate (Ctrl+Enter)"

---

## Section 8: Special Case Handlers, Edge Cases, and Validation

**Purpose:**
This section consolidates all special case handlers, edge case behaviors, and validation logic. Claude Code must implement every handler listed here explicitly — none are optional.

---

**Pre-Pipeline Validation:**

| Condition | Type | Message | Action |
|---|---|---|---|
| n = 0, negative, or non-integer | Error | "Number of patrols must be a positive whole number." | Stop pipeline |
| n is decimal | Error | "Number of patrols must be a whole number." | Stop pipeline |
| |P| = 0 | Error | "No incident coordinates plotted. Please click the map to add incident coordinates." | Stop pipeline |
| |P| = 1 | Error | "At least 2 incident coordinates are needed. Please plot more points." | Stop pipeline |
| Roaming mode and |P| = 0 | Error | "Roaming mode requires at least one incident coordinate. Plot incidents or switch to Stationary mode." | Stop pipeline |

---

**Stage 1 Special Cases:**

| Condition | Type | Message | Action |
|---|---|---|---|
| Outlier removal reduces P below 3 | Warning | "Outlier removal reduced incident points below minimum. Plot more points or adjust outlier sensitivity in Settings." | Stop — wait for user action |
| |P| = 2 after outlier removal | Warning | "Only 2 incident coordinates plotted. Patrols placed along incident line." | Linear handler — stop after |
| All points collinear | Warning | "All incident coordinates are collinear. Patrols placed along the incident line." | Linear handler — stop after |
| Fewer than 3 valid hull edges | Warning | "Incident coordinates are too nearly collinear to form a valid danger zone. Patrols placed along incident line." | Linear handler — stop after |
| Edge ordering fails | Error | "Danger zone boundary could not be constructed. Please try different incident coordinates." | Stop pipeline |
| Hull area = 0 or negative | Error | "Danger zone has zero area. Please try different incident coordinates." | Stop pipeline |
| Hull area below threshold | Warning | "Incident coordinates are tightly clustered. Patrol spread may be limited." | Continue pipeline |
| validCandidates empty | Error | "No road intersections found inside the danger zone. Please plot incident coordinates closer to road intersections or expand the incident area." | Stop — highlight nearest intersections outside hull |
| n capped to 0 after Hole 24 | Error | "No valid patrol positions available for the requested configuration." | Stop pipeline |

---

**Linear Special Case Handler — complete behavior:**

Triggered by: |P| = 2, all collinear, fewer than 3 valid hull edges.

1. Fit line through all non-outlier incident points
2. Compute total line length L using Haversine between first and last point
3. Compute patrol positions: position_k = (k x L) / (n + 1) for k = 1 to n
4. Place n patrol markers equidistantly along the line
5. Show appropriate warning banner per trigger condition
6. Set Stage 1 status to Warning
7. Log in trace panel: incident count, line length, patrol spacing, patrol positions
8. Stop pipeline — do not proceed to Stage 2, 3, or 4

---

**Stage 2 Special Cases:**

| Condition | Type | Message | Action |
|---|---|---|---|
| n = 1 | — | "Single patrol mode — placed at most central intersection node." | Skip Hill Climbing — place at centroid node — proceed to Stage 3 |
| n > validCandidates.length | Warning | "Only X valid patrol positions exist. Number of patrols reduced from Y to X." | Cap n — update input field — continue |
| Zero neighbors for any patrol | Warning | "Patrol si: no unoccupied neighbors within radius R." | Expand R by 50% — log expansion — continue |
| All patrols surrounded simultaneously | Warning | "All patrols surrounded. Expanding radius R to Xm." | Expand R globally — reset iteration — continue |
| Max iterations reached on any restart | Warning | "Restart X reached maximum iterations without converging. Result may be suboptimal." | Keep best result — continue to next restart |
| All restarts converge to same configuration | Warning | "Restart X converged to previously found configuration. Solution diversity low — consider increasing radius R in Settings." | Log only — continue |
| validCandidates empty — defensive check | Error | "No valid patrol positions available. Please recalculate." | Stop pipeline |

---

**Stage 3 Special Cases:**

| Condition | Type | Message | Action |
|---|---|---|---|
| Crime node has no intersection within hull diameter | Warning | "Crime node at (lat, lng) has no reachable road intersection inside the danger zone. Point excluded." | Remove from computation — keep visual marker |
| Duplicate snapped positions | Warning | "Crime node merged with nearby incident at node nX." | Keep one — discard other — keep both visual markers |
| Zero distance waypoint | — | "Crime node already at patrol position — zero distance waypoint for patrol si." | Log only — continue |
| Zone exceeds maxCrimeNodesPerZone | Warning | "Zone for patrol si capped at X nodes. Y nodes excluded." | Keep nearest X — grey markers for excluded — continue |
| Maximum snapping distance > 200m | Warning | Shown in trace panel summary only | Set Stage 3 status to Warning |
| Empty zone — |Zi| = 0 | Warning | "X patrol(s) have no assigned crime nodes and will remain stationary." | Patrol stationary — hollow marker with S label |
| Single node zone — |Zi| = 1 | — | "Patrol si: single node zone — direct visit route. Distance: Xm." | Direct route — dashed line — skip TSP |
| validCandidates empty — defensive check | Error | "No valid patrol positions available. Please recalculate." | Stop pipeline |

---

**Stage 4 Special Cases:**

| Condition | Type | Message | Action |
|---|---|---|---|
| Unreachable crime node — Dijkstra returns null | Warning | "Crime node unreachable from patrol position via road network — excluded from route." | Remove from zone — if zone empties treat as empty zone |
| k = 2 in any zone | — | "2 crime nodes in zone — both visiting sequences are equivalent. First sequence selected." | Log only — continue |
| All zones empty after exclusions | Error | "No reachable crime nodes found for any patrol. Check road network connectivity." | Stop pipeline — show error banner |

---

**Map State Reset Per Trigger:**

```javascript
clearMapResults({
    clearHull: false,
    clearPatrols: false,
    clearRoutes: false,
    clearZoneLines: false,
    clearNearestHighlights: false
})
```

| Trigger | clearHull | clearPatrols | clearRoutes | clearZoneLines | clearNearestHighlights |
|---|---|---|---|---|---|
| Linear handler | true | true | true | true | false |
| Empty valid candidates | false | true | true | true | false |
| Hull area zero/negative | true | true | true | true | false |
| Edge ordering failure | true | true | true | true | false |
| n capped to 0 | false | true | true | true | false |
| Warning only cases | false | false | false | false | false |

Crime node markers are never cleared by any pipeline special case handler.

---

**Nearest Intersection Highlight:**

When validCandidates is empty after pre-filtering, find the 5 nearest intersection nodes to the hull centroid that fall outside the hull. Render as distinct pulsing markers. Show tooltip on hover: "Nearest available road intersection — plot incident coordinates near here." Store in separate layer — clearable via clearNearestHighlights flag.

---

**Input Validation — Crime Node Plotting:**

Before adding any clicked point to P:
1. Duplicate check — within 1e-7 degrees of existing point → show warning banner — do not add
2. Hull membership check — only after hull exists — outside hull → show warning banner — do not add
3. Neither check fails → add to P and plot marker

Before bulk import:
1. Parse all lines — skip malformed — count skipped
2. Validate lat/lng ranges — lat -90 to 90, lng -180 to 180
3. Check against Commonwealth bounding box — warn if outside but import anyway
4. Run outlier detection immediately — flag outliers with distinct marker style
5. Show confirmation: "Importing will replace X existing points. Continue?"
6. On confirm — clear existing markers — plot new ones
7. Clear textarea — show success message for 3 seconds

---

**Error Boundary:**

Wrap entire pipeline execution in try-catch. On any unexpected uncaught error:
- Show generic error banner: "An unexpected error occurred. Please check your inputsand try again."
- Log full error stack trace to browser console
- Re-enable Recalculate button and map click events
- Remove loading spinner
- Never leave UI in disabled state due to unexpected error

---

**Undo Last Removed Crime Node:**

Store last removed crime node in lastRemovedPoint variable. Show Undo Last Action button after any crime node removal. On undo click — restore lastRemovedPoint to P and re-plot marker. Clear lastRemovedPoint after undo. Hide Undo button if lastRemovedPoint is null.

---

**Reset Confirmation:**

On Reset button click — show confirmation dialog: "Reset will clear all incident coordinates and results. Continue?" On confirm — clear all crime node markers, all pipeline results, reset P to empty, reset lastRemovedPoint to null, hide Undo button, clear all banners, clear trace panel. On cancel — do nothing.

---

**Browser Navigation Warning:**

Add beforeunload event listener. If P.length > 0 or pipeline results exist — show browser dialog: "You have unsaved patrol deployment data. Leave anyway?" Do not show if P is empty and no results exist.

---

## Section 9: Build Order and GitHub Integration

**GitHub Repository Setup — First Action:**

Before writing any code, create a public GitHub repository named PatrolPoint on the connected GitHub account. Initialize with a README.md. Clone to C:\Users\Gavinn\Documents\DAA\patrolpoint. This becomes the working directory for all subsequent work.

Create the complete file structure immediately after cloning. road_network.json already exists at C:\Users\Gavinn\Documents\DAA\patrolpoint\data\road_network.json — do not overwrite or regenerate it.

All file references use relative paths — never absolute paths. road_network.json is always referenced as ./data/road_network.json.

---

**Commit Convention:**

```
[Stage X] Description of what was completed

Examples:
[Setup] Initialize project structure and GitHub repository
[Stage 1] Implement Brute Force Convex Hull with collinearity check
[Stage 2] Implement Hill Climbing with multiple restarts
[Stage 3] Implement Zone Assignment with silent snapping
[Stage 4] Implement Backtracking TSP with Dijkstra road paths
[UI] Add algorithm trace panel and settings modal
[Fix] Resolve empty valid candidates edge case
```

Push to GitHub after every commit.

---

**Build Step 1 — Project Foundation:**

1. index.html — complete HTML structure with all UI elements defined. All sections present even if not yet functional.
2. style.css — complete styling. Responsive layout. Map fills left side. Control panel fixed width on right. All UI states styled. Patrol colors defined as CSS variables.
3. main.js foundation — CONFIG object, all state variables declared, canonical haversineDistance function, road_network.json fetch with error handling, nodeMap and adjacencyList construction, intersection node pre-computation, soft cap n_max computation, network connectivity check, Leaflet map initialization with Commonwealth center and zoom constraints, Commonwealth administrative boundary rendered, loading state management.

Verify: page loads, map renders centered on Commonwealth, administrative boundary visible, n_max displayed in patrol input placeholder, loading spinner appears then disappears after road_network.json loads, Recalculate button disabled during load then enabled after.

Commit: [Setup] Initialize project structure and GitHub repository

---

**Build Step 2 — Crime Node Interaction:**

1. Map click handler with duplicate check and hull membership check
2. Crime node marker click removal with 300ms visual confirmation and undo functionality
3. P array management
4. Disable map click events during pipeline execution flag
5. Bulk coordinate import — textarea, parse, validate, outlier flag, confirmation dialog, replace behavior, success message, textarea clear
6. Browser navigation warning
7. Reset button with confirmation dialog

Verify: clicking map plots markers, clicking markers removes them with flash, undo restores last removed, bulk import replaces existing markers with confirmation, reset clears everything with confirmation, navigation warning appears when P is non-empty.

Commit: [UI] Implement crime node plotting and bulk coordinate import

---

**Build Step 3 — Stage 1 Convex Hull:**

1. convexHull.js — complete implementation including outlier detection, collinearity check with epsilon, linear special case handler, brute force hull computation, edge deduplication, edge ordering, edge count validation, Shoelace area with unit conversion, winding order normalization, hull area validation
2. Ray Casting pre-filtering with bounding box pre-filter and epsilon buffer
3. Valid candidates caching
4. Nearest intersection highlight for empty valid candidates case
5. All Stage 1 special case handlers with correct banner messages and map state resets
6. Stage 1 trace panel summary and full log
7. Hull polygon rendered on map — setLatLngs for in-place update
8. Per-stage loading indicator text update

Verify: plotting 3+ non-collinear points and clicking Recalculate renders hull polygon. Plotting 2 points triggers linear handler with warning. Plotting collinear points triggers linear handler. Hull polygon updates in place on recalculate. Trace panel shows Stage 1 summary with correct metrics. Error cases show correct banners.

Commit: [Stage 1] Implement Brute Force Convex Hull with all special case handlers

---

**Build Step 4 — Stage 2 Hill Climbing:**

1. hillClimbing.js — complete implementation including n=1 special case, n > validCandidates cap, R computation, shuffle-and-slice initialization with unique positions, bounding box pre-filter with epsilon buffer, neighbor search with occupied node skip, O(n) objective evaluation optimization, iteration loop with patrol order shuffle, radius expansion for zero neighbors, max iteration cap, restart loop with duplicate detection, best result tracking
2. Patrol markers rendered on map with patrol colors — setLatLng for in-place update
3. Stationary vs roaming marker visual distinction
4. Stage 2 trace panel summary and full log
5. All Stage 2 special case handlers

Verify: Recalculate after Stage 1 places n patrol markers inside hull. Markers animate to new positions on recalculate. Trace panel shows restart count, best restart, min pairwise distance. n=1 places single patrol at central node. n > validCandidates shows warning and caps. Stationary markers show hollow circle with S label.

Commit: [Stage 2] Implement Hill Climbing patrol placement with multiple restarts

---

**Build Step 5 — Stage 3 Zone Assignment:**

1. zoneAssignment.js — complete implementation including defensive empty candidates check, silent snapping with bounding box pre-filter and adaptive expansion, hull diameter computation, snapping cap at hull diameter, duplicate snapped node deduplication, zero distance waypoint detection, zone formation, tiebreaker by patrol index, zone cap enforcement with grey markers for excluded nodes, empty zone detection, single node direct route computation, aggregate snapping statistics
2. Zone assignment lines rendered on map
3. Empty zone patrol markers updated to stationary style
4. Single node dashed route lines rendered
5. Stationary mode output — show patrol positions and zone lines as final result
6. Stage 3 trace panel summary and full log
7. All Stage 3 special case handlers

Verify: after Recalculate in stationary mode, zone assignment lines connect crime nodes to their assigned patrol in matching colors. Empty zones show stationary marker. Single node zones show dashed line. Trace panel shows per-patrol zone summary. Aggregate snapping distances shown in summary.

Commit: [Stage 3] Implement Zone Assignment with silent snapping

---

**Build Step 6 — Stage 4 TSP and Dijkstra:**

1. dijkstra.js — complete implementation including binary min-heap class, Dijkstra algorithm with parent tracking, path reconstruction function, full graph traversal including non-intersection intermediate nodes, cache integration
2. tsp.js — complete implementation including distance matrix construction using Dijkstra single-source optimization, cache check before every Dijkstra call, backtracking search with pruning, k=2 logging, unreachable node exclusion, optimal sequence output
3. Route rendering using full Dijkstra intermediate node paths — not straight lines
4. Explicit return leg rendering — (pi_k, si) must be rendered
5. Overlap tracking with normalized numeric edge keys — separate overlay layer
6. Zone lines removal when routes rendered in roaming mode
7. Direction arrows using Leaflet Polyline Decorator
8. Stage 4 trace panel summary and full log
9. All Stage 4 special case handlers
10. Pipeline complete actions — scroll trace panel, re-enable controls, remove spinner

Verify: switching to roaming mode and recalculating shows TSP routes following actual roads — not straight lines through buildings. Routes close back to starting patrol position. Overlapping edges show orange or red overlay. Trace panel shows optimal sequence per patrol with coordinates. Dijkstra cache hit count shown in summary. Direction arrows visible on routes.

Commit: [Stage 4] Implement Backtracking TSP with Dijkstra road path rendering

---

**Build Step 7 — Settings Modal and Trace Panel Polish:**

1. Settings modal — gear icon, slide-in overlay, all CONFIG values editable, Apply and Cancel and Reset to Defaults buttons, always shows current CONFIG values on open
2. Trace panel — collapsible per stage, expand/collapse state preserved across recalculations, auto-scroll to bottom on pipeline complete, node IDs shown with coordinates, stage runtimes shown, pipeline total runtime shown
3. Map legend — fixed bottom-left corner
4. Ctrl+Enter keyboard shortcut for Recalculate
5. Warning banner consolidation — single banner with list format for multiple warnings
6. Leaflet map resize handler — map.invalidateSize() on window resize
7. Commonwealth boundary permanent rendering verification

Verify: settings modal opens and closes correctly, CONFIG values update on Apply, pipeline uses updated CONFIG on next Recalculate, trace panel expand/collapse state preserved, auto-scroll works, keyboard shortcut triggers Recalculate, multiple warnings consolidate into single banner, map resizes correctly.

Commit: [UI] Settings modal, trace panel polish, and final UI refinements

---

**Build Step 8 — README and GitHub Pages:**

1. Write README.md including:
   - Project title and one-sentence description
   - Problem statement — why PatrolPoint exists
   - Algorithm pipeline — Convex Hull, Hill Climbing, Zone Assignment, TSP, Dijkstra
   - Screenshot or GIF of system running
   - How to run locally — just open index.html in browser
   - Live demo link — GitHub Pages URL
   - Tech stack
   - Known limitations

2. Enable GitHub Pages in repository settings — deploy from main branch root

3. Verify live demo URL works — map loads, road network loads, pipeline runs correctly on deployed version

Commit: [Docs] Complete README and enable GitHub Pages deployment

---

**Testing Checklist — Run After Every Build Step:**

Basic functionality:
- Page loads without console errors
- road_network.json loads successfully
- Recalculate button disabled during load then enabled
- n_max shown in patrol input placeholder

Stage 1 tests:
- Import 5 non-collinear points — hull polygon renders correctly
- Import 2 points — linear handler triggers with warning
- Import 3 collinear points (e.g. 14.700, 121.090 / 14.701, 121.091 / 14.702, 121.092) — linear handler triggers
- Import 1 obvious outlier among 5 clustered points — outlier flagged with distinct marker

Stage 2 tests:
- n=1 — single patrol placed at central node
- n=5 — 5 patrol markers inside hull spread apart
- n > validCandidates count — warning shown, n capped
- Change n and recalculate — markers animate to new positions

Stage 3 tests:
- Stationary mode — zone lines visible, no routes
- Empty zone — patrol shows stationary marker and S label
- Single node zone — dashed line route

Stage 4 tests:
- Roaming mode — routes follow actual roads, not straight lines
- Routes close back to patrol starting position
- Overlapping routes show orange/red overlay
- Direction arrows visible

Edge case tests:
- Import coordinates outside Commonwealth — warning shown
- Click same spot twice — duplicate warning shown
- n=0 — error shown, pipeline blocked
- Decimal n — error shown, pipeline blocked
- Reset — confirmation shown, everything cleared
- Navigate away — browser warning shown

---

**Performance Targets:**

Full pipeline should complete in under 3 seconds for:
- 20 crime nodes
- n=10 patrols
- CONFIG defaults

If any pipeline run exceeds 3 seconds, identify bottleneck stage from trace panel runtimes and optimize before proceeding to next build step.

---

**Post-Build Portfolio Actions — remind developer after build is complete:**

1. Record a screen capture demo of the system running — show incident plotting, hull generation, patrol placement, roaming mode with TSP routes, settings adjustment, bulk import
2. Upload demo to YouTube and add link to README
3. Add PatrolPoint to resume under Projects with one-sentence description, specific algorithms used, and tech stack
4. Verify GitHub Pages live demo is publicly accessible and add URL to resume
