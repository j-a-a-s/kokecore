import assert from 'node:assert/strict';
import test from 'node:test';

import { runPackagedConsumerContract } from '../../scripts/lib/consumer-contract.mjs';

test('installs and runs the reference consumer from packed artifacts', () => {
  const result = runPackagedConsumerContract();
  assert.equal(result.packageCount, 8);
  assert.match(result.output, /REFERENCE_CONSUMER_OK/);
});
