import test from 'node:test'
import assert from 'node:assert/strict'

function toNormalizedBbox(bbox, pageSize) {
  const x = Number(bbox.x)
  const y = Number(bbox.y)
  const w = Number(bbox.w)
  const h = Number(bbox.h)
  const unit = bbox.unit || 'normalized'
  const width = unit === 'points' ? pageSize.width : 1
  const height = unit === 'points' ? pageSize.height : 1
  let result = { x: x / width, y: y / height, w: w / width, h: h / height }
  if (bbox.origin === 'bottom-left' || bbox.origin === 'pdf') result.y = 1 - result.y - result.h
  return result
}

test('normalized bbox remains the same page percentage', () => {
  const bbox = toNormalizedBbox({ x: 0.19, y: 0.37, w: 0.12, h: 0.04 }, { width: 595, height: 842 })
  assert.deepEqual(bbox, { x: 0.19, y: 0.37, w: 0.12, h: 0.04 })
})

test('bottom-left PDF coordinates are converted to top-left coordinates', () => {
  const bbox = toNormalizedBbox({ x: 113.05, y: 496.78, w: 71.4, h: 33.68, unit: 'points', origin: 'bottom-left' }, { width: 595, height: 842 })
  assert.equal(Number(bbox.x.toFixed(4)), 0.19)
  assert.equal(Number(bbox.y.toFixed(4)), 0.37)
  assert.equal(Number(bbox.w.toFixed(4)), 0.12)
  assert.equal(Number(bbox.h.toFixed(4)), 0.04)
})
