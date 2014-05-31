// ***** Client connection imports and creation ***** //
var net = require("net");
var JSONStream = require('JSONStream');

var Race = require("./race.js");

/*
var serverHost = "senna.helloworldopen.com";
var serverPort = 8091;
var botName = "Working Minds";
var botKey = "rSOwFpIm+ddrdQ";
*/

var serverHost = process.argv[2];
var serverPort = process.argv[3];
var botName = process.argv[4];
var botKey = process.argv[5];

var trackName = process.argv[6];
var password = process.argv[7];
var carCount = process.argv[8];
var color = process.argv[9];

var race = new Race();
client = net.connect(serverPort, serverHost, function() {
    race.message.client = client;
    return race.message.joinCustomRace({
        botName: botName,
        botKey: botKey,
        trackName: trackName,
        password: password,
        carCount: carCount,
        color: color
    });
});

console.log("I'm", botName, "and connect to", serverHost + ":" + serverPort);

jsonStream = client.pipe(JSONStream.parse());
jsonStream.on('data', function(data) {
    try {
        race.message[data.msgType](data);
    }
    catch(e) {
        if(e instanceof TypeError)
            race.message["unknownMessage"](data);
        else {
            race.message["error"](e);
        }

    }
});

jsonStream.on('error', function() {
    console.log("Disconnected!");
});
