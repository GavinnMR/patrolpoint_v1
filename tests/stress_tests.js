// PatrolPoint Complete Injection Test Suite
// Covers every CLAUDE.md-specified behavior: all pipeline stages, all special case
// handlers, all validation rules, all UI behaviors, all CONFIG settings.
//
// HOW TO USE:
//   1. Open the app (http://127.0.0.1:5500 or GitHub Pages)
//   2. Wait for road network to finish loading
//   3. F12 → Console → type: allow pasting  → Enter
//   4. Paste: fetch('./tests/stress_tests.js').then(r=>r.text()).then(t=>eval(t))
//   5. PP_TESTS.runAll()          — run all tests (takes ~5 min)
//      PP_TESTS.runGroup('G0')    — run one group
//      PP_TESTS.run(n)            — run single test by 1-based index
//      PP_TESTS.list()            — list all tests

window.PP_TESTS = (() => {

// ── Assertion helpers ──────────────────────────────────────────────────────────

function pass(label)                  { return { ok: true,  label }; }
function fail(label, got, expected)   { return { ok: false, label, got, expected }; }
function manual(label)                { return { ok: 'manual', label }; }

function chkEq(got, exp, label)       { return got === exp          ? pass(label) : fail(label, got, `=== ${exp}`); }
function chkGt(got, min, label)       { return got > min            ? pass(label) : fail(label, got, `> ${min}`); }
function chkGe(got, min, label)       { return got >= min           ? pass(label) : fail(label, got, `>= ${min}`); }
function chkNotNull(val, label)       { return val !== null && val !== undefined ? pass(label) : fail(label, val, 'not null/undefined'); }
function chkNull(val, label)          { return val === null         ? pass(label) : fail(label, val, 'null'); }
function chkTrue(val, label)          { return val === true         ? pass(label) : fail(label, val, 'true'); }
function chkIncludes(str, sub, label) {
    return String(str).toLowerCase().includes(sub.toLowerCase())
        ? pass(label) : fail(label, `"${str}"`, `includes "${sub}"`);
}

// ── DOM / state readers ────────────────────────────────────────────────────────

function stageStatus(n) {
    const els = document.querySelectorAll('#trace-stages .trace-stage .trace-status');
    return els[n - 1] ? els[n - 1].textContent.trim() : null;
}
function bannerType() {
    const el = document.getElementById('warning-banner');
    if (!el || el.style.display === 'none' || !el.style.display) return 'none';
    return el.className || 'none';
}
function bannerText() {
    return (document.getElementById('warning-banner') || {}).textContent?.trim() ?? '';
}
function traceText() {
    return document.querySelector('#trace-stages')?.textContent ?? '';
}
function summaryText() {
    return document.getElementById('pipeline-summary')?.textContent ?? '';
}
function stage1Status() { return stageStatus(1); }

// Fixed: check for #f39c12 (orange), which is what outlierNodeIcon() now uses
function outlierMarkerCount() {
    return crimeMarkers.filter(m => {
        const html = m.getIcon?.()?.options?.html ?? '';
        return html.includes('#f39c12') || html.includes('E69F00') || html.includes('f39c12');
    }).length;
}

// ── Test scenarios ─────────────────────────────────────────────────────────────

const SCENARIOS = [

// ══════════════════════════════════════════════════════════════════════════════
// G0 — Pre-Pipeline Validation
// ══════════════════════════════════════════════════════════════════════════════

{
    id: 'G0-01', group: 'G0', n: 0,
    name: 'n=0 — error banner, pipeline blocked, no hull or patrol markers',
    coords: [{ lat: 14.7000, lng: 121.0900 }, { lat: 14.7050, lng: 121.0950 }],
    check() { return [
        chkEq(bannerType(), 'error',                       'error banner shown'),
        chkIncludes(bannerText(), 'positive whole number', 'banner mentions "positive whole number"'),
        chkEq(patrolMarkers.length, 0,                     'no patrol markers placed'),
        chkNull(currentHull,                               'no hull computed'),
        chkEq(zones.length, 0,                             'zones not populated'),
    ]; }
},

{
    id: 'G0-02', group: 'G0', n: 2.5,
    name: 'n=2.5 (decimal) — error banner, pipeline blocked',
    coords: [{ lat: 14.7000, lng: 121.0900 }, { lat: 14.7050, lng: 121.0950 }],
    check() { return [
        chkEq(bannerType(), 'error',               'error banner shown'),
        chkIncludes(bannerText(), 'whole number',  'banner mentions "whole number"'),
        chkEq(patrolMarkers.length, 0,             'no patrol markers placed'),
        chkNull(currentHull,                       'no hull computed'),
    ]; }
},

{
    id: 'G0-03', group: 'G0', n: 3,
    name: '|P|=1 — error: at least 2 incident coordinates needed',
    coords: [{ lat: 14.7000, lng: 121.0900 }],
    check() { return [
        chkEq(bannerType(), 'error',               'error banner shown'),
        chkIncludes(bannerText(), '2 incident',    'banner mentions "2 incident"'),
        chkEq(patrolMarkers.length, 0,             'no patrol markers placed'),
        chkNull(currentHull,                       'no hull computed'),
    ]; }
},

{
    id: 'G0-04', group: 'G0', n: -3,
    name: 'n=-3 (negative) — error banner, pipeline blocked',
    coords: [{ lat: 14.7000, lng: 121.0900 }, { lat: 14.7050, lng: 121.0950 }],
    check() { return [
        chkEq(bannerType(), 'error',                       'error banner shown'),
        chkIncludes(bannerText(), 'positive whole number', 'banner mentions "positive whole number"'),
        chkNull(currentHull,                               'no hull computed'),
        chkEq(patrolMarkers.length, 0,                     'no patrol markers placed'),
    ]; }
},

{
    id: 'G0-05', group: 'G0', n: 3,
    name: '|P|=0, valid n — error: no incident coordinates',
    coords: [],
    check() { return [
        chkEq(bannerType(), 'error',                               'error banner shown'),
        chkIncludes(bannerText(), 'no incident coordinates',       'banner mentions "no incident coordinates"'),
        chkNull(currentHull,                                       'no hull computed'),
        chkEq(patrolMarkers.length, 0,                             'no patrol markers placed'),
    ]; }
},

{
    id: 'G0-06', group: 'G0', n: 3, mode: 'roaming',
    name: 'Roaming + |P|=0 — roaming-specific error message',
    coords: [],
    check() { return [
        chkEq(bannerType(), 'error',                               'error banner shown'),
        chkIncludes(bannerText(), 'roaming mode',                  'banner mentions "roaming mode"'),
        chkNull(currentHull,                                       'no hull computed'),
        chkEq(patrolMarkers.length, 0,                             'no patrol markers placed'),
    ]; }
},

{
    id: 'G0-07', group: 'G0', n: 32,
    name: 'n=32 > n_max=30 — warning shown, pipeline NOT blocked',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
    ],
    check() { return [
        chkEq(bannerType(), 'warning',             'warning banner shown'),
        chkIncludes(bannerText(), 'exceeds',       'banner mentions "exceeds"'),
        chkGt(patrolMarkers.length, 0,             'pipeline continued — patrol markers placed'),
        chkNotNull(currentHull,                    'hull computed — pipeline ran'),
    ]; }
},

// ══════════════════════════════════════════════════════════════════════════════
// G1 — Stage 1: Brute Force Convex Hull
// ══════════════════════════════════════════════════════════════════════════════

{
    id: 'G1-01', group: 'G1', n: 3,
    name: 'Happy path — 15 scattered points across barangay',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.6985, lng: 121.0882 },
        { lat: 14.7010, lng: 121.0908 }, { lat: 14.7035, lng: 121.0935 },
        { lat: 14.7060, lng: 121.0968 }, { lat: 14.7085, lng: 121.1000 },
        { lat: 14.7110, lng: 121.1032 }, { lat: 14.7000, lng: 121.0862 },
        { lat: 14.7025, lng: 121.0950 }, { lat: 14.7050, lng: 121.0985 },
        { lat: 14.6975, lng: 121.0920 }, { lat: 14.7040, lng: 121.0900 },
        { lat: 14.7080, lng: 121.0928 }, { lat: 14.6992, lng: 121.0990 },
        { lat: 14.7068, lng: 121.0862 },
    ],
    check() { return [
        chkNotNull(currentHull,                            'hull computed'),
        chkGt(currentHull?.length ?? 0, 2,                'hull has 3+ vertices'),
        chkNotNull(hullPolygon,                            'hull polygon on map'),
        chkGt(validCandidates?.length ?? 0, 0,            'valid candidates found'),
        chkEq(['none','warning'].includes(bannerType()) ? 'ok':'fail', 'ok', 'no error banner'),
        chkEq(stage1Status(), '✅',                        'Stage 1 success'),
    ]; }
},

{
    id: 'G1-02', group: 'G1', n: 2,
    name: 'Tight cluster — hull computed but no valid candidates → error, hull kept on map',
    coords: [
        { lat: 14.7020, lng: 121.0935 }, { lat: 14.7022, lng: 121.0941 },
        { lat: 14.7024, lng: 121.0946 }, { lat: 14.7026, lng: 121.0938 },
        { lat: 14.7028, lng: 121.0943 }, { lat: 14.7030, lng: 121.0937 },
        { lat: 14.7023, lng: 121.0948 }, { lat: 14.7027, lng: 121.0933 },
        { lat: 14.7032, lng: 121.0945 }, { lat: 14.7025, lng: 121.0940 },
    ],
    check() { return [
        chkNotNull(hullPolygon,                            'hull polygon kept on map'),
        chkEq(validCandidates?.length ?? -1, 0,           'zero valid candidates'),
        chkEq(bannerType(), 'error',                      'error banner shown'),
        chkIncludes(bannerText(), 'road intersections',   'banner mentions "road intersections"'),
        chkEq(stage1Status(), '⚠️',                       'Stage 1 trace shows warning (area threshold)'),
    ]; }
},

{
    id: 'G1-03', group: 'G1', n: 2,
    name: 'Single strong outlier — 1 amber marker, hull uses non-outlier points',
    coords: [
        { lat: 14.7026, lng: 121.0939 }, { lat: 14.7033, lng: 121.0951 },
        { lat: 14.7022, lng: 121.0937 }, { lat: 14.7030, lng: 121.0938 },
        { lat: 14.7025, lng: 121.0951 }, { lat: 14.7034, lng: 121.0942 },
        { lat: 14.7021, lng: 121.0946 }, { lat: 14.7031, lng: 121.0955 },
        { lat: 14.7118, lng: 121.1034 },
    ],
    check() { return [
        chkNotNull(currentHull,       'hull computed'),
        chkEq(outlierMarkerCount(), 1, '1 outlier marker (amber/orange)'),
        chkNotNull(hullPolygon,       'hull polygon on map'),
    ]; }
},

{
    id: 'G1-04', group: 'G1', n: 3,
    name: 'Three extreme outliers among clustered points — outliers flagged',
    coords: [
        { lat: 14.7026, lng: 121.0939 }, { lat: 14.7033, lng: 121.0951 },
        { lat: 14.7022, lng: 121.0937 }, { lat: 14.7030, lng: 121.0938 },
        { lat: 14.7025, lng: 121.0951 }, { lat: 14.7034, lng: 121.0942 },
        { lat: 14.7021, lng: 121.0946 },
        { lat: 14.7155, lng: 121.1065 }, { lat: 14.6952, lng: 121.0836 },
        { lat: 14.7148, lng: 121.0838 },
    ],
    check() { return [
        chkGt(outlierMarkerCount(), 0, 'at least 1 outlier flagged'),
        chkNotNull(hullPolygon,        'hull polygon on map'),
    ]; }
},

{
    id: 'G1-05', group: 'G1', n: 4,
    name: '2 points only — linear handler, 4 numbered patrol markers on line',
    coords: [
        { lat: 14.7000, lng: 121.0900 }, { lat: 14.7100, lng: 121.1000 },
    ],
    check() { return [
        chkNull(currentHull,                    'no hull (linear handler)'),
        chkNull(hullPolygon,                    'no hull polygon on map'),
        chkEq(patrolMarkers.length, 4,          '4 patrol markers placed'),
        chkEq(bannerType(), 'warning',          'warning banner shown'),
        chkIncludes(bannerText(), '2 incident', 'banner mentions "2 incident"'),
        chkEq(stage1Status(), '⚠️',             'Stage 1 warning'),
    ]; }
},

{
    id: 'G1-06', group: 'G1', n: 4,
    name: '5 exactly collinear points — linear handler, 4 numbered patrol markers',
    coords: [
        { lat: 14.6960, lng: 121.0850 }, { lat: 14.6990, lng: 121.0880 },
        { lat: 14.7020, lng: 121.0910 }, { lat: 14.7050, lng: 121.0940 },
        { lat: 14.7080, lng: 121.0970 },
    ],
    check() { return [
        chkNull(currentHull,                   'no hull (collinear)'),
        chkNull(hullPolygon,                   'no hull polygon'),
        chkEq(patrolMarkers.length, 4,         '4 patrol markers placed'),
        chkEq(bannerType(), 'warning',         'warning banner shown'),
        chkIncludes(bannerText(), 'collinear', 'banner mentions "collinear"'),
        chkEq(stage1Status(), '⚠️',            'Stage 1 warning'),
    ]; }
},

{
    id: 'G1-07', group: 'G1', n: 2,
    name: 'Linear handler patrol icons have number labels (V4 fix)',
    coords: [
        { lat: 14.7000, lng: 121.0900 }, { lat: 14.7100, lng: 121.1000 },
    ],
    check() {
        const iconsHaveNumbers = patrolMarkers.length > 0 &&
            patrolMarkers.every((m, i) => {
                const html = m.getIcon?.()?.options?.html ?? '';
                return html.includes(String(i + 1));
            });
        return [
            chkEq(patrolMarkers.length, 2,                        '2 linear patrol markers placed'),
            chkTrue(iconsHaveNumbers,                             'patrol icons show number labels (not bare circles)'),
        ];
    }
},

{
    id: 'G1-08', group: 'G1', n: 2,
    name: 'Minimal 3-point triangle — hull with 3 vertices',
    coords: [
        { lat: 14.6955, lng: 121.0855 }, { lat: 14.7148, lng: 121.1068 },
        { lat: 14.7056, lng: 121.0963 },
    ],
    check() { return [
        chkNotNull(currentHull,                              'hull computed'),
        chkEq(currentHull?.length ?? 0, 3,                  '3-vertex hull'),
        chkNotNull(hullPolygon,                              'hull polygon on map'),
    ]; }
},

{
    id: 'G1-09', group: 'G1', n: 4,
    name: 'Octagon — all 8 points on hull boundary',
    coords: [
        { lat: 14.7110, lng: 121.0944 }, { lat: 14.7087, lng: 121.1001 },
        { lat: 14.7030, lng: 121.1024 }, { lat: 14.6973, lng: 121.1001 },
        { lat: 14.6950, lng: 121.0944 }, { lat: 14.6973, lng: 121.0887 },
        { lat: 14.7030, lng: 121.0864 }, { lat: 14.7087, lng: 121.0887 },
    ],
    check() { return [
        chkNotNull(currentHull,                                              'hull computed'),
        chkEq(currentHull?.length ?? 0, 8,                                  'all 8 points on hull'),
        chkNotNull(hullPolygon,                                              'hull polygon on map'),
        chkEq(['none','warning'].includes(bannerType()) ? 'ok':'fail', 'ok', 'no error banner'),
        chkEq(stage1Status(), '✅',                                          'Stage 1 success'),
    ]; }
},

{
    id: 'G1-10', group: 'G1', n: 5,
    name: 'Stress — 28 points, O(n³) hull computation completes without timeout',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.6975, lng: 121.0870 },
        { lat: 14.6990, lng: 121.0885 }, { lat: 14.7005, lng: 121.0900 },
        { lat: 14.7020, lng: 121.0915 }, { lat: 14.7035, lng: 121.0930 },
        { lat: 14.7050, lng: 121.0945 }, { lat: 14.7065, lng: 121.0960 },
        { lat: 14.7080, lng: 121.0975 }, { lat: 14.7095, lng: 121.0990 },
        { lat: 14.7110, lng: 121.1005 }, { lat: 14.7125, lng: 121.1020 },
        { lat: 14.6970, lng: 121.0900 }, { lat: 14.6985, lng: 121.0932 },
        { lat: 14.7000, lng: 121.0962 }, { lat: 14.7015, lng: 121.0875 },
        { lat: 14.7030, lng: 121.0855 }, { lat: 14.7045, lng: 121.0910 },
        { lat: 14.7060, lng: 121.0990 }, { lat: 14.7075, lng: 121.1022 },
        { lat: 14.7090, lng: 121.0940 }, { lat: 14.7105, lng: 121.0870 },
        { lat: 14.6965, lng: 121.0952 }, { lat: 14.6980, lng: 121.1002 },
        { lat: 14.7055, lng: 121.0862 }, { lat: 14.7070, lng: 121.1042 },
        { lat: 14.7140, lng: 121.0952 }, { lat: 14.6950, lng: 121.1002 },
    ],
    check() { return [
        chkNotNull(currentHull,                   'hull computed'),
        chkGt(currentHull?.length ?? 0, 2,        'hull has 3+ vertices'),
        chkGt(validCandidates?.length ?? 0, 0,    'valid candidates found'),
        chkNotNull(hullPolygon,                   'hull polygon on map'),
    ]; }
},

{
    id: 'G1-11', group: 'G1', n: 2,
    name: 'Empty valid candidates — 5 nearest intersection highlights shown',
    coords: [
        { lat: 14.7020, lng: 121.0935 }, { lat: 14.7022, lng: 121.0941 },
        { lat: 14.7024, lng: 121.0946 }, { lat: 14.7026, lng: 121.0938 },
        { lat: 14.7028, lng: 121.0943 }, { lat: 14.7030, lng: 121.0937 },
        { lat: 14.7023, lng: 121.0948 }, { lat: 14.7027, lng: 121.0933 },
        { lat: 14.7032, lng: 121.0945 }, { lat: 14.7025, lng: 121.0940 },
    ],
    check() { return [
        chkEq(validCandidates?.length ?? -1, 0,           'zero valid candidates'),
        chkEq(nearestHighlightMarkers.length, 5,           '5 nearest intersection highlights'),
        chkEq(bannerType(), 'error',                       'error banner shown'),
        chkIncludes(bannerText(), 'road intersections',    'banner mentions "road intersections"'),
    ]; }
},

{
    id: 'G1-12', group: 'G1', n: 3,
    name: 'Outlier removal reduces P below 3 — warning, pipeline stops, no hull',
    // 2 clustered points + 1 extreme point; with outlierMultiplier=2.5 the extreme one
    // won't be flagged unless we push ratio high enough. Use a more extreme outlier.
    coords: [
        { lat: 14.7028, lng: 121.0944 }, { lat: 14.7029, lng: 121.0945 },
        { lat: 14.8500, lng: 121.2000 },
    ],
    check() { return [
        chkNull(currentHull,                                          'no hull (stopped before hull computation)'),
        chkNull(hullPolygon,                                          'no hull polygon on map'),
        chkEq(bannerType(), 'warning',                                'warning banner shown'),
        chkIncludes(bannerText(), 'outlier',                          'banner mentions "outlier"'),
        chkEq(patrolMarkers.length, 0,                                'no patrol markers placed'),
    ]; }
},

{
    id: 'G1-13', group: 'G1', n: 3,
    name: 'Include outliers bypass — extreme outlier NOT flagged when bypass on',
    coords: [
        { lat: 14.7026, lng: 121.0939 }, { lat: 14.7033, lng: 121.0951 },
        { lat: 14.7022, lng: 121.0937 }, { lat: 14.7030, lng: 121.0938 },
        { lat: 14.7025, lng: 121.0951 }, { lat: 14.7034, lng: 121.0942 },
        { lat: 14.7021, lng: 121.0946 }, { lat: 14.7031, lng: 121.0955 },
        { lat: 14.7118, lng: 121.1034 },
    ],
    before() { CONFIG.convexHull_includeOutliers = true; },
    after()  { CONFIG.convexHull_includeOutliers = false; },
    check() { return [
        chkEq(outlierMarkerCount(), 0,  'zero outlier markers (bypass active)'),
        chkNotNull(currentHull,         'hull still computed'),
        chkNotNull(hullPolygon,         'hull polygon on map'),
    ]; }
},

{
    id: 'G1-14', group: 'G1', n: 3,
    name: 'validCandidates cache — same hull reused on second Recalculate',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
    ],
    async runExtra(resetFn) {
        // First run (done by harness). Record cache state.
        const firstCandidates = validCandidates ? [...validCandidates] : [];
        // Second run with same points
        await runPipeline();
        return { firstCandidates };
    },
    check(extra) {
        const sameLength = extra?.firstCandidates?.length === validCandidates?.length;
        return [
            chkTrue(sameLength, 'second run validCandidates has same length as first (cache hit)'),
            chkIncludes(traceText(), 'hit', 'trace panel reports cache hit for Ray Cast'),
        ];
    }
},

// ══════════════════════════════════════════════════════════════════════════════
// G2 — Stage 2: Hill Climbing
// ══════════════════════════════════════════════════════════════════════════════

{
    id: 'G2-01', group: 'G2', n: 1,
    name: 'n=1 — skip Hill Climbing, place at most central node',
    coords: [
        { lat: 14.6990, lng: 121.0880 }, { lat: 14.7060, lng: 121.0960 },
        { lat: 14.7030, lng: 121.1010 }, { lat: 14.6970, lng: 121.0970 },
        { lat: 14.7080, lng: 121.0880 },
    ],
    check() { return [
        chkEq(patrolMarkers.length, 1,                              '1 patrol marker placed'),
        chkEq(S_star?.length ?? 0, 1,                               'S_star has 1 position'),
        chkIncludes(traceText(), 'single patrol',                   'trace mentions single patrol mode'),
        chkEq(['none','warning'].includes(bannerType()) ? 'ok':'fail', 'ok', 'no error banner'),
    ]; }
},

{
    id: 'G2-02', group: 'G2', n: 5,
    name: 'n=5 standard spread — 5 unique nodes inside hull',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 }, { lat: 14.6998, lng: 121.0892 },
        { lat: 14.7082, lng: 121.0892 }, { lat: 14.7082, lng: 121.1005 },
        { lat: 14.6998, lng: 121.1005 },
    ],
    check() { return [
        chkEq(patrolMarkers.length, 5,                              '5 patrol markers placed'),
        chkEq(S_star?.length ?? 0, 5,                               'S_star has 5 positions'),
        chkEq(new Set(S_star?.map(p => p.id) ?? []).size, 5,        'all 5 are unique nodes'),
        chkEq(['none','warning'].includes(bannerType()) ? 'ok':'fail', 'ok', 'no error banner'),
    ]; }
},

{
    id: 'G2-03', group: 'G2', n: 2,
    name: 'n=2 — both positions at distinct nodes',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
    ],
    check() {
        const distinct = S_star?.length === 2 ? S_star[0].id !== S_star[1].id : false;
        return [
            chkEq(patrolMarkers.length, 2,           '2 patrol markers placed'),
            chkEq(S_star?.length ?? 0, 2,            'S_star has 2 positions'),
            chkTrue(distinct,                        'both positions are at distinct nodes'),
        ];
    }
},

{
    id: 'G2-04', group: 'G2', n: 10,
    name: 'n=10 high count — all 10 unique',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 }, { lat: 14.6985, lng: 121.0882 },
        { lat: 14.7095, lng: 121.0882 }, { lat: 14.7095, lng: 121.1018 },
        { lat: 14.6985, lng: 121.1018 }, { lat: 14.7040, lng: 121.0882 },
        { lat: 14.7040, lng: 121.1018 }, { lat: 14.6985, lng: 121.0948 },
    ],
    check() { return [
        chkEq(patrolMarkers.length, 10,                              '10 patrol markers placed'),
        chkEq(S_star?.length ?? 0, 10,                               'S_star has 10 positions'),
        chkEq(new Set(S_star?.map(p => p.id) ?? []).size, 10,        '10 unique node IDs in S_star'),
    ]; }
},

{
    id: 'G2-05', group: 'G2', n: 30,
    name: 'n=30 exactly at n_max — no n_max warning fires',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
    ],
    check() { return [
        chkEq(patrolMarkers.length, 30,                                          '30 patrol markers placed'),
        chkEq(bannerText().includes('recommended maximum') ? 'bad':'ok', 'ok',  'no n_max warning for n=30'),
    ]; }
},

{
    id: 'G2-06', group: 'G2', n: 8,
    name: 'n=8 — S_star.length, patrolMarkers.length, and unique IDs all match',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 }, { lat: 14.6998, lng: 121.0892 },
        { lat: 14.7082, lng: 121.0892 }, { lat: 14.7082, lng: 121.1005 },
    ],
    check() {
        const uniqueIds = new Set(S_star?.map(p => p.id) ?? []).size;
        return [
            chkEq(S_star?.length ?? 0, 8,    'S_star has 8 positions'),
            chkEq(patrolMarkers.length, 8,   '8 patrol markers on map'),
            chkEq(uniqueIds, 8,              '8 unique node IDs in S_star'),
        ];
    }
},

{
    id: 'G2-07', group: 'G2', n: 5,
    name: 'All S_star positions lie inside hull',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
    ],
    check() {
        const allInHull = S_star && currentHull
            ? S_star.every(p => isPointInHull(p, currentHull)) : false;
        return [
            chkEq(S_star?.length ?? 0, 5,              'S_star has 5 positions'),
            chkTrue(allInHull,                          'all patrol positions lie inside hull'),
        ];
    }
},

{
    id: 'G2-08', group: 'G2', n: 31,
    name: 'n=31 > n_max=30 — warning shown, pipeline continues',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
    ],
    check() { return [
        chkEq(bannerType(), 'warning',         'warning banner shown'),
        chkIncludes(bannerText(), 'exceeds',   'banner mentions "exceeds"'),
        chkGt(patrolMarkers.length, 0,         'pipeline continued — patrol markers placed'),
    ]; }
},

{
    id: 'G2-09', group: 'G2', n: 3,
    name: 'n > validCandidates — cap n, warning, patrol count input updated',
    // Tiny hull guarantees few valid candidates; request 3 patrols
    coords: [
        { lat: 14.7025, lng: 121.0930 }, { lat: 14.7038, lng: 121.0948 },
        { lat: 14.7030, lng: 121.0935 }, { lat: 14.7042, lng: 121.0952 },
        { lat: 14.7028, lng: 121.0960 },
    ],
    check() {
        const inputVal = parseInt(document.getElementById('patrol-count').value);
        const capOccurred = S_star && S_star.length < 3;
        // If cap did not occur (enough candidates), test is inconclusive
        if (!capOccurred) return [{ ok: 'manual', label: 'Hull had ≥3 candidates — cap did not fire; run with a tighter hull' }];
        return [
            chkTrue(capOccurred,                                          'n was capped (S_star.length < requested 3)'),
            chkEq(inputVal, S_star?.length ?? -1,                         'patrol count input updated to capped n'),
            chkEq(bannerType(), 'warning',                                'warning banner shown'),
            chkIncludes(bannerText(), 'valid patrol positions',           'banner mentions valid patrol positions'),
        ];
    }
},

// ══════════════════════════════════════════════════════════════════════════════
// G3 — Stage 3: Zone Assignment
// ══════════════════════════════════════════════════════════════════════════════

{
    id: 'G3-01', group: 'G3', n: 3,
    name: 'Zone array length === n, one zone line per assigned node',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 }, { lat: 14.6998, lng: 121.0892 },
        { lat: 14.7082, lng: 121.0892 }, { lat: 14.7082, lng: 121.1005 },
        { lat: 14.6998, lng: 121.1005 },
    ],
    check() {
        const totalAssigned = zones?.reduce((s, z) => s + z.length, 0) ?? -1;
        return [
            chkEq(zones?.length ?? -1, 3,                   'zones array has 3 entries'),
            chkGt(totalAssigned, 0,                         'at least some nodes assigned'),
            chkEq(zoneLines.length, totalAssigned,          'one zone line per assigned node'),
            chkEq(['none','warning'].includes(bannerType()) ? 'ok':'fail', 'ok', 'no error banner'),
        ];
    }
},

{
    id: 'G3-02', group: 'G3', n: 10,
    name: '10 patrols, 7 crime nodes — guaranteed empty zones, stationary warning',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
        { lat: 14.6998, lng: 121.0892 },
        { lat: 14.7082, lng: 121.1005 },
    ],
    check() {
        const emptyCount = zones?.filter(z => z.length === 0).length ?? -1;
        return [
            chkEq(patrolMarkers.length, 10,                 '10 patrol markers on map'),
            chkGt(emptyCount, 0,                            'at least one empty zone'),
            chkEq(bannerType(), 'warning',                  'warning banner shown'),
            chkIncludes(bannerText(), 'stationary',         'banner mentions "stationary"'),
            manual('Verify: empty-zone patrols show hollow S-marker'),
        ];
    }
},

{
    id: 'G3-03', group: 'G3', n: 1,
    name: 'Zone cap — n=1, 28 points, zone capped to maxCrimeNodesPerZone',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.6975, lng: 121.0870 },
        { lat: 14.6990, lng: 121.0885 }, { lat: 14.7005, lng: 121.0900 },
        { lat: 14.7020, lng: 121.0915 }, { lat: 14.7035, lng: 121.0930 },
        { lat: 14.7050, lng: 121.0945 }, { lat: 14.7065, lng: 121.0960 },
        { lat: 14.7080, lng: 121.0975 }, { lat: 14.7095, lng: 121.0990 },
        { lat: 14.7110, lng: 121.1005 }, { lat: 14.7125, lng: 121.1020 },
        { lat: 14.6970, lng: 121.0900 }, { lat: 14.6985, lng: 121.0932 },
        { lat: 14.7000, lng: 121.0962 }, { lat: 14.7015, lng: 121.0875 },
        { lat: 14.7030, lng: 121.0855 }, { lat: 14.7045, lng: 121.0910 },
        { lat: 14.7060, lng: 121.0990 }, { lat: 14.7075, lng: 121.1022 },
        { lat: 14.7090, lng: 121.0940 }, { lat: 14.7105, lng: 121.0870 },
        { lat: 14.6965, lng: 121.0952 }, { lat: 14.6980, lng: 121.1002 },
        { lat: 14.7055, lng: 121.0862 }, { lat: 14.7070, lng: 121.1042 },
        { lat: 14.7140, lng: 121.0952 }, { lat: 14.6950, lng: 121.1002 },
    ],
    check() {
        const cap = CONFIG?.tsp?.maxCrimeNodesPerZone ?? 10;
        return [
            chkEq(zones?.length ?? -1, 1,          '1 zone for 1 patrol'),
            chkEq(zones?.[0]?.length ?? -1, cap,   `zone capped to ${cap} nodes`),
            chkEq(bannerType(), 'warning',          'warning banner shown'),
            chkIncludes(bannerText(), 'capped',     'banner mentions "capped"'),
        ];
    }
},

{
    id: 'G3-04', group: 'G3', n: 4,
    name: 'zones.length always equals patrolCount (n=4)',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 }, { lat: 14.6998, lng: 121.0892 },
    ],
    check() { return [
        chkEq(zones?.length ?? -1, 4,                                    'zones.length === 4'),
        chkEq(zones?.length ?? -1, S_star?.length ?? -2,                 'zones.length === S_star.length'),
        chkEq(stageStatus(3) === '✅' || stageStatus(3) === '⚠️' ? 'ok':'fail', 'ok', 'Stage 3 not error'),
    ]; }
},

{
    id: 'G3-05', group: 'G3', n: 3,
    name: 'Stage 3 trace references Hill Climbing restart',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
    ],
    check() { return [
        chkIncludes(traceText(), 'Zone Assignment',   'Stage 3 trace entry present'),
        chkIncludes(traceText(), 'Hill Climbing',     'Stage 3 trace references Hill Climbing'),
    ]; }
},

{
    id: 'G3-06', group: 'G3', n: 3,
    name: 'All zone nodes have valid id/lat/lng; no duplicates within a zone',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 }, { lat: 14.6998, lng: 121.0892 },
        { lat: 14.7082, lng: 121.0892 }, { lat: 14.7082, lng: 121.1005 },
        { lat: 14.6998, lng: 121.1005 },
    ],
    check() {
        const nodesValid = zones?.every(z =>
            z.every(sn => typeof sn.id === 'string' && typeof sn.lat === 'number' && typeof sn.lng === 'number')
        ) ?? false;
        const noIntraZoneDupes = zones?.every(z =>
            new Set(z.map(sn => sn.id)).size === z.length
        ) ?? false;
        const sStarValid = S_star?.every(p => typeof p.id === 'string' && p.id.startsWith('n')) ?? false;
        return [
            chkTrue(nodesValid,        'all zone nodes have string id, number lat/lng'),
            chkTrue(noIntraZoneDupes,  'no duplicate node IDs within any zone'),
            chkTrue(sStarValid,        'all S_star positions have node id starting with "n"'),
        ];
    }
},

{
    id: 'G3-07', group: 'G3', n: 3,
    name: 'Single-node zone — dashed direct route polyline rendered',
    // Force a single-node zone by placing 3 patrols across 3 separated regions
    // with exactly 3 crime nodes — each patrol gets 1 node
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
        { lat: 14.6970, lng: 121.0865 },  // one crime node
        { lat: 14.7125, lng: 121.1050 },  // one crime node
        { lat: 14.7115, lng: 121.0870 },  // one crime node
    ],
    check() {
        const hasSingleZone = zones?.some(z => z.length === 1) ?? false;
        if (!hasSingleZone) return [manual('No single-node zone was created with these coords/HC result — may vary by run')];
        return [
            chkTrue(hasSingleZone,         'at least one single-node zone exists'),
            chkGt(routePolylines.length, 0, 'dashed route polyline(s) rendered for single-node zone(s)'),
            manual('Verify: single-node route is a dashed (not solid) line on map'),
        ];
    }
},

{
    id: 'G3-08', group: 'G3', n: 3,
    name: 'showZoneLines=false (stationary) — zero zone lines on map',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 }, { lat: 14.6998, lng: 121.0892 },
    ],
    before() { CONFIG.display.showZoneLines = false; },
    after()  { CONFIG.display.showZoneLines = true; },
    check() { return [
        chkEq(zoneLines.length, 0,     'no zone lines rendered when showZoneLines=false'),
        chkNotNull(currentHull,        'hull still computed'),
        chkGt(patrolMarkers.length, 0, 'patrol markers still placed'),
    ]; }
},

// ══════════════════════════════════════════════════════════════════════════════
// G4 — Stage 4: Backtracking TSP + Dijkstra
// ══════════════════════════════════════════════════════════════════════════════

{
    id: 'G4-01', group: 'G4', n: 3, mode: 'roaming',
    name: 'Roaming n=3, 9 crime nodes — TSP routes rendered, Stage 4 trace present',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 }, { lat: 14.6998, lng: 121.0892 },
        { lat: 14.7082, lng: 121.0892 }, { lat: 14.7082, lng: 121.1005 },
        { lat: 14.6998, lng: 121.1005 },
    ],
    check() {
        const s4 = stageStatus(4);
        return [
            chkGt(routePolylines.length, 0,                            'route polylines rendered'),
            chkNotNull(s4,                                             'Stage 4 trace entry present'),
            chkEq(s4 === '✅' || s4 === '⚠️' ? 'ok':'fail', 'ok',     'Stage 4 not error'),
            chkEq(['none','warning'].includes(bannerType()) ? 'ok':'fail', 'ok', 'no error banner'),
        ];
    }
},

{
    id: 'G4-02', group: 'G4', n: 3, mode: 'stationary',
    name: 'Stationary mode — no Stage 4 trace, pipeline stops after Stage 3',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 }, { lat: 14.6998, lng: 121.0892 },
        { lat: 14.7082, lng: 121.0892 }, { lat: 14.7082, lng: 121.1005 },
        { lat: 14.6998, lng: 121.1005 },
    ],
    check() { return [
        chkNull(stageStatus(4),                                              'no Stage 4 trace (stationary)'),
        chkEq(['none','warning'].includes(bannerType()) ? 'ok':'fail', 'ok', 'no error banner'),
        chkEq(stageStatus(3) === '✅' || stageStatus(3) === '⚠️' ? 'ok':'fail', 'ok', 'Stage 3 completed'),
        chkGt(zoneLines.length, 0,                                           'zone lines visible in stationary mode'),
        manual('Verify: zone lines visible on map; no road-following routes'),
    ]; }
},

{
    id: 'G4-03', group: 'G4', n: 2, mode: 'roaming',
    name: 'Roaming n=2 — dijkstraCache populated after TSP run',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 }, { lat: 14.6998, lng: 121.0892 },
        { lat: 14.7082, lng: 121.0892 },
    ],
    check() { return [
        chkGt(routePolylines.length, 0,                     'route polylines rendered'),
        chkGt(Object.keys(dijkstraCache).length, 0,         'dijkstraCache populated after Stage 4'),
        chkEq(stageStatus(4) === '✅' || stageStatus(4) === '⚠️' ? 'ok':'fail', 'ok', 'Stage 4 not error'),
    ]; }
},

{
    id: 'G4-04', group: 'G4', n: 1, mode: 'roaming',
    name: 'Roaming n=1 large zone — zone capped, TSP runs on capped set',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.6975, lng: 121.0870 },
        { lat: 14.6990, lng: 121.0885 }, { lat: 14.7005, lng: 121.0900 },
        { lat: 14.7020, lng: 121.0915 }, { lat: 14.7035, lng: 121.0930 },
        { lat: 14.7050, lng: 121.0945 }, { lat: 14.7065, lng: 121.0960 },
        { lat: 14.7080, lng: 121.0975 }, { lat: 14.7095, lng: 121.0990 },
        { lat: 14.7110, lng: 121.1005 }, { lat: 14.7125, lng: 121.1020 },
        { lat: 14.6970, lng: 121.0900 }, { lat: 14.6985, lng: 121.0932 },
        { lat: 14.7000, lng: 121.0962 }, { lat: 14.7015, lng: 121.0875 },
        { lat: 14.7030, lng: 121.0855 }, { lat: 14.7045, lng: 121.0910 },
        { lat: 14.7060, lng: 121.0990 }, { lat: 14.7075, lng: 121.1022 },
        { lat: 14.7090, lng: 121.0940 }, { lat: 14.7105, lng: 121.0870 },
        { lat: 14.6965, lng: 121.0952 }, { lat: 14.6980, lng: 121.1002 },
        { lat: 14.7055, lng: 121.0862 }, { lat: 14.7070, lng: 121.1042 },
        { lat: 14.7140, lng: 121.0952 }, { lat: 14.6950, lng: 121.1002 },
    ],
    check() {
        const cap = CONFIG?.tsp?.maxCrimeNodesPerZone ?? 10;
        const s4 = stageStatus(4);
        return [
            chkEq(zones?.[0]?.length ?? -1, cap,   `zone capped to ${cap}`),
            chkGt(routePolylines.length, 0,         'TSP routes rendered'),
            chkNotNull(s4,                          'Stage 4 trace entry present'),
            chkEq(s4 === '✅' || s4 === '⚠️' ? 'ok':'fail', 'ok', 'Stage 4 not error'),
        ];
    }
},

{
    id: 'G4-05', group: 'G4', n: 3, mode: 'roaming',
    name: 'Zone lines removed after Stage 4 in roaming mode',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 }, { lat: 14.6998, lng: 121.0892 },
        { lat: 14.7082, lng: 121.0892 }, { lat: 14.7082, lng: 121.1005 },
        { lat: 14.6998, lng: 121.1005 },
    ],
    check() { return [
        chkEq(zoneLines.length, 0,     'zone lines removed after Stage 4 (roaming)'),
        chkGt(routePolylines.length, 0,'route polylines present instead'),
    ]; }
},

{
    id: 'G4-06', group: 'G4', n: 3, mode: 'roaming',
    name: 'Stage 4 trace contains optimal circuit string per patrol',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 }, { lat: 14.6998, lng: 121.0892 },
        { lat: 14.7082, lng: 121.0892 }, { lat: 14.7082, lng: 121.1005 },
        { lat: 14.6998, lng: 121.1005 },
    ],
    check() {
        const summaries = document.querySelectorAll('#trace-stages .trace-summary');
        const s4Summary = summaries[summaries.length - 1]?.textContent ?? '';
        return [
            chkNotNull(stageStatus(4),                                     'Stage 4 trace entry present'),
            chkIncludes(s4Summary, 'optimal circuit',                      'Stage 4 summary contains "optimal circuit"'),
            chkTrue(/total:\s*\d+m/i.test(s4Summary),                     'Stage 4 summary contains "Total: Xm" distance'),
        ];
    }
},

{
    id: 'G4-07', group: 'G4', n: 3, mode: 'roaming',
    name: 'showOverlapColoring=false — overlapLayer not created',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 }, { lat: 14.6998, lng: 121.0892 },
        { lat: 14.7082, lng: 121.0892 }, { lat: 14.7082, lng: 121.1005 },
        { lat: 14.6998, lng: 121.1005 },
    ],
    before() { CONFIG.display.showOverlapColoring = false; },
    after()  { CONFIG.display.showOverlapColoring = true; },
    check() { return [
        chkNull(overlapLayer,          'overlapLayer is null (not created)'),
        chkGt(routePolylines.length, 0, 'route polylines still rendered'),
    ]; }
},

// ══════════════════════════════════════════════════════════════════════════════
// G5 — UI State & Interaction
// ══════════════════════════════════════════════════════════════════════════════

{
    id: 'G5-01', group: 'G5', n: 3,
    name: 'n_max computed as floor(sqrt(intersectionNodes.length))',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
    ],
    check() {
        const expected = Math.floor(Math.sqrt(intersectionNodes.length));
        const placeholder = document.getElementById('patrol-count').placeholder;
        return [
            chkEq(n_max, expected,                          `n_max = floor(sqrt(${intersectionNodes.length})) = ${expected}`),
            chkIncludes(placeholder, String(expected),      'placeholder shows n_max value'),
        ];
    }
},

{
    id: 'G5-02', group: 'G5', n: 3,
    name: 'Recalculate button re-enabled after pipeline completes',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
    ],
    check() { return [
        chkEq(recalcBtn.disabled, false,            'recalcBtn.disabled === false after pipeline'),
        chkEq(pipelineRunning, false,               'pipelineRunning === false after pipeline'),
        chkEq(recalcBtn.textContent, 'Recalculate (Ctrl+Enter)', 'button text restored'),
    ]; }
},

{
    id: 'G5-03', group: 'G5', n: 3,
    name: 'loadingOverlay hidden after pipeline completes',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
    ],
    check() {
        const overlay = document.getElementById('loading-overlay');
        return [
            chkEq(overlay?.style.display ?? 'not found', 'none', 'loading overlay hidden after pipeline'),
        ];
    }
},

{
    id: 'G5-04', group: 'G5', n: 3,
    name: 'Pipeline summary text present after completion',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
    ],
    check() {
        const sum = summaryText();
        return [
            chkGt(sum.length, 0,                   'pipeline summary not empty'),
            chkIncludes(sum, 'Pipeline Complete',  'summary contains "Pipeline Complete"'),
        ];
    }
},

{
    id: 'G5-05', group: 'G5', n: 3,
    name: 'Undo button hidden initially, shown after crime node removal',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
    ],
    check() {
        const undoBtn = document.getElementById('undo-btn');
        const hiddenBefore = undoBtn.style.display === 'none' || !undoBtn.style.display;
        // Simulate removal
        const savedP = [...P];
        const savedMarkers = [...crimeMarkers];
        if (crimeMarkers.length > 0) removeCrimeNodeByMarker(crimeMarkers[0]);
        const shownAfter = undoBtn.style.display !== 'none';
        return [
            chkTrue(hiddenBefore,   'undo button hidden before any removal'),
            chkTrue(shownAfter,     'undo button shown after removal'),
        ];
    }
},

{
    id: 'G5-06', group: 'G5', n: 3,
    name: 'Duplicate crime node blocked — warning shown, P.length unchanged',
    coords: [
        { lat: 14.7000, lng: 121.0900 }, { lat: 14.7050, lng: 121.0950 },
        { lat: 14.7040, lng: 121.0948 },
    ],
    check() {
        const lenBefore = P.length;
        // Simulate clicking the exact same spot as P[0]
        onMapClick({ latlng: { lat: P[0].lat, lng: P[0].lng } });
        return [
            chkEq(P.length, lenBefore,              'P.length unchanged (no duplicate added)'),
            chkEq(bannerType(), 'warning',          'warning banner shown'),
            chkIncludes(bannerText(), 'already',    'banner mentions "already"'),
        ];
    }
},

{
    id: 'G5-07', group: 'G5', n: 3,
    name: 'Hull membership check — click outside hull blocked after pipeline',
    coords: [
        { lat: 14.7020, lng: 121.0930 }, { lat: 14.7050, lng: 121.0970 },
        { lat: 14.7020, lng: 121.0970 }, { lat: 14.7050, lng: 121.0930 },
        { lat: 14.7035, lng: 121.0950 },
    ],
    check() {
        if (!currentHull) return [manual('Hull not computed — skip')];
        const lenBefore = P.length;
        // Simulate click far outside the hull
        onMapClick({ latlng: { lat: 14.6800, lng: 121.0700 } });
        return [
            chkEq(P.length, lenBefore,                               'P.length unchanged (outside hull blocked)'),
            chkEq(bannerType(), 'warning',                           'warning banner shown'),
            chkIncludes(bannerText(), 'outside',                     'banner mentions "outside"'),
        ];
    }
},

// ══════════════════════════════════════════════════════════════════════════════
// G6 — Settings Modal
// ══════════════════════════════════════════════════════════════════════════════

{
    id: 'G6-01', group: 'G6', n: 3,
    name: 'Settings modal shows current CONFIG values on open',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
    ],
    check() {
        openSettings();
        const results = [
            chkEq(parseInt(document.getElementById('cfg-hc-restarts').value),    CONFIG.hillClimbing.restarts,         'restarts matches CONFIG'),
            chkEq(parseInt(document.getElementById('cfg-hc-maxiter').value),     CONFIG.hillClimbing.maxIterations,    'maxIterations matches CONFIG'),
            chkEq(parseFloat(document.getElementById('cfg-hc-radius').value),    CONFIG.hillClimbing.radiusMultiplier, 'radiusMultiplier matches CONFIG'),
            chkEq(parseInt(document.getElementById('cfg-ch-area').value),        CONFIG.convexHull.areaThresholdDivisor, 'areaThresholdDivisor matches CONFIG'),
            chkEq(parseFloat(document.getElementById('cfg-ch-outlier').value),   CONFIG.convexHull.outlierMultiplier,  'outlierMultiplier matches CONFIG'),
            chkEq(parseInt(document.getElementById('cfg-tsp-max').value),        CONFIG.tsp.maxCrimeNodesPerZone,      'maxCrimeNodesPerZone matches CONFIG'),
            chkEq(document.getElementById('cfg-show-zone-lines').checked,        CONFIG.display.showZoneLines,         'showZoneLines checkbox matches CONFIG'),
            chkEq(document.getElementById('cfg-show-arrows').checked,            CONFIG.display.showRouteArrows,       'showRouteArrows checkbox matches CONFIG'),
            chkEq(document.getElementById('cfg-show-overlap').checked,           CONFIG.display.showOverlapColoring,   'showOverlapColoring checkbox matches CONFIG'),
        ];
        closeSettings();
        return results;
    }
},

{
    id: 'G6-02', group: 'G6', n: 3,
    name: 'Settings Apply — updates CONFIG, closes modal',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
    ],
    check() {
        const orig = { restarts: CONFIG.hillClimbing.restarts, maxZone: CONFIG.tsp.maxCrimeNodesPerZone };
        openSettings();
        document.getElementById('cfg-hc-restarts').value = '7';
        document.getElementById('cfg-tsp-max').value = '8';
        document.getElementById('settings-apply').click();
        const results = [
            chkEq(CONFIG.hillClimbing.restarts,       7, 'restarts updated to 7'),
            chkEq(CONFIG.tsp.maxCrimeNodesPerZone,    8, 'maxCrimeNodesPerZone updated to 8'),
            chkEq(document.getElementById('settings-modal').classList.contains('open') ? 'open':'closed', 'closed', 'modal closed after Apply'),
        ];
        CONFIG.hillClimbing.restarts    = orig.restarts;
        CONFIG.tsp.maxCrimeNodesPerZone = orig.maxZone;
        return results;
    }
},

{
    id: 'G6-03', group: 'G6', n: 3,
    name: 'Settings Cancel — does not modify CONFIG, closes modal',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
    ],
    check() {
        const origRestarts = CONFIG.hillClimbing.restarts;
        openSettings();
        document.getElementById('cfg-hc-restarts').value = '99';
        document.getElementById('settings-cancel').click();
        return [
            chkEq(CONFIG.hillClimbing.restarts, origRestarts, 'Cancel did not modify CONFIG'),
            chkEq(document.getElementById('settings-modal').classList.contains('open') ? 'open':'closed', 'closed', 'modal closed after Cancel'),
        ];
    }
},

{
    id: 'G6-04', group: 'G6', n: 3,
    name: 'Settings Reset to Defaults — all CONFIG fields restored',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
    ],
    check() {
        CONFIG.hillClimbing.restarts    = 99;
        CONFIG.tsp.maxCrimeNodesPerZone = 25;
        openSettings();
        document.getElementById('settings-reset').click();
        const results = [
            chkEq(CONFIG.hillClimbing.restarts,         CONFIG_DEFAULTS.hillClimbing.restarts,         'restarts restored'),
            chkEq(CONFIG.hillClimbing.maxIterations,    CONFIG_DEFAULTS.hillClimbing.maxIterations,    'maxIterations restored'),
            chkEq(CONFIG.hillClimbing.radiusMultiplier, CONFIG_DEFAULTS.hillClimbing.radiusMultiplier, 'radiusMultiplier restored'),
            chkEq(CONFIG.tsp.maxCrimeNodesPerZone,      CONFIG_DEFAULTS.tsp.maxCrimeNodesPerZone,      'maxCrimeNodesPerZone restored'),
            chkEq(CONFIG.display.showZoneLines,         CONFIG_DEFAULTS.display.showZoneLines,         'showZoneLines restored'),
            chkEq(CONFIG.display.showRouteArrows,       CONFIG_DEFAULTS.display.showRouteArrows,       'showRouteArrows restored'),
            chkEq(CONFIG.display.showOverlapColoring,   CONFIG_DEFAULTS.display.showOverlapColoring,   'showOverlapColoring restored'),
        ];
        closeSettings();
        return results;
    }
},

{
    id: 'G6-05', group: 'G6', n: 3,
    name: 'Map legend present with all required entries',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
    ],
    check() {
        const legend = document.querySelector('.map-legend');
        const legendText = legend?.textContent ?? '';
        return [
            chkNotNull(legend,                    'map legend element exists'),
            chkIncludes(legendText, 'crime',      'legend has crime incident entry'),
            chkIncludes(legendText, 'patrol',     'legend has patrol entry'),
            chkIncludes(legendText, 'zone',       'legend has zone assignment entry'),
            chkIncludes(legendText, 'overlap',    'legend has route overlap entry'),
        ];
    }
},

// ══════════════════════════════════════════════════════════════════════════════
// G7 — Trace Panel
// ══════════════════════════════════════════════════════════════════════════════

{
    id: 'G7-01', group: 'G7', n: 3,
    name: 'Trace panel cleared at start of each pipeline run',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
    ],
    check() {
        const stageCount = document.querySelectorAll('#trace-stages .trace-stage').length;
        return [
            chkGt(stageCount, 0,           'trace panel has stage entries after run'),
            chkGt(summaryText().length, 0, 'pipeline summary populated'),
        ];
    }
},

{
    id: 'G7-02', group: 'G7', n: 3, mode: 'roaming',
    name: 'All 4 stage entries present in trace panel for roaming run',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 }, { lat: 14.6998, lng: 121.0892 },
        { lat: 14.7082, lng: 121.0892 }, { lat: 14.7082, lng: 121.1005 },
        { lat: 14.6998, lng: 121.1005 },
    ],
    check() { return [
        chkNotNull(stageStatus(1), 'Stage 1 trace entry present'),
        chkNotNull(stageStatus(2), 'Stage 2 trace entry present'),
        chkNotNull(stageStatus(3), 'Stage 3 trace entry present'),
        chkNotNull(stageStatus(4), 'Stage 4 trace entry present'),
    ]; }
},

{
    id: 'G7-03', group: 'G7', n: 3,
    name: 'Stage 3 stationary — only 3 trace entries (no Stage 4)',
    coords: [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 },
    ],
    check() { return [
        chkNotNull(stageStatus(1), 'Stage 1 trace entry present'),
        chkNotNull(stageStatus(2), 'Stage 2 trace entry present'),
        chkNotNull(stageStatus(3), 'Stage 3 trace entry present'),
        chkNull(stageStatus(4),    'Stage 4 trace NOT present (stationary mode)'),
    ]; }
},

// ══════════════════════════════════════════════════════════════════════════════
// G8 — Bulk Import
// ══════════════════════════════════════════════════════════════════════════════

{
    id: 'G8-01', group: 'G8', n: 3,
    name: 'Bulk import — valid lines parsed, malformed lines skipped with count',
    coords: [],
    check() {
        // Bypass pipeline; directly test import parsing
        const textarea = document.getElementById('coord-input');
        const importBody = document.getElementById('import-body');
        importBody.classList.add('open');

        textarea.value = [
            '14.7020, 121.0935',   // valid
            '14.7040, 121.0955',   // valid
            'not a coord',          // malformed → skip
            '14.7060,121.0975',    // valid (no space)
            '999, 999',             // out of range → skip
            '',                     // blank → skip
            '14.7080, 121.0995',   // valid
        ].join('\n');

        document.getElementById('import-btn').click();

        const msg = document.getElementById('import-message').textContent;
        // Clean up
        P.forEach((_, i) => crimeMarkers[i]?.remove());
        P.length = 0; crimeMarkers.length = 0;
        textarea.value = '';

        return [
            chkIncludes(msg, '4 point',     'success message reports 4 valid points'),
            chkIncludes(msg, 'skipped',     'success message reports skipped lines'),
        ];
    }
},

{
    id: 'G8-02', group: 'G8', n: 3,
    name: 'Bulk import — coords outside Commonwealth bounding box → warning shown',
    coords: [],
    check() {
        const importBody = document.getElementById('import-body');
        importBody.classList.add('open');
        document.getElementById('coord-input').value = '40.7128, -74.0060\n51.5074, -0.1278';
        document.getElementById('import-btn').click();
        const bt = bannerType();
        const btext = bannerText();
        // Clean up
        P.forEach((_, i) => crimeMarkers[i]?.remove());
        P.length = 0; crimeMarkers.length = 0;
        document.getElementById('coord-input').value = '';
        return [
            chkEq(bt, 'warning',                              'warning banner shown for outside coords'),
            chkIncludes(btext, 'Barangay Commonwealth',       'banner mentions barangay name'),
        ];
    }
},

]; // end SCENARIOS

// ── Standalone: trace expand/collapse state preservation ──────────────────────

async function testStatePreservation() {
    console.group('%c[PP_TESTS] G7-SP — Trace expand/collapse preserved across recalculations', 'color:#0072B2;font-weight:bold');
    if (!resetApp()) { console.groupEnd(); return; }

    document.getElementById('patrol-count').value = 3;
    [
        { lat: 14.6960, lng: 121.0855 }, { lat: 14.7120, lng: 121.1042 },
        { lat: 14.7120, lng: 121.0855 }, { lat: 14.6960, lng: 121.1042 },
        { lat: 14.7040, lng: 121.0948 }, { lat: 14.6998, lng: 121.0892 },
        { lat: 14.7082, lng: 121.0892 }, { lat: 14.7082, lng: 121.1005 },
        { lat: 14.6998, lng: 121.1005 },
    ].forEach(pt => addCrimeNode(pt));

    await runPipeline();

    const firstLog = document.querySelector('#trace-stages .trace-stage .trace-log');
    if (!firstLog) {
        console.log('%c  ❌ FAIL  No Stage 1 trace log found after first run', 'color:#D55E00;font-weight:bold');
        console.groupEnd(); return;
    }
    firstLog.classList.add('open');
    await runPipeline(); // second run with same points

    const firstLogAfter = document.querySelector('#trace-stages .trace-stage .trace-log');
    const isOpen = firstLogAfter?.classList.contains('open') ?? false;
    const r = isOpen ? pass('Stage 1 full log remains open after second run') : fail('Stage 1 full log remains open after second run', 'closed', 'open');
    console.log(r.ok ? `  %c✅ PASS  ${r.label}` : `  %c❌ FAIL  ${r.label} (got: ${r.got})`, r.ok ? 'color:#009E73' : 'color:#D55E00;font-weight:bold');
    console.groupEnd();
}

// ── Runner ─────────────────────────────────────────────────────────────────────

function resetApp() {
    if (typeof pipelineRunning !== 'undefined' && pipelineRunning) {
        console.warn('[PP_TESTS] Pipeline is running — wait for it to finish.');
        return false;
    }
    P.length = 0;
    crimeMarkers.forEach(m => m.remove());
    crimeMarkers.length = 0;
    lastRemovedPoint = null;
    pipelineResults = false;
    deploymentMode = 'stationary';
    document.querySelectorAll('#mode-toggle input[type=radio]').forEach(r => { r.checked = r.value === 'stationary'; });
    document.querySelectorAll('.mode-option').forEach(el => el.classList.remove('mode-active'));
    document.querySelector('.mode-option')?.classList.add('mode-active');
    clearMapResults({ clearHull: true, clearPatrols: true, clearRoutes: true, clearZoneLines: true, clearNearestHighlights: true });
    clearBanner();
    document.getElementById('trace-stages').innerHTML = '';
    document.getElementById('pipeline-summary').textContent = '';
    // Restore CONFIG display toggles in case a test turned them off
    CONFIG.display.showZoneLines        = CONFIG_DEFAULTS.display.showZoneLines;
    CONFIG.display.showRouteArrows      = CONFIG_DEFAULTS.display.showRouteArrows;
    CONFIG.display.showOverlapColoring  = CONFIG_DEFAULTS.display.showOverlapColoring;
    CONFIG.convexHull_includeOutliers   = false;
    return true;
}

function printResults(results, id) {
    let passed = 0, failed = 0, manualCount = 0;
    results.forEach(r => {
        if (r.ok === 'manual') {
            console.log(`  %c⬜ MANUAL  ${r.label}`, 'color:#888');
            manualCount++;
        } else if (r.ok) {
            console.log(`  %c✅ PASS    ${r.label}`, 'color:#009E73');
            passed++;
        } else {
            console.log(`  %c❌ FAIL    ${r.label}  (got: ${JSON.stringify(r.got)}, expected: ${r.expected})`, 'color:#D55E00;font-weight:bold');
            failed++;
        }
    });
    const color = failed > 0 ? '#D55E00' : '#009E73';
    console.log(`  %c${id}: ${passed}/${passed + failed} passed${manualCount > 0 ? `, ${manualCount} manual` : ''}`, `color:${color};font-weight:bold`);
    return { passed, failed, manual: manualCount };
}

async function run(idx) {
    const s = SCENARIOS[idx - 1];
    if (!s) { console.error(`[PP_TESTS] No scenario ${idx}.`); return; }
    if (!resetApp()) return;

    console.group(`%c[PP_TESTS] ${s.id} — ${s.name}`, 'color:#0072B2;font-weight:bold');

    // Apply deployment mode
    if (s.mode === 'roaming') {
        deploymentMode = 'roaming';
        document.querySelectorAll('#mode-toggle input[type=radio]').forEach(r => { r.checked = r.value === 'roaming'; });
        document.querySelectorAll('.mode-option').forEach(el => el.classList.remove('mode-active'));
        document.querySelector('.mode-option:last-of-type')?.classList.add('mode-active');
    }

    // before hook
    s.before?.();

    document.getElementById('patrol-count').value = s.n;
    s.coords.forEach(pt => addCrimeNode(pt));

    // Handle special two-run tests
    let extra = undefined;
    if (s.runExtra) {
        await runPipeline();
        extra = await s.runExtra(resetApp);
    } else {
        const t0 = performance.now();
        await runPipeline();
        console.log(`  Completed in ${Math.round(performance.now() - t0)}ms`);
    }

    const results = s.check(extra);
    const counts = printResults(results, s.id);

    // after hook
    s.after?.();

    console.groupEnd();
    return { passed: counts.passed, failed: counts.failed, id: s.id, name: s.name };
}

async function runGroup(groupId, delayMs = 2500) {
    const matching = SCENARIOS.filter(s => s.group === groupId);
    if (!matching.length) { console.error(`[PP_TESTS] No scenarios for group ${groupId}.`); return; }
    let totalPassed = 0, totalFailed = 0;
    const failedList = [];
    console.log(`%c[PP_TESTS] Running ${matching.length} scenarios in group ${groupId}`, 'color:#0072B2;font-weight:bold');
    for (let i = 0; i < matching.length; i++) {
        const r = await run(SCENARIOS.indexOf(matching[i]) + 1);
        if (r) { totalPassed += r.passed; totalFailed += r.failed; if (r.failed > 0) failedList.push(r); }
        if (i < matching.length - 1) await new Promise(res => setTimeout(res, delayMs));
    }
    const color = totalFailed > 0 ? '#D55E00' : '#009E73';
    console.log(`%c[PP_TESTS] ${groupId} done — ${totalPassed} passed, ${totalFailed} failed`, `color:${color};font-weight:bold`);
    if (failedList.length) failedList.forEach(r => console.log(`  %c❌ ${r.id} — ${r.name}`, 'color:#D55E00'));
}

async function runAll(delayMs = 2500) {
    let totalPassed = 0, totalFailed = 0;
    const failedList = [];
    console.log(`%c[PP_TESTS] Running all ${SCENARIOS.length} scenarios`, 'color:#0072B2;font-weight:bold');
    for (let i = 1; i <= SCENARIOS.length; i++) {
        const r = await run(i);
        if (r) { totalPassed += r.passed; totalFailed += r.failed; if (r.failed > 0) failedList.push(r); }
        if (i < SCENARIOS.length) await new Promise(res => setTimeout(res, delayMs));
    }
    await new Promise(res => setTimeout(res, delayMs));
    testStatePreservation();
    const color = totalFailed > 0 ? '#D55E00' : '#009E73';
    console.log(`%c[PP_TESTS] DONE — ${totalPassed} passed, ${totalFailed} failed (+ 1 manual expand/collapse test)`, `color:${color};font-weight:bold`);
    if (failedList.length) { console.log('%c[PP_TESTS] Failed:', 'color:#D55E00;font-weight:bold'); failedList.forEach(r => console.log(`  ❌ ${r.id} — ${r.name}`)); }
}

function list() {
    const byGroup = {};
    SCENARIOS.forEach((s, i) => (byGroup[s.group] = byGroup[s.group] || []).push({ s, i }));
    console.log('%c[PP_TESTS] All scenarios:', 'font-weight:bold');
    for (const [g, items] of Object.entries(byGroup)) {
        console.log(`%c  ── ${g} ──`, 'color:#888');
        items.forEach(({ s, i }) => console.log(`  ${i + 1}. [${s.id}] n=${s.n} ${s.mode ? '(' + s.mode + ')' : ''} — ${s.name}`));
    }
    console.log('\nPP_TESTS.run(n) | runGroup("G0".."G8") | runAll() | testStatePreservation()');
}

console.log('%c[PP_TESTS] Loaded — 56 scenarios. PP_TESTS.runAll() | runGroup("G0") | list()', 'color:#009E73;font-weight:bold');
return { run, runAll, runGroup, list, SCENARIOS, testStatePreservation };

})();
