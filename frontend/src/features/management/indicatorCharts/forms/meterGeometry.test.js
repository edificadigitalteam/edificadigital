import test from 'node:test'
import assert from 'node:assert/strict'

import { GAUGE_RADIUS, clampCompletion, gaugeArc, meterSegments } from './meterGeometry.js'

test('T9 completion is clamped for the drawing without touching the reported figure', () => {
  assert.equal(clampCompletion(0), 0)
  assert.equal(clampCompletion(45.4), 45.4)
  assert.equal(clampCompletion(180), 100)
  assert.equal(clampCompletion(-12), 0)
  assert.equal(clampCompletion(null), 0)
  assert.equal(clampCompletion(Number.NaN), 0)
})

test('T9b the gauge arc spans the full circumference at 100% and nothing at 0%', () => {
  const full = gaugeArc(100)
  assert.equal(Number(full.dash.toFixed(2)), Number(full.circumference.toFixed(2)))
  assert.equal(gaugeArc(0).dash, 0)
  assert.equal(Number(gaugeArc(50).dash.toFixed(2)), Number((gaugeArc(100).circumference / 2).toFixed(2)))
  assert.equal(Number(gaugeArc(250).dash.toFixed(2)), Number(gaugeArc(100).circumference.toFixed(2)))
  assert.equal(gaugeArc(100).circumference, 2 * Math.PI * GAUGE_RADIUS)
})

test('T9c the meter reports the achieved share and whether the target was passed', () => {
  assert.deepEqual(meterSegments(40), { achieved: 40, exceeded: false })
  assert.deepEqual(meterSegments(100), { achieved: 100, exceeded: false })
  assert.deepEqual(meterSegments(140), { achieved: 100, exceeded: true })
  assert.deepEqual(meterSegments(null), { achieved: 0, exceeded: false })
})
