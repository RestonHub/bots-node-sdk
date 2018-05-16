"use strict";

const crypto = require("crypto");
const request = require("request");
const { CONSTANTS } = require("../common/constants");

/**
 * utility function to perform webhook signature verification
 * @function module:Util/Webhook.verifyMessageFormat
 * @return {boolean} true if the webhook message received from Bots is verified successfully.
 * @param {string} signature - signature included in the bot message, to be compared to calculated signature.
 * @param {Buffer} msgBody - raw message body of the bot message.
 * @param {string} encoding - encoding of the raw message body.
 * @param {string} secretKey - secretKey used to calculate message signature
 */
function verifyMessageFromBot(signature, msgBody, encoding, secretKey) {
  // console.log('Signature:', signature);
  // console.log('Encoding:', encoding);
  // console.log('Body: \n"%s"', msgBody);
  if (!signature) {
    console.log('Missing signature');
    return false;
  }
  //const body = Buffer.from(JSON.stringify(msgBody), encoding);
  const calculatedSig = buildSignatureHeader(msgBody, secretKey);
  if (signature !== calculatedSig) {
    console.log('Invalid signature:', signature);
    //console.log('Body: \n"%s"', body);
    console.log('Calculated sig: %s', calculatedSig);
    return false;
  }
  // console.log('Valid signature: %s', signature);
  return true;
}
exports.verifyMessageFromBot = verifyMessageFromBot;
/**
 * utility function for use with expressjs route in handling the raw message body of the webhook message received from bot.
 * Instead of just letting bodyParser.json to parse the raw message to JSON, the rawMessage and its encoding is saved as properties
 * 'rawBody' and 'encoding' for use in signature verification in method verifyMessageFormat.
 * @function module:Util/Webhook.bodyParserRawMessageVerify
 * @return {boolean} true if the webhook message received from Bots is verified successfully.
 * @param {object} req - expressjs req for the POST route.
 * @param {object} res - expressjs res for the POST route.
 * @param {Buffer} buf - the raw message body.
 * @param {string} encoding - encoding of the raw message body.
 */
function bodyParserRawMessageVerify(req, res, buf, encoding) {
  req[CONSTANTS.PARSER_RAW_BODY] = buf;
  req[CONSTANTS.PARSER_RAW_ENCODING] = encoding;
}

/**
 * create the payload signature header.
 * @function module:Util/Webhook.buildSignatureHeader
 * @param {Buffer} - Raw payload as a Buffer, such as `Buffer.from(JSON.stringify(payload), 'utf8')`
 * @param {string} - secret key of the channel for computing signature
 */
function buildSignatureHeader(buf, secret) {
  return 'sha256=' + buildSignature(buf, secret);
}

function buildSignature(buf, secret) {
  const hmac = crypto.createHmac('sha256', Buffer.from(secret, 'utf8'));
  hmac.update(buf);
  return hmac.digest('hex');
}

/**
 * utility function to send message to bot webhook channel, generating the right message with signature
 * @function module:Util/Webhook.messageToBot
 * @param {string} channelUrl - send the message to this channel url
 * @param {string} channelSecretKey - secret key of the channel for computing message signature.
 * @param {string} userId - userId is the sender of the message.
 * @param {object|string} inMsg - message to be sent to bot
 * @param {function} callback - callback function to be invoked after message is sent
 */
function messageToBot(channelUrl, channelSecretKey, userId, inMsg, callback) {
  messageToBotWithProperties(channelUrl, channelSecretKey, userId, inMsg, null, callback);
}

/**
 * utility function to send message to bot webhook channel, generating the right message with signature.  This function also allows additional
 * properties to be sent along to the bot.  A common use case is to add a userProfile property.
 * @function module:Util/Webhook.messageToBotWithProperties
 * @param {string} channelUrl - send the message to this channel url
 * @param {string} channelSecretKey - secret key of the channel for computing message signature.
 * @param {string} userId - userId is the sender of the message.
 * @param {object|string} inMsg - message to be sent to bot
 * @param {object} [additionalProperties] - additional properties like profile can be added
 * @param {function} callback - callback function to be invoked after message is sent
 */
function messageToBotWithProperties(channelUrl, channelSecretKey, userId, inMsg, additionalProperties, callback) {
  var outMsg = {
    userId: userId,
  };
  outMsg.messagePayload = inMsg;
  /*
      For example, additionalProperties could be:
      {
        "profile": {
          "firstName": 'John',
          "lastName": 'Smith'
          "age": 22,
          "clientType": 'Alexa'
        }
      }
    */
  if (additionalProperties) {
    outMsg = Object.assign(outMsg, additionalProperties);
  }
  
  const body = Buffer.from(JSON.stringify(outMsg), 'utf8');
  const headers = {};
  headers['Content-Type'] = 'application/json; charset=utf-8';
  headers[CONSTANTS.WEBHOOK_HEADER] = buildSignatureHeader(body, channelSecretKey);
  request.post({
    uri: channelUrl,
    headers: headers,
    body: body,
    timeout: 60000,
    followAllRedirects: true,
    followOriginalHttpMethod: true,
    callback: function (err, response, body) {
      if (!err) {
        callback(null);
      }
      else {
        console.log(response);
        console.log(body);
        console.log(err);
        callback(err);
      }
    }
  });
}

/**
 * The webhookUtil is a set of utility functions for bot integration via webhook channel.
 * @module Util/Webhook
 */
module.exports = {
  messageToBot,
  messageToBotWithProperties,
  verifyMessageFromBot,
  bodyParserRawMessageVerify,
  buildSignatureHeader,
};
