# Global Opinion Atlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local interactive website that analyzes all 5,543 media records across all 114 countries at global, national, local, source, and article levels.

**Architecture:** A Vite React application loads deterministic JSON generated from the parent Excel workbook. Pure TypeScript selectors own filtering and aggregation, React owns shared drill-down state, and D3 renders geographic and statistical views. Validation metadata reconciles every aggregate with article detail.

**Tech Stack:** React, TypeScript, Vite, D3, SheetJS, Vitest, Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-09-13-global-opinion-atlas-design.md`

## Global Constraints

- Process all 5,543 records and all 114 countries; Top N affects presentation only.
- Never modify `../TikTok难民涌入小红书 2025.01.15外媒数据.xlsx`.
- Preserve duplicate source column names by position and preserve zero versus missing values.
- Do not guess coordinates or silently discard unmapped countries.
- All aggregates must reconcile with complete article detail.
- Support keyboard, touch, 360 px, 736 px, and desktop widths.

---

### Task 1: Scaffold the application and test harness

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles.css`
- Create: `src/test/setup.ts`, `src/App.test.tsx`

**Interfaces:**
- Consumes: none.
- Produces: `App(): JSX.Element`; scripts `dev`, `build`, `test:run`, `data:build`, `test:e2e`.

- [ ] Write a failing test expecting heading `全球媒体舆情图谱` and the scope note `媒体报道，不代表全球公众意见`.
- [ ] Run `npm run test:run -- src/App.test.tsx`; verify it fails.
- [ ] Scaffold the pinned Sites React project in this directory without overwriting `docs/`.
- [ ] Implement the responsive application shell, labeled map region, filter region, and loading state for 5,543 records.
- [ ] Run the test and `npm run build`; verify both pass.
- [ ] Commit with `git commit -m "feat: scaffold global opinion atlas"`.

### Task 2: Ingest and validate the complete Excel workbook

**Files:**
- Create: `scripts/build-data.mjs`, `scripts/lib/normalize.mjs`, `scripts/lib/aggregate.mjs`
- Create: `scripts/build-data.test.mjs`
- Create: `public/data/articles.json`, `countries.json`, `locations.json`, `facets.json`, `metadata.json`

**Interfaces:**
- Consumes: `../TikTok难民涌入小红书 2025.01.15外媒数据.xlsx`.
- Produces: `normalizeRow(headers, cells, rowNumber): Article`; `aggregateCountries(articles): CountryAggregate[]`; five JSON artifacts.

- [ ] Write failing Node tests asserting 5,543 articles, 114 countries, both positional `来源类别` fields, and country totals summing to 5,543.
- [ ] Run `node --test scripts/build-data.test.mjs`; verify failure.
- [ ] Parse the first worksheet as arrays so duplicate headers cannot overwrite each other.
- [ ] Preserve stable article identity, source row, date/time, all text, location, sentiment, source, and metric fields; convert numeric blanks to `null` and retain zero.
- [ ] Aggregate every country, language, sentiment, media, domain, state, region, and city. Record valid-value counts, duplicates, parse failures, and unmapped country names.
- [ ] Run `npm run data:build` and the Node tests; verify 5,543/114 and exact reconciliation.
- [ ] Commit with `git commit -m "feat: ingest complete media dataset"`.

### Task 3: Implement the shared cross-filter data model

**Files:**
- Create: `src/data/types.ts`, `src/data/loadDataset.ts`, `src/data/selectors.ts`, `src/data/selectors.test.ts`
- Create: `src/state/FilterContext.tsx`

**Interfaces:**
- Consumes: Task 2 JSON.
- Produces: `loadDataset(): Promise<Dataset>`; `filterArticles(articles, filters)`; `summarizeArticles(articles)`; `FilterProvider`; `useFilters()`.

- [ ] Define nullable domain types and filters for country, subdivision, city, language, sentiment, domain, query, and time.
- [ ] Write failing tests for intersecting filters, required text-search fields, null-aware summaries, and reset to 5,543 records.
- [ ] Run `npm run test:run -- src/data/selectors.test.ts`; verify failure.
- [ ] Implement pure selectors and one shared filter state used by every view.
- [ ] Run selector tests; verify pass.
- [ ] Commit with `git commit -m "feat: add shared cross-filter model"`.

### Task 4: Build the global map and complete country explorer

**Files:**
- Create: `src/features/global/GlobalMap.tsx`, `GlobalMap.test.tsx`
- Create: `src/features/global/CountryRanking.tsx`, `CountryRanking.test.tsx`
- Create: `src/features/global/MetricSelector.tsx`, `useWorldGeometry.ts`
- Modify: `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `Dataset`, filtered summaries, and country filter actions.
- Produces: map/ranking selection and metric state `'mentions' | 'reach' | 'tone'`.

- [ ] Write failing tests proving all 114 countries remain searchable, metric switching changes ranking, and selection/reset updates the common result count.
- [ ] Run global feature tests; verify failure.
- [ ] Render published world geometry with `d3.geoNaturalEarth1`, ISO3 joins, log scales for volume/reach, and a sample-size-aware diverging tone scale.
- [ ] Keep unmapped countries in ranking and article views. Make all 114 countries searchable or expandable even when the default list is shorter.
- [ ] Run global tests and production build; verify pass.
- [ ] Commit with `git commit -m "feat: add global map and country explorer"`.

### Task 5: Add national, local, source, and article drill-down

**Files:**
- Create: `src/features/detail/Breadcrumbs.tsx`, `SentimentBreakdown.tsx`, `LanguageBreakdown.tsx`, `LocationBreakdown.tsx`, `SourceBreakdown.tsx`
- Create: `src/features/detail/DetailViews.test.tsx`
- Create: `src/features/articles/ArticleExplorer.tsx`, `ArticleExplorer.test.tsx`
- Modify: `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: shared filtered articles and actions from Task 3.
- Produces: coordinated detail views, location coverage, source selection, breadcrumbs, and paginated complete articles.

- [ ] Write failing tests for full sentiment counts, missing-aware location coverage, source cross-filtering, required text search, final-page access, and original links.
- [ ] Run detail/article tests; verify failure.
- [ ] Implement directly labeled sentiment, language, location, and source distributions with valid-value counts.
- [ ] Implement state/region/city rankings only where values exist; do not invent coordinates.
- [ ] Implement a paginated or virtualized article explorer so every matching record is reachable, with title, source, location, language, sentiment, reach, evidence text, keywords, and safe original link.
- [ ] Implement hierarchical breadcrumbs; clearing a parent clears dependent children, while global reset returns 5,543 records.
- [ ] Run feature tests and build; verify pass.
- [ ] Commit with `git commit -m "feat: add multilevel opinion drill-down"`.

### Task 6: Add data quality and finish acceptance verification

**Files:**
- Create: `src/features/quality/DataQuality.tsx`, `DataQuality.test.tsx`
- Create: `e2e/opinion-atlas.spec.ts`, `playwright.config.ts`, `README.md`
- Modify: `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: metadata and shared filter state.
- Produces: visible data-quality report, responsive accessible UI, repeatable operating guide, and end-to-end acceptance coverage.

- [ ] Write failing tests for record/date/country counts, metric coverage, sentiment distribution, duplicates, unmapped countries, and the complete select-filter-search-reset flow.
- [ ] Run quality tests; verify failure.
- [ ] Render metadata facts without hard-coded health claims; surface any nonzero parse, duplicate, or mapping issue.
- [ ] Finish keyboard/touch behavior, visible focus, non-color cues, and layouts without horizontal overflow at 360 px, 736 px, and desktop widths.
- [ ] Document `npm install`, `npm run data:build`, `npm run dev`, `npm run test:run`, `npm run test:e2e`, and `npm run build`.
- [ ] Run `npm run data:build`; verify exactly 5,543 articles and 114 countries.
- [ ] Run `npm run test:run`, `npm run test:e2e`, and `npm run build`; fix failures and rerun until all pass.
- [ ] Commit with `git commit -m "feat: complete and verify global opinion atlas"`.
