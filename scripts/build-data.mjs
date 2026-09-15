import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json' with { type: 'json' };

countries.registerLocale(en);
const here = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(here, '..');

const at = (row, index) => row[index] ?? null;
const text = (value) => value == null || value === '' ? null : String(value);
const number = (value) => value == null || value === '' || Number.isNaN(Number(value)) ? null : Number(value);
const isoFix = { 'Hong Kong': 'HKG', Macao: 'MAC', Taiwan: 'TWN', Russia: 'RUS', Turkey: 'TUR', Vietnam: 'VNM', 'South Korea': 'KOR', 'North Korea': 'PRK', Iran: 'IRN', 'United States': 'USA', 'United Kingdom': 'GBR', 'British Virgin Islands': 'VGB', Brunei: 'BRN', Moldova: 'MDA' };

function iso3(name) {
  return isoFix[name] || countries.getAlpha3Code(name, 'en') || null;
}

function countBy(rows, field) {
  const map = new Map();
  for (const row of rows) {
    const key = row[field];
    if (key == null || key === '') continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function aggregateCountries(articles) {
  const map = new Map();
  for (const row of articles) {
    const item = map.get(row.country) || { country: row.country, iso3: row.iso3, mentions: 0, reach: 0, reachValid: 0, engagement: 0, engagementValid: 0, sentiment: { positive: 0, neutral: 0, negative: 0, unknown: 0 }, languages: {}, sources: {} };
    item.mentions += 1;
    if (row.reach != null) { item.reach += row.reach; item.reachValid += 1; }
    if (row.engagement != null) { item.engagement += row.engagement; item.engagementValid += 1; }
    item.sentiment[row.sentiment] = (item.sentiment[row.sentiment] || 0) + 1;
    item.languages[row.language] = (item.languages[row.language] || 0) + 1;
    item.sources[row.sourceDomain] = (item.sources[row.sourceDomain] || 0) + 1;
    map.set(row.country, item);
  }
  return [...map.values()].sort((a, b) => b.mentions - a.mentions);
}

export async function buildDataset(workbookPath) {
  const bytes = await fs.readFile(path.resolve(PROJECT, workbookPath));
  const workbook = XLSX.read(bytes, { type: 'buffer', cellDates: true });
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: null, raw: false });
  const headers = matrix[0].map(String);
  const duplicateHeaders = {};
  headers.forEach((header, index) => {
    const positions = headers.reduce((all, value, i) => value === header ? [...all, i] : all, []);
    if (positions.length > 1) duplicateHeaders[header] = positions;
  });
  const articles = matrix.slice(1).map((row, offset) => ({
    rowNumber: offset + 2,
    date: text(at(row, 0)), publishTime: text(at(row, 1)), articleId: text(at(row, 2)) || `row-${offset + 2}`,
    url: text(at(row, 3)), project: text(at(row, 4)), queryKeywords: text(at(row, 5)),
    sourceCategory1: text(at(row, 6)), sourceCategory2: text(at(row, 7)), sourceName: text(at(row, 8)), sourceDomain: text(at(row, 9)), contentType: text(at(row, 10)),
    author: text(at(row, 11)), authorUsername: text(at(row, 12)), title: text(at(row, 13)), lead: text(at(row, 14)), matchedSentence: text(at(row, 15)), image: text(at(row, 16)), hashtags: text(at(row, 17)), links: text(at(row, 18)),
    country: text(at(row, 19)) || 'Unknown', iso3: iso3(text(at(row, 19))), region: text(at(row, 20)), state: text(at(row, 21)), city: text(at(row, 22)), language: text(at(row, 23)) || 'Unknown', sentiment: text(at(row, 24)) || 'unknown', keywordSentence: text(at(row, 25)),
    reach: number(at(row, 26)), globalReachRate: number(at(row, 27)), nationalReachRate: number(at(row, 28)), localReachRate: number(at(row, 29)), episodeReachRate: number(at(row, 30)), adValue: number(at(row, 31)), earnedMediaValue: number(at(row, 32)), socialEcho: number(at(row, 33)), articleEcho: number(at(row, 34)), engagement: number(at(row, 35)), shares: number(at(row, 36)), quotes: number(at(row, 37)), likes: number(at(row, 38)), replies: number(at(row, 39)), reposts: number(at(row, 40)), comments: number(at(row, 41)), likeCount: number(at(row, 42)), views: number(at(row, 43)), potentialViews: number(at(row, 44)),
    articleTags: text(at(row, 45)), customCategory: text(at(row, 46)), customField: text(at(row, 47)), brandSentiment: text(at(row, 48))
  }));
  const countriesData = aggregateCountries(articles);
  const keyFields = ['country','region','state','city','language','sentiment','sourceName','sourceDomain','reach','engagement','shares','potentialViews'];
  const coverage = Object.fromEntries(keyFields.map(field => [field, { valid: articles.filter(row => row[field] != null).length, total: articles.length }]));
  const duplicates = (field) => [...articles.reduce((map, row) => row[field] ? map.set(row[field], (map.get(row[field]) || 0) + 1) : map, new Map())].filter(([, count]) => count > 1).length;
  const metadata = { sourceFile: path.basename(workbookPath), sheet: workbook.SheetNames[0], articleCount: articles.length, countryCount: countriesData.length, dateMin: articles.map(d => d.date).filter(Boolean).sort()[0], dateMax: articles.map(d => d.date).filter(Boolean).sort().at(-1), duplicateHeaders, duplicateArticleIds: duplicates('articleId'), duplicateUrls: duplicates('url'), coverage, unmappedCountries: countriesData.filter(d => !d.iso3).map(d => d.country) };
  return {
    articles,
    countries: countriesData,
    locations: { regions: countBy(articles, 'region'), states: countBy(articles, 'state'), cities: countBy(articles, 'city') },
    facets: { languages: countBy(articles, 'language'), sentiments: countBy(articles, 'sentiment'), sources: countBy(articles, 'sourceDomain') },
    metadata
  };
}

async function main() {
  const workbookPath = process.argv[2] || '../TikTok难民涌入小红书 2025.01.15外媒数据.xlsx';
  const output = await buildDataset(workbookPath);
  const outDir = path.join(PROJECT, 'public', 'data');
  await fs.mkdir(outDir, { recursive: true });
  await Promise.all(Object.entries(output).map(([name, value]) => fs.writeFile(path.join(outDir, `${name}.json`), JSON.stringify(value))));
  console.log(JSON.stringify({ articles: output.metadata.articleCount, countries: output.metadata.countryCount, unmapped: output.metadata.unmappedCountries }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
