/* eslint-disable no-restricted-syntax */
// @flow

import Koa from 'koa';
import contentType from 'content-type';
import getRawBody from 'raw-body';
import crypto from 'crypto';
import bufferEquals from 'buffer-equal-constant-time';
import _ from 'lodash';
import { buildSchema, findBreakingChanges, GraphQLError } from 'graphql';

import type { BreakingChange } from 'graphql';
import type { GhFile, AnalysisResult } from './TypeDefinition';

import * as gh from './github';
import replacers from './replacers';

const GITHUB_PR_OPENED = 'opened';
const GITHUB_PR_SYNCHRONIZED = 'synchronize';
const FILE_FILTER = /.*(.graphql|.gql)$/;

const validActions = [GITHUB_PR_OPENED, GITHUB_PR_SYNCHRONIZED];

const getMessagesForBreakingChanges = (breakingChangeType: string, breakingChanges: Array<BreakingChange>) => {
  const replacer = replacers[breakingChangeType];
  const messages = [replacer.title];

  breakingChanges.reduce((arr, item) => {
    arr.push(item.description.replace(replacer.from, replacer.to));
    return arr;
  }, messages);

  return messages;
};

const buildSchemaFromEncodedString = (content: string) => {
  const fileContent = Buffer.from(content, 'base64').toString('utf8');
  const schema = buildSchema(fileContent);
  return schema;
};

const filterSchemaFiles = (files: Array<GhFile>) => files.filter(({ filename }) => filename.match(FILE_FILTER));

const signBlob = (key, blob) => {
  const signature = crypto.createHmac('sha1', key).update(blob).digest('hex');
  return `sha1=${signature}`;
};

const app = new Koa();
app.use(async (ctx, next) => {
  ctx.request.rawBody = await getRawBody(ctx.req, {
    length: ctx.request.headers['content-length'],
    limit: '5mb',
    encoding: contentType.parse(ctx.request).parameters.charset,
  });
  ctx.request.body = JSON.parse(ctx.request.rawBody);
  await next();
});

app.use(async (ctx, next) => {
  const signature = ctx.request.headers['x-hub-signature'];
  const event = ctx.request.headers['x-github-event'];
  const id = ctx.request.headers['x-github-delivery'];

  console.log(`Handling webhook ${id} for event ${event}.`);
  const computedSig = new Buffer(signBlob(process.env.GITHUB_WEBHOOK_SECRET, ctx.request.rawBody));

  if (!bufferEquals(new Buffer(signature), computedSig)) {
    ctx.throw(500, 'X-Hub-Signature does not match blob signature.');
  }

  ctx.body = 'Ok';

  if (event === 'pull_request') {
    await next();
  }
});

app.use(async (ctx) => {
  const data = ctx.request.body;
  const pullRequestPayload = data.pull_request;
  const { repository: repo } = data;

  if (!pullRequestPayload) {
    return;
  }

  if (!validActions.includes(data.action)) {
    return;
  }

  console.log('Handling PR:', pullRequestPayload.html_url);

  const { data: thisBot } = await gh.getLoggedUser();
  const thisBotComment = await gh.findThisBotComment(repo.owner.login, repo.name, pullRequestPayload.number, thisBot);

  const { base, head } = pullRequestPayload;

  const changedFiles = await gh.getFilesFromCommit(head.user.login, head.repo.name, head.sha);

  const changedSchemaFiles = filterSchemaFiles(changedFiles);

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

      const { data: originalFileContent } = await gh.getFileContent(
        base.user.login,
        base.repo.name,
        originalFileName,
        base.sha,
      );
      const { data: changedFileContent } = await gh.getFileContent(
        head.user.login,
        head.repo.name,
        file.filename,
        head.sha,
      );
      let parseError = null;
      let breakingChanges = [];

      try {
        const originalSchema = buildSchemaFromEncodedString(originalFileContent.content);
        const changedSchema = buildSchemaFromEncodedString(changedFileContent.content);

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

  let commentBody = [];

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
        getMessagesForBreakingChanges(breakingChangeType, breakingChanges[breakingChangeType]),
      );
    }
  }

  if (thisBotComment) {
    if (!commentBody.length) {
      commentBody.push('No breaking changes detected :tada:');
    }
    await gh.updateComment(repo.owner.login, repo.name, thisBotComment.id, commentBody.join('\n'));
  } else {
    await gh.createComment(repo.owner.login, repo.name, pullRequestPayload.number, commentBody.join('\n'));
  }
});

export default app;
