//
// This is main file containing code implementing the Express server and functionality for the Express echo bot.
//
'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const path = require('path');
const { execSync } = require('child_process');

var messengerButton = "<html><head><title>Facebook Messenger Bot</title></head><body><h1>Facebook Messenger Bot</h1>This is a bot based on Messenger Platform QuickStart. For more details, see their <a href=\"https://developers.facebook.com/docs/messenger-platform/guides/quick-start\">docs</a>.<script src=\"https://button.glitch.me/button.js\" data-style=\"glitch\"></script><div class=\"glitchButton\" style=\"position:fixed;top:20px;right:20px;\"></div></body></html>";

// The rest of the code implements the routes for our Express server.
let app = express();

var verify_token = '***** verify_token *****';
var access_token = '***** access_token *****';
var olamiLocalizationUrl = 'https://tw.olami.ai/cloudservice/api';
var olamiAppKey = '***** olamiAppKey *****';
var olamiAppSecret = '***** olamiAppSecret *****';

var NLUApiSample = require('./NluApiSample.js');
var nluApi = new NLUApiSample();
nluApi.setLocalization(olamiLocalizationUrl);
nluApi.setAuthorization(olamiAppKey, olamiAppSecret);

var SpeechApiSample = require('./SpeechApiSample.js');
var speechApi = new SpeechApiSample();
speechApi.setLocalization(olamiLocalizationUrl);
speechApi.setAuthorization(olamiAppKey, olamiAppSecret);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// Webhook validation
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === verify_token) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
});

// Display the web page
app.get('/', function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(messengerButton);
  res.end();
});

// Message processing
app.post('/webhook', function (req, res) {
  console.log(req.body);
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object === 'page') {

    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function(entry) {
      var pageID = entry.id;
      var timeOfEvent = entry.time;

      // Iterate over each messaging event
      entry.messaging.forEach(function(event) {
        if (event.message) {
          receivedMessage(event);
        } else if (event.postback) {
          receivedPostback(event);
        } else {
          console.log("Webhook received unknown event: ", event);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.
    res.sendStatus(200);
  }
});

// Incoming events handling
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:",
  senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageId = message.mid;
  var messageText = message.text;
  var messageAttachments = message.attachments;

	// 如果使用者輸入為文字的話
	if (messageText) {
		receivedUserTypeMessage(senderID, messageText);
	// 如果使用者輸入的內容為附件的話
  } else if (messageAttachments) {
		var json = JSON.parse(JSON.stringify(messageAttachments));
		var attachmentType = json[0]['type'];
		switch (attachmentType) {
			case 'audio':
				// sendTextMessage(senderID, "請稍後，我們已經收到語音檔案附件，馬上為你進行辨識");
				receivedAudioAttachment(senderID, json[0]['payload']['url']);
				break;
			default:
				sendTextMessage(senderID, "收到附件");
		}
	}
}

// 處理使用者輸入訊息
function receivedUserTypeMessage(senderID, userTypeMessage) {
	sendSenderActions(senderID);
	// If we receive a text message, check to see if it matches a keyword
	// and send back the template example. Otherwise, just echo the text we received.
	// 判斷使用者輸入的文字是否為關鍵字
	switch (userTypeMessage) {
		// case 'generic':
		//   sendGenericMessage(senderID);
		//   break;

		default:
			// 將使用者輸入的資訊導入 OLAMI NLU API 當中
			nluApi.getRecognitionResult("nli", userTypeMessage, function(resultArray) {
				var sendMessage = "";
				resultArray.forEach(function(result, index, arr) {
					sendMessage += result + "\n";
				});
				// 將 NLI 回傳結果回傳至 Messenger 當中
				sendTextMessage(senderID, sendMessage);
			}, function(baikeArray) {		// 回傳值是百科內容，需要套用template去顯示
				var subtitle = "";
				baikeArray[1].forEach(function(item, index, arr) {
					subtitle += item +" : "+ baikeArray[2][index] + "\n";
				});
				sendTextMessage(senderID, baikeArray[0]);
				// 將百科資料套入 template 回傳
				sendWikiTemplateMessage(
					senderID,
					baikeArray[2][0],
					subtitle,
					baikeArray
				);
			});
	}
}

// 處理使用者上傳的語音附近，並開始進行語音辨識
function receivedAudioAttachment(senderID, audioUrl) {
	console.log("開始下載語音檔案..."+ audioUrl);

	var spawn = require('child_process').spawn;

	//kick off process
	const wget = spawn('wget',
		['-O', 'upload_audio/'+ senderID +'.aac', audioUrl]);
	//spit stdout to screen
	wget.stdout.on('data', function (data) {   process.stdout.write(data.toString());  });
	//spit stderr to screen
	wget.stderr.on('data', function (data) {   process.stdout.write(data.toString());  });

	wget.on('close', function (code) {
		const ffmpeg = spawn('ffmpeg',
		['-i', 'upload_audio/'+ senderID +'.aac', '-ar', '16000', 'upload_audio/'+ senderID +'.wav', '-y']);
		//spit stdout to screen
		ffmpeg.stdout.on('data', function (data) {   process.stdout.write(data.toString());  });
		//spit stderr to screen
		ffmpeg.stderr.on('data', function (data) {   process.stdout.write(data.toString());  });

		ffmpeg.on('close', (code) => {
			console.log("開始進行語音辨識..."+ senderID +'.wav');
			sendSenderActions(senderID);
			speechApi.sendAudioFile(
				'asr',
				'nli',
				true,
				'upload_audio/'+ senderID+'.wav',
				0, function(sttText) {
					sendTextMessage(senderID, '辨識結果為：'+ sttText);
					receivedUserTypeMessage(senderID, sttText);
				}
			);
		});
	});

}

// 處理使用者callback
function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback
  // button for Structured Messages.
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " +
    "at %d", senderID, recipientID, payload, timeOfPostback);

  // When a postback is called, we'll send a message back to the sender to
  // let them know it was successful
  sendTextMessage(senderID, "Postback called");
}

//////////////////////////
// Sending helpers
//////////////////////////
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };

  callSendAPI(messageData);
}

// 傳送百科的結構化資料
function sendWikiTemplateMessage(
	recipientId,
	title,
	subtitle,
	structureMessage
) {
	var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: structureMessage[2][0],
            subtitle: subtitle,
            image_url: structureMessage[4],
						buttons: [{
              type: "web_url",
              url: "https://www.google.com.tw/search?q="+ title,
              title: "詳細資訊"
            }],
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

// 傳送正在輸入訊息的事件
function sendSenderActions(recipientId) {
	var messageData = {
	  "recipient":{
	    "id": recipientId
	  },
	  "sender_action":"typing_on"
	};

  callSendAPI(messageData);
}

// 傳送結構化的訊息
function sendGenericMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "rift",
            subtitle: "Next-generation virtual reality",
            item_url: "https://www.oculus.com/en-us/rift/",
            image_url: "http://messengerdemo.parseapp.com/img/rift.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/rift/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for first bubble",
            }],
          }, {
            title: "touch",
            subtitle: "Your Hands, Now in VR",
            item_url: "https://www.oculus.com/en-us/touch/",
            image_url: "http://messengerdemo.parseapp.com/img/touch.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/touch/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for second bubble",
            }]
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

function callSendAPI(messageData) {
	console.log("\n\n------ callSendAPI messageData ------");
	console.log(messageData);
	console.log("-------------------------------------\n\n");

  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: access_token },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s",
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      // console.error(response);
      // console.error(error);
    }
  });
}

// Set Express to listen out for HTTP requests
var server = app.listen(process.env.PORT || 3000, function () {
  console.log("Listening on port %s", server.address().port);
});
