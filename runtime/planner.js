// Copyright (c) 2017 Google Inc. All rights reserved.
// This code may only be used under the BSD style license found at
// http://polymer.github.io/LICENSE.txt
// Code distributed by Google as part of this project is also
// subject to an additional IP rights grant found at
// http://polymer.github.io/PATENTS.txt

let {Strategy, Strategizer} = require('../strategizer/strategizer.js');
var assert = require("assert");
let oldRecipe = require('./recipe.js');
let Recipe = require('./recipe/recipe.js');
let RecipeUtil = require('./recipe/recipe-util.js');
let RecipeWalker = require('./recipe/walker.js');
let ConvertConstraintsToConnections = require('./strategies/convert-constraints-to-connections.js');
let AssignRemoteViews = require('./strategies/assign-remote-views.js');
let AssignViewsByTagAndType = require('./strategies/assign-views-by-tag-and-type.js');


class InitPopulation extends Strategy {
  async generate(strategizer) {
    if (strategizer.generation == 0) {
      var r = new oldRecipe.NewRecipeBuilder()
      .addParticle("Chooser")
        .connectConstraint("resultList", "list")
        .addParticle("Recommend")
          .connectConstraint("known", "list")
          .connectConstraint("population", "wishlist")
          .tag("gift list")
        .addParticle("SaveList")
          .connectConstraint("list", "list")
        .addParticle("ListView")
          .connectConstraint("list", "list")

        .build();

        r.newConnectionConstraint("Chooser", "choices", "Recommend", "recommendations");

        r.normalize();
        return { results: [{result: r, score: 1, derivation: [{strategy: this, parent: undefined}], hash: r.digest() }], generate: null };
     }
     return { results: [], generate: null };
  }
}

class ResolveParticleByName extends Strategy {
  constructor(loader) {
    super();
    this.loader = loader;
  }
  async generate(strategizer) {
    var loader = this.loader;
    var results = Recipe.over(strategizer.generated, new class extends RecipeWalker {
      onParticle(recipe, particle) {
        if (particle.spec == undefined) {
          var spec = loader.loadParticleSpec(particle.name, true);
          if (spec == undefined)
            return;
          return (recipe, particle) => {particle.spec = spec; return 1};
        }
      }
    }(RecipeWalker.Permuted), this);

    return { results, generate: null };
  }
}

class CreateViews extends Strategy {
  // TODO: move generation to use an async generator.
  async generate(strategizer) {
    var results = Recipe.over(strategizer.generated, new class extends RecipeWalker {
      onView(recipe, view) {
        var counts = RecipeUtil.directionCounts(view);

        var score = 1;
        if (counts.in == 0 || counts.out == 0) {
          if (counts.unknown > 0)
            return;
          if (counts.in == 0)
            score = -1;
          else
            score = 0;
        }

        if (!view.id && !view.create) {
          return (recipe, view) => {view.create = true; return score}
        }
      }
    }(RecipeWalker.Permuted), this);

    return { results, generate: null };
  }
}

class MatchConsumedSlots extends Strategy {
  async generate(strategizer) {
    var results = Recipe.over(strategizer.generated, new class extends RecipeWalker {
      onSlotConnection(recipe, slotConnection) {
        if (slotConnection.direction == "provide")
          return;
        if (slotConnection.slot)
          return;
        return (recipe, slotConnection) => {
          // TODO: handle slots that don't have a provider (like "root" slot)
          var slot = recipe.slots.find((s) => {return s.providerConnection && s.providerConnection.name == slotConnection.name});
          if (!slot)
            return 0;
          // TODO: verify set of slot.providerConnection.viewConnections[i].view.id contains
          // the set of (or at least one of? TBD) slotConnection.viewConnections[i].view.id
          slotConnection.connectToSlot(slot);
          return 1;
        };
      }
    }(RecipeWalker.Permuted), this);

    return { results, generate: null };
  }
}


class Planner {
  init(arc, context) {
    let strategies = [
      new InitPopulation(),
      new CreateViews(),
      new ResolveParticleByName(arc._loader),
      new AssignViewsByTagAndType(arc),
      new ConvertConstraintsToConnections(),
      new MatchConsumedSlots(),
      new AssignRemoteViews(arc, arc._loader, context),
    ];
    this.strategizer = new Strategizer(strategies, [], {
      maxPopulation: 100,
      generationSize: 100,
      discardSize: 20,
    });
  }

  async generate() {
    var log = await this.strategizer.generate();
    return this.strategizer.generated;
  }

  async plan(arc) {
    this.init(arc);
    // TODO: Repeat until...?

    await this.generate();
    await this.generate();
    await this.generate();
    return this.strategizer.population; //.filter(possiblePlan => possiblePlan.ready);
  }
}

module.exports = Planner;
