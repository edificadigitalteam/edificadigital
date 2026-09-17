import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const featuresDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const chartDirectory = join(featuresDirectory, 'management', 'indicatorCharts')

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(js|jsx)$/.test(entry) ? [path] : []
  })
}

test('T7 the charting library stays inside indicatorCharts, away from the public and donation bundles', () => {
  const offenders = sourceFiles(featuresDirectory)
    .filter((path) => !path.startsWith(chartDirectory))
    .filter((path) => /@visx\//.test(readFileSync(path, 'utf8')))
  assert.deepEqual(offenders, [], `@visx imported outside indicatorCharts: ${offenders.join(', ')}`)
})

test('T7b the chart entry point reaches its visx forms through a lazy boundary', () => {
  const entry = readFileSync(join(chartDirectory, 'IndicatorChart.jsx'), 'utf8')
  assert.match(entry, /React\.lazy|\blazy\(/)
  assert.match(entry, /Suspense/)
  assert.doesNotMatch(entry, /from '@visx\//)
})
