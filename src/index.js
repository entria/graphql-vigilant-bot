// @flow

import 'babel-polyfill';
import app from './app';
import { PORT } from './config';

const port = PORT || 7010;

(async () => {
  await app.listen(port);
  console.log(`GraphQLVigilantBot started on port ${port}`);
})();
