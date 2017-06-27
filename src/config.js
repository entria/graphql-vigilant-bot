// @flow

import path from 'path';
import dotenvSafe from 'dotenv-safe';

const root = path.join.bind(this, __dirname, '../');

dotenvSafe.load({
  path: root('.env'),
  allowEmptyValues: true,
  sample: root('.env.example'),
});
