// @license
// Copyright (c) 2017 Google Inc. All rights reserved.
// This code may only be used under the BSD style license found at
// http://polymer.github.io/LICENSE.txt
// Code distributed by Google as part of this project is also
// subject to an additional IP rights grant found at
// http://polymer.github.io/PATENTS.txt

'use strict';

defineParticle(({Particle}) => {
  return class Hello extends Particle {
    setViews(views) {
      const Bar = views.get('bar').entityClass;
      views.get('foo').get().then(result => {
        let bar = views.get('bar');
        bar.set(new bar.entityClass({value: result.value + 1}));
      });
      // TODO: what is this meant to do?
      return 9;
    }
  };
});
