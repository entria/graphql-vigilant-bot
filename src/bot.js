// @flow

import { buildSchema, findBreakingChanges, GraphQLError } from 'graphql';
import _ from 'lodash';

import type { GitHubApi } from 'github';
import type { BreakingChange } from 'graphql';

import replacers from './replacers';

import type { GhCommit, GhFile, AnalysisResult } from './TypeDefinition';

const GITHUB_PR_OPENED = 'opened';
const GITHUB_PR_SYNCHRONIZED = 'synchronize';
const BOT_IDENTIFIER = '<!--bot:entria/graphql-vigilant-->';
const FILE_FILTER = /.*(.graphql|.gql)$/;

const validActions = [GITHUB_PR_OPENED, GITHUB_PR_SYNCHRONIZED];

export default class Bot {

  gh: GitHubApi;

  constructor(gh: GitHubApi) {
    this.gh = gh;
  }

  static getMessagesForBreakingChanges(breakingChangeType: string, breakingChanges: Array<BreakingChange>) {
    const replacer = replacers[breakingChangeType];
    const messages = [replacer.title];

    breakingChanges.reduce((arr, item) => {
      arr.push(item.description.replace(replacer.from, replacer.to));
      return arr;
    }, messages);

    return messages;
  }

  static buildSchemaFromEncodedString(content: string) {
    const fileContent = Buffer.from(content, 'base64').toString('utf8');
    const schema = buildSchema(fileContent);
    return schema;
  }

  static filterSchemaFiles(files: Array<GhFile>) {
    return files.filter(({ filename }) => filename.match(FILE_FILTER));
  }

  async getLoggedUser() {
    return this.gh.users.get({});
  }

  async findThisBotComment(
    owner: string,
    repo: string,
    pullRequestNumber: number,
    thisBot: any,
    currentPage: ?number = 1,
  ) {
    const result = await this.gh.issues.getComments({
      owner,
      repo,
      number: pullRequestNumber,
      per_page: 50,
      page: currentPage,
    });

    const comments = result.data;

    let found = comments.find(comment => comment.user.id === thisBot.id && comment.body.indexOf(BOT_IDENTIFIER) === 0);

    if (!found && this.gh.hasNextPage(result)) {
      found = await this.findThisBotComment(owner, repo, pullRequestNumber, thisBot, currentPage + 1);
    }

    return found;
  }

  async getFileContent(owner: string, repo: string, path: string, ref: string) {
    return this.gh.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });
  }

  async getFilesFromCommit(owner: string, repo: string, sha: string) {
    const { data }: { data: GhCommit } = await this.gh.repos.getCommit({
      owner,
      repo,
      sha,
    });

    return data.files;
  }

  async getFilesFromPullRequest(owner: string, repo: string, number: string) {
    const { data }: { data: Array<GhFile> } = await this.gh.pullRequests.getFiles({
      owner,
      repo,
      number,
      page: 1,
      perPage: 300,
    });

    return data;
  }

  async updateComment(owner: string, repo: string, id: string, body: string) {
    return this.gh.issues.editComment({
      owner,
      repo,
      id,
      body,
    });
  }

  async createComment(owner: string, repo: string, pullRequestNumber: string, body: string) {
    return this.gh.issues.createComment({
      owner,
      repo,
      number: pullRequestNumber,
      body,
    });
  }

  async handlePullRequestWebhookPayload(data: any) {
    const { pull_request: pullRequestPayload } = data;
    const { repository: repo } = data;

    if (!pullRequestPayload) {
      return;
    }

    if (!validActions.includes(data.action)) {
      return;
    }

    console.log('Handling PR:', pullRequestPayload.html_url);

    const { data: thisBot } = await this.getLoggedUser();
    const thisBotComment = await this.findThisBotComment(
      repo.owner.login,
      repo.name,
      pullRequestPayload.number,
      thisBot,
    );

    const { base, head } = pullRequestPayload;

    const changedFiles = thisBotComment ? await this.getFilesFromCommit(
      head.user.login,
      head.repo.name,
      head.sha,
    ) : await this.getFilesFromPullRequest(
      repo.owner.login,
      repo.name,
      pullRequestPayload.number,
    );

    const changedSchemaFiles = Bot.filterSchemaFiles(changedFiles);

    // No schema files were modified
    if (!changedSchemaFiles.length) {
      return;
    }

    const analysisResults = await changedSchemaFiles.reduce(async (accumP: Promise<Array<AnalysisResult>>, file) => {
      const arr = await accumP;
      try {
        let originalFileName = file.filename;
        // verify if the file was renamed, if yes, use previous name
        if (file.status === 'renamed') {
          // In case there were no changes, ignore this file.
          if (file.changes === 0) {
            throw new Error('Schema file renamed, but no changes detected.');
          }
          originalFileName = file.previous_filename;
        }

        const { data: originalFileContent } = await this.getFileContent(
          base.user.login,
          base.repo.name,
          originalFileName,
          base.sha,
        );
        const { data: changedFileContent } = await this.getFileContent(
          head.user.login,
          head.repo.name,
          file.filename,
          head.sha,
        );
        let parseError = null;
        let breakingChanges = [];

        try {
          const originalSchema = Bot.buildSchemaFromEncodedString(originalFileContent.content);
          const changedSchema = Bot.buildSchemaFromEncodedString(changedFileContent.content);

          breakingChanges = findBreakingChanges(originalSchema, changedSchema);
        } catch (error) {
          if (error instanceof GraphQLError) {
            parseError = error;
          } else {
            throw error;
          }
        }

        arr.push({
          file: file.filename,
          url: changedFileContent.html_url,
          parseError,
          breakingChanges,
        });
      } catch (error) {
        if (error.code !== 404 && error.message !== 'Schema file renamed, but no changes detected.') {
          console.error(error);
        }
      }
      return arr;
    }, Promise.resolve([]));

    let commentBody = ['<!--bot:entria/graphql-vigilant-->'];

    for (const result of analysisResults) {
      commentBody.push(`### File: [\`${result.file}\`](${result.url})`);

      if (!result.breakingChanges.length) {
        if (result.parseError) {
          const errorMessage = result.parseError.message;
          const errorMessagePieces = errorMessage.split('\n\n');
          const message = errorMessagePieces[0];
          const code = errorMessagePieces[1];
          commentBody.push(message);
          commentBody.push(`\`\`\`graphql\n${code}\n\`\`\``);
        } else {
          commentBody.push('No breaking changes detected :tada:');
        }
      }

      const breakingChanges = _.groupBy(result.breakingChanges, 'type');

      for (const breakingChangeType in breakingChanges) {
        commentBody = commentBody.concat(
          Bot.getMessagesForBreakingChanges(breakingChangeType, breakingChanges[breakingChangeType]),
        );
      }
    }

    if (thisBotComment) {
      if (commentBody.length === 1) {
        commentBody.push('No breaking changes detected :tada:');
      }
      await this.updateComment(repo.owner.login, repo.name, thisBotComment.id, commentBody.join('\n'));
    } else if (commentBody.length > 1) {
      await this.createComment(repo.owner.login, repo.name, pullRequestPayload.number, commentBody.join('\n'));
    }
  }
}
