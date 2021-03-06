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
import StrategyTestHelper from './strategy-test-helper.js';
import ConvertConstraintsToConnections from '../../strategies/convert-constraints-to-connections.js';
import {assert} from '../chai-web.js';

describe('ConvertConstraintsToConnections', async () => {

  it('fills out an empty constraint', async () => {
    let recipe = (await Manifest.parse(`
      schema S
      particle A
        A(inout S b)
      particle C
        C(inout S d)

      recipe
        A.b -> C.d`)).recipes[0];
    let inputParams = {generated: [{result: recipe, score: 1}]};
    let cctc = new ConvertConstraintsToConnections({pec: {}});
    let results = await cctc.generate(inputParams);
    assert.equal(1, results.length);
    let {result, score} = results[0];
    assert.deepEqual(result.toString(),
`recipe
  create as view0 // S {}
  A as particle0
    b = view0
  C as particle1
    d = view0`);
  });

  it('does not cause an input only handle to be created', async () => {
    let recipe = (await Manifest.parse(`
      schema S
      particle A
        A(in S b)
      particle C
        C(in S d)

      recipe
        A.b -> C.d`)).recipes[0];
    let inputParams = {generated: [{result: recipe, score: 1}]};
    let cctc = new ConvertConstraintsToConnections({pec: {}});
    let results = await cctc.generate(inputParams);
    assert.equal(0, results.length);
  });

  it('can resolve input only handle connection with a mapped handle', async () => {
    let recipe = (await Manifest.parse(`
      schema S
      particle A
        A(in S b)
      particle C
        C(in S d)

      recipe
        map as v0
        A.b -> C.d`)).recipes[0];
    let inputParams = {generated: [{result: recipe, score: 1}]};
    let cctc = new ConvertConstraintsToConnections({pec: {}});
    let results = await cctc.generate(inputParams);
    assert.equal(1, results.length);
  });

  it('can create handle for input and output handle', async () => {
    let createRecipe = async (constraint1, constraint2) => (await Manifest.parse(`
      schema S
      particle A
        A(in S b)
      particle C
        C(in S d)
      particle E
        E(out S f)

      recipe
        ${constraint1}
        ${constraint2}`)).recipes[0];
    let verify = async (constraint1, constraint2) => {
      let recipe = await createRecipe(constraint1, constraint2);
      let inputParams = {generated: [{result: recipe, score: 1}]};
      let cctc = new ConvertConstraintsToConnections({pec: {}});
      let results = await cctc.generate(inputParams);
      assert.equal(1, results.length, `Failed to resolve ${constraint1} & ${constraint2}`);
    };
    // Test for all possible combination of connection constraints with 3 particles.
    let constraints = [['A.b -> C.d', 'C.d -> A.b'], ['A.b -> E.f', 'E.f -> A.b'], ['C.d -> E.f', 'E.f -> C.d']];
    for (let i = 0; i < constraints.length; ++i) {
      for (let j = 0; j < constraints.length; ++j) {
        if (i == j) continue;
        for (let ii = 0; ii <= 1; ++ii) {
          for (let jj = 0; jj <= 1; ++jj) {
            await verify(constraints[i][ii], constraints[j][jj]);
          }
        }
      }
    }
  });

  it('fills out a constraint, reusing a single particle', async () => {
    let recipe = (await Manifest.parse(`
      schema S
      particle A
        A(inout S b)
      particle C
        C(inout S d)

      recipe
        A.b -> C.d
        C`)).recipes[0];
    let inputParams = {generated: [{result: recipe, score: 1}]};
    let cctc = new ConvertConstraintsToConnections({pec: {}});
    let results = await cctc.generate(inputParams);
    assert.equal(1, results.length);
    let {result, score} = results[0];
    assert.deepEqual(result.toString(),
`recipe
  create as view0 // S {}
  A as particle0
    b = view0
  C as particle1
    d = view0`);
  });

  it('fills out a constraint, reusing a single particle (2)', async () => {
    let recipe = (await Manifest.parse(`
      schema S
      particle A
        A(inout S b)
      particle C
        C(inout S d)

      recipe
        A.b -> C.d
        A`)).recipes[0];
    let inputParams = {generated: [{result: recipe, score: 1}]};
    let cctc = new ConvertConstraintsToConnections({pec: {}});
    let results = await cctc.generate(inputParams);
    assert.equal(1, results.length);
    let {result, score} = results[0];
    assert.deepEqual(result.toString(),
`recipe
  create as view0 // S {}
  A as particle0
    b = view0
  C as particle1
    d = view0`);
  });


  it('fills out a constraint, reusing two particles', async () => {
    let recipe = (await Manifest.parse(`
      schema S
      particle A
        A(inout S b)
      particle C
        C(inout S d)

      recipe
        A.b -> C.d
        C
        A`)).recipes[0];
    let inputParams = {generated: [{result: recipe, score: 1}]};
    let cctc = new ConvertConstraintsToConnections({pec: {}});
    let results = await cctc.generate(inputParams);
    assert.equal(1, results.length);
    let {result, score} = results[0];
    assert.deepEqual(result.toString(),
`recipe
  create as view0 // S {}
  A as particle0
    b = view0
  C as particle1
    d = view0`);
  });

  it('fills out a constraint, reusing two particles and a view', async () => {
    let recipe = (await Manifest.parse(`
      schema S
      particle A
        A(inout S b)
      particle C
        C(inout S d)

      recipe
        A.b -> C.d
        use as v1
        C
          d = v1
        A`)).recipes[0];
    let inputParams = {generated: [{result: recipe, score: 1}]};
    let cctc = new ConvertConstraintsToConnections({pec: {}});
    let results = await cctc.generate(inputParams);
    assert.equal(1, results.length);
    let {result, score} = results[0];
    assert.deepEqual(result.toString(),
`recipe
  use as view0 // S {}
  A as particle0
    b = view0
  C as particle1
    d = view0`);
  });

  it('fills out a constraint, reusing two particles and a view (2)', async () => {
    let recipe = (await Manifest.parse(`
      schema S
      particle A
        A(inout S b)
      particle C
        C(inout S d)

      recipe
        A.b -> C.d
        use as v1
        C
        A
          b = v1`)).recipes[0];
    let inputParams = {generated: [{result: recipe, score: 1}]};
    let cctc = new ConvertConstraintsToConnections({pec: {}});
    let results = await cctc.generate(inputParams);
    assert.equal(1, results.length);
    let {result, score} = results[0];
    assert.deepEqual(result.toString(),
`recipe
  use as view0 // S {}
  A as particle0
    b = view0
  C as particle1
    d = view0`);
  });

  it('removes an already fulfilled constraint', async () => {
    let recipe = (await Manifest.parse(`
      schema S
      particle A
        A(inout S b)
      particle C
        C(inout S d)

      recipe
        A.b -> C.d
        use as v1
        C
          d = v1
        A
          b = v1`)).recipes[0];
    let inputParams = {generated: [{result: recipe, score: 1}]};
    let cctc = new ConvertConstraintsToConnections({pec: {}});
    let results = await cctc.generate(inputParams);
    assert.equal(1, results.length);
    let {result, score} = results[0];
    assert.deepEqual(result.toString(), `recipe
  use as view0 // S {}
  A as particle0
    b = view0
  C as particle1
    d = view0`);
  });

  it('verifies affordance', async () => {
    let recipes = (await Manifest.parse(`
      schema S
      particle A in 'A.js'
        A(out S b)
        affordance voice
        consume root
      particle C in 'C.js'
        C(in S d)
        affordance voice
        consume root
      particle E in 'E.js'
        E(in S f)
        consume root

      recipe
        A.b -> C.d
      recipe
        A.b -> E.f
    `)).recipes;
    let inputParams = {generated: [{result: recipes[0], score: 1}, {result: recipes[1], score: 1}]};
    let cctc = new ConvertConstraintsToConnections({pec: {slotComposer: {affordance: 'voice'}}});
    let results = await cctc.generate(inputParams);
    assert.equal(results.length, 1);
    assert.deepEqual(results[0].result.particles.map(p => p.name), ['A', 'C']);
  });
});
