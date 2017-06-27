// @flow

import GitHubApi from 'github';
import { version } from '../package.json';

import type { GhCommit } from './TypeDefinition';

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

export const getLoggedUser = async () => gh.users.get({});

export const findThisBotComment = async (
  owner: string,
  repo: string,
  pullRequestNumber: number,
  thisBot: any,
  currentPage: ?number = 1,
) => {
  const result = await gh.issues.getComments({
    owner,
    repo,
    number: pullRequestNumber,
    per_page: 50,
    page: currentPage,
  });

  const comments = result.data;

  let found = comments.find(comment => comment.user.id === thisBot.id);

  if (!found && gh.hasNextPage(result)) {
    found = await findThisBotComment(owner, repo, pullRequestNumber, thisBot, currentPage + 1);
  }

  return found;
};

export const getFileContent = async (owner: string, repo: string, path: string, ref: string) =>
  gh.repos.getContent({
    owner,
    repo,
    path,
    ref,
  });

export const getFilesFromCommit = async (owner: string, repo: string, sha: string) => {
  const { data }: { data: GhCommit } = await gh.repos.getCommit({
    owner,
    repo,
    sha,
  });

  return data.files;
};

export const updateComment = async (owner: string, repo: string, id: string, body: string) =>
  gh.issues.editComment({
    owner,
    repo,
    id,
    body,
  });

export const createComment = async (owner: string, repo: string, pullRequestNumber: string, body: string) =>
  gh.issues.createComment({
    owner,
    repo,
    number: pullRequestNumber,
    body,
  });
