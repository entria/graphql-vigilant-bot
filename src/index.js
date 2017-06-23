// @flow

import 'babel-polyfill';
import './config';
import app from './app';

const port = process.env.PORT || 7001;

(async () => {
  await app.listen(port);
  console.log(`Bot started on port ${port}`);
})();
