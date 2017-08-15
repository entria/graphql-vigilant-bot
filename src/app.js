// @flow

import Koa from 'koa';
import contentType from 'content-type';
import getRawBody from 'raw-body';
import crypto from 'crypto';
import bufferEquals from 'buffer-equal-constant-time';

import { GITHUB_WEBHOOK_SECRET } from './config';
import Bot from './bot';
import gh from './github';

const signBlob = (key, blob) => {
  const signature = crypto.createHmac('sha1', key).update(blob).digest('hex');
  return `sha1=${signature}`;
};

const app = new Koa();

app.use(async (ctx, next) => {
  if (!ctx.request.headers['content-length'] || !ctx.request.headers['content-type']) {
    return;
  }

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
  const computedSig = new Buffer(signBlob(GITHUB_WEBHOOK_SECRET, ctx.request.rawBody));

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
  const bot = new Bot(gh);

  await bot.handlePullRequestWebhookPayload(data);
});

export default app;
