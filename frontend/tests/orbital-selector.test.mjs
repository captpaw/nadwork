import test from 'node:test';
import assert from 'node:assert/strict';
import { selectOrbitalBounties, getBountyId, readBountyField } from '../src/utils/orbital.mjs';

function tupleBounty({ id, title, category = 'dev', status = 0, totalReward = 0n, featured = false }) {
  const arr = [];
  arr[0] = BigInt(id);
  arr[3] = title;
  arr[4] = category;
  arr[6] = status;
  arr[9] = BigInt(totalReward);
  arr[15] = featured;
  return arr;
}

test('readBountyField supports tuple-like arrays', () => {
  const b = tupleBounty({ id: 10, title: 'Tuple Item', totalReward: 5n });
  assert.equal(readBountyField(b, 'id', 0), 10n);
  assert.equal(readBountyField(b, 'title', 3), 'Tuple Item');
  assert.equal(readBountyField(b, 'totalReward', 9), 5n);
});

test('selectOrbitalBounties returns up to 6 unique ids', () => {
  const source = [
    { id: 1, status: 0, totalReward: 1n },
    { id: 2, status: 0, totalReward: 2n },
    { id: 3, status: 0, totalReward: 3n },
    { id: 4, status: 0, totalReward: 4n },
    { id: 5, status: 0, totalReward: 5n },
    { id: 6, status: 0, totalReward: 6n },
    { id: 7, status: 0, totalReward: 7n },
    { id: 6, status: 0, totalReward: 6n },
  ];

  const selected = selectOrbitalBounties(source);
  const ids = selected.map((b) => String(getBountyId(b)));

  assert.equal(selected.length, 6);
  assert.equal(new Set(ids).size, 6);
});

test('active bounties are prioritized, then non-active top-up fills slots', () => {
  const source = [
    { id: 1, status: 0, totalReward: 1n },
    { id: 2, status: 1, totalReward: 7n },
    { id: 3, status: 2, totalReward: 6n },
    { id: 4, status: 3, totalReward: 5n },
  ];

  const selected = selectOrbitalBounties(source, 4);
  const ids = selected.map((b) => Number(getBountyId(b)));

  assert.equal(ids[0], 1);
  assert.deepEqual(ids.sort((a, b) => a - b), [1, 2, 3, 4]);
});

test('featured items are ordered before regular items', () => {
  const source = [
    { id: 1, status: 0, totalReward: 1n, featured: false },
    { id: 2, status: 0, totalReward: 2n, featured: true },
    { id: 3, status: 0, totalReward: 3n, featured: false },
    { id: 4, status: 0, totalReward: 4n, featured: true },
  ];

  const ids = selectOrbitalBounties(source, 4).map((b) => Number(getBountyId(b)));

  assert.deepEqual(ids.slice(0, 2), [4, 2]);
});

test('selector works with tuple-like contract results', () => {
  const source = [
    tupleBounty({ id: 7, title: 'Seven', status: 0, totalReward: 4n, featured: false }),
    tupleBounty({ id: 6, title: 'Six', status: 0, totalReward: 5n, featured: true }),
    tupleBounty({ id: 5, title: 'Five', status: 0, totalReward: 2n, featured: false }),
  ];

  const selected = selectOrbitalBounties(source, 3);
  const ids = selected.map((b) => Number(getBountyId(b)));

  assert.deepEqual(ids, [6, 7, 5]);
});

