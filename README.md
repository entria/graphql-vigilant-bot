# graphql-findbreakingchanges-bot

## Installation
Clone this repository, then run

`yarn install` or `npm install`

Check `.env.example` for which environment variables you need to set before
  running this bot.
We recommend you to create a new GitHub account for your bot, which is going to be
  used to author the comments.

## Setup

You need to add a webhook pointing to this bot, use `application/json` as 
 the `Content Type`, and select the `Pull request` event.

## Development

Since this bot depends on Github webhooks, we gonna need to use [ngrok]()
 to redirect the webhook request to our machine.

Run:
```bash
./ngrok http $PORT
```

Where `$PORT` is the port you are going to run the bot.

Grab the `*.ngrok.io` URL and add it as webhook on your repo.

### How it looks like

 > Syntax Errors
 ![demo-1](./image/demo-image-1.png)
 
 > Breaking Changes
 ![demo-2](./image/demo-image-2.png)
