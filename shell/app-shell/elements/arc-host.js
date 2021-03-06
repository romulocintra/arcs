/*
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

import Xen from '../../components/xen/xen.js';
import Arcs from '../lib/arcs.js';
import ArcsUtils from '../lib/arcs-utils.js';

const log = Xen.logFactory('ArcHost', '#007ac1');
const error = Xen.logFactory('ArcHost', '#007ac1', 'error');

class ArcHost extends Xen.Debug(Xen.Base, log) {
  static get observedAttributes() {
    return ['config', 'plans', 'suggestions', 'plan', 'manifests', 'exclusions'];
  }
  _getInitialState() {
    return {
      pendingPlans: [],
      invalid: 0
    };
  }
  _willReceiveProps(props, state, lastProps) {
    const changed = name => props[name] !== lastProps[name];
    const {manifests, exclusions, config, plan, suggestions} = props;
    if (manifests && exclusions) {
      state.effectiveManifests = this._intersectManifests(props.manifests, props.exclusions);
    }
    if (config && (config !== state.config) && state.effectiveManifests) {
      state.config = config;
      state.config.manifests = state.effectiveManifests;
      this._applyConfig(state.config);
    }
    else if (state.arc && (changed('manifests') || changed('exclusions'))) {
      log('reloading');
      this._reloadManifests();
    }
    if (plan && changed('plan')) {
      state.pendingPlans.push(plan);
    }
    if (suggestions && changed('suggestions')) {
      state.slotComposer.setSuggestions(suggestions);
    }
  }
  _update({plans}, {arc, pendingPlans}) {
    if (arc && pendingPlans.length) {
      this._instantiatePlan(arc, pendingPlans.shift());
    }
    if (arc && !plans) {
      this._schedulePlanning();
    }
  }
  _intersectManifests(manifests, exclusions) {
    return manifests.filter(m => !exclusions.includes(m));
  }
  async _applyConfig(config) {
    let arc = await this._createArc(config);
    // TODO(sjmiles): IIUC callback that is invoked by runtime onIdle event
    arc.makeSuggestions = () => this._runtimeHandlesUpdated();
    log('created arc', arc);
    this._setState({arc});
    this._fire('arc', arc);
  }
  async _createArc(config) {
    // make an id
    let id = 'demo-' + ArcsUtils.randomId();
    // create a system loader
    let loader = this._marshalLoader(config);
    // load manifest
    let context = await this._loadManifest(config, loader);
    // composer
    let slotComposer = new Arcs.SlotComposer({
      rootContext: document.body, //this.parentElement,
      affordance: config.affordance,
      containerKind: config.containerKind,
      // TODO(sjmiles): typically resolved via `slotid="suggestions"`, but override is allowed here via config
      suggestionsContext: config.suggestionsNode
    });
    // capture composer so we can push suggestions there
    this._state.slotComposer = slotComposer;
    // send urlMap to the Arc so worker-entry*.js can create mapping loaders
    let urlMap = loader._urlMap;
    // Arc!
    return ArcsUtils.createArc({id, urlMap, slotComposer, context, loader});
  }
  _marshalLoader(config) {
    // create default URL map
    let urlMap = ArcsUtils.createUrlMap(config.root);
    // create a system loader
    // TODO(sjmiles): `pecFactory` creates loader objects (via worker-entry*.js) for the innerPEC,
    // but we have to create one by hand for manifest loading
    let loader = new Arcs.BrowserLoader(urlMap);
    // add `urls` to `urlMap` after a resolve pass
    if (config.urls) {
      Object.keys(config.urls).forEach(k => urlMap[k] = loader._resolve(config.urls[k]));
    }
    return loader;
  }
  async _loadManifest(config, loader) {
    const {folder, content} = this._fetchManifestContent(config);
    // TODO(sjmiles): used to be `${folder}/`, which is `./` which isn't descriptive
    const manifestFileName = './computed.manifest';
    let manifest;
    try {
      manifest = await ArcsUtils.parseManifest(manifestFileName, content, loader);
    } catch (x) {
      console.warn(x);
      manifest = ArcsUtils.parseManifest(manifestFileName, '', loader);
    }
    return manifest;
  }
  _fetchManifestContent(config) {
    let manifests;
    if (config.soloPath) {
      manifests = [config.soloPath];
    } else {
      manifests = config.manifests ? config.manifests.slice() : [];
      if (config.manifestPath) {
        manifests.push(config.manifestPath);
      }
    }
    return {
      folder: '.',
      content: manifests.map(u => `import '${u}'`).join('\n')
    };
  }
  async _reloadManifests() {
    let {arc} = this._state;
    arc._context = await this._loadManifest(this._props.config, arc.loader);
    this._fire('plans', null);
  }
  _runtimeHandlesUpdated() {
    !this._state.planning && log('runtimeHandlesUpdated');
    this._schedulePlanning();
  }
  async _schedulePlanning() {
    const state = this._state;
    // results obtained before now are invalid
    state.invalid = true;
    // only wait for one _beginPlanning at a time
    if (!state.planning) {
      state.planning = true;
      try {
        await this.__beginPlanning(state);
      } catch (x) {
        error(x);
      }
      state.planning = false;
    }
  }
  // TODO(sjmiles): only to be called from _schedulePlanning which protects re-entrancy
  async __beginPlanning(state) {
    log(`planning...`);
    let time = Date.now();
    let plans;
    while (state.invalid) {
      state.invalid = false;
      plans = await ArcsUtils.makePlans(state.arc, state.config.plannerTimeout) || [];
    }
    time = ((Date.now() - time) / 1000).toFixed(2);
    log(`plans`, plans, `${time}s`);
    this._fire('plans', plans);
  }
  async _instantiatePlan(arc, plan) {
    // aggressively remove old suggestions when a suggestion is applied
    this._setState({suggestions: []});
    log('instantiated plan', plan);
    await arc.instantiate(plan);
    this._fire('plan', plan);
  }
}
ArcHost.groupCollapsed = Xen.logFactory('ArcHost', '#007ac1', 'groupCollapsed');
customElements.define('arc-host', ArcHost);
