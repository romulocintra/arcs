/**
 * @license
 * Copyright (c) 2017 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
"use strict";

var Particle = require("../../runtime/particle.js").Particle;
var runtime = require("../../runtime/runtime.js");

class Product extends runtime.Entity {
    constructor(name) {
    super();
    this._data = {name};
  }

  get data() { return this._data; }

  static get key() { return "Product"; }
}

class WishlistFor extends Particle {

  dataUpdated() {
    this.wishlist = [new Product("a new bike!"), new Product("Fresh Puppies"), new Product("A packet of Tim Loh that never runs out")];
    this.commitData(5);
  }
}

module.exports = WishlistFor;