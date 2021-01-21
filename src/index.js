import './styles/index.scss';

import ThreeSetup from './modules/ThreeSetup';

window.APP = window.APP || {
  devMode: true,
};

const readyPromises = [];

if (window.APP.devMode) {
  const guiPromise = import(/* webpackChunkName: "gui" */ '@malven/gui').then(({ default: Gui }) => {
    // Add Gui and connect knobs for MidiFighter Twister
    window.APP.gui = new Gui();
    window.APP.gui.configureDevice('Midi Fighter Twister');
  }).catch(error => 'An error occurred while loading GUI');
  readyPromises.push(guiPromise);
}

Promise.all(readyPromises).then(() => {
  // Initialize custom code…
  new ThreeSetup();
});
