/**
 * @license
 * Copyright (c) 2018 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
'use strict';

import Manifest from '../../manifest.js';
import Recipe from '../../recipe/recipe.js';
import StrategyTestHelper from './strategy-test-helper.js';
import CreateViews from '../../strategies/create-views.js';
import {assert} from '../chai-web.js';

describe('CreateViews', function() {
  const testManifest = async (recipeManifest, expectedToAssignFate) => {
    let manifest = (await Manifest.parse(`
      schema Thing

      particle Reader in 'test.js'
        Reader(in Thing foo)
      particle Writer in 'test.js'
        Writer(out Thing foo)
      particle ReadWriter in 'test.js'
        ReadWriter(inout Thing foo)

      ${recipeManifest}
    `));
    let inputParams = {generated: [{result: manifest.recipes[0], score: 1}]};
    let arc = StrategyTestHelper.createTestArc('test-plan-arc', manifest, 'dom');
    let results = await new CreateViews(arc).generate(inputParams);

    if (!expectedToAssignFate) {
      assert.equal(results.length, 0);
    } else {
      assert.equal(results.length, 1);
      assert.isTrue(results[0].result.isResolved());
    }
  };

  const assertAssignsFate = async recipeManifest => testManifest(recipeManifest, true);
  const assertDoesntAssignFate = async recipeManifest => testManifest(recipeManifest, false);

  it('doesnt work with a single reader', async () => {
    await assertDoesntAssignFate(`
      recipe
        ? as view
        Reader
          foo <- view`);
  });

  it('doesnt work with a single writer', async () => {
    await assertDoesntAssignFate(`
      recipe
        ? as view
        Writer
          foo -> view`);
  });

  it('doesnt work with a single reader-writer', async () => {
    await assertDoesntAssignFate(`
      recipe
        ? as view
        ReadWriter
          foo = view`);
  });

  it('doesnt work with many readers', async () => {
    await assertDoesntAssignFate(`
      recipe
        ? as view
        Reader
          foo <- view
        Reader
          foo <- view`);
  });

  it('doesnt work with many writers', async () => {
    await assertDoesntAssignFate(`
      recipe
        ? as view
        Writer
          foo -> view
        Writer
          foo -> view`);
  });

  it('works with many reader-writers', async () => {
    await assertAssignsFate(`
      recipe
        ? as view
        ReadWriter
          foo = view
        ReadWriter
          foo = view`);
  });

  it('works with one reader and one writer', async () => {
    await assertAssignsFate(`
      recipe
        ? as view
        Reader
          foo <- view
        Writer
          foo -> view`);
  });

  it('works with multiple different connections', async () => {
    await assertAssignsFate(`
      recipe
        ? as view
        Reader
          foo <- view
        Writer
          foo -> view
        ReadWriter
          foo = view
        Reader
          foo <- view`);
  });
});
