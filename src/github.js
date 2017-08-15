// @flow

import GitHubApi from 'github';
import { version } from '../package.json';

const gh = new GitHubApi({
  debug: false,
  protocol: 'https',
  host: 'api.github.com',
  headers: {
    'User-Agent':
      `GraphQLVigilantBot/${version} (+https://github.com/entria/graphql-vigilant-bot)`,
  },
  followRedirects: false,
  timeout: 5000,
});

gh.authenticate({
  type: 'token',
  token: process.env.GITHUB_TOKEN,
});

export default gh;
