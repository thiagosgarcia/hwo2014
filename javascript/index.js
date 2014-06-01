// ***** Client connection imports and creation ***** //
var net = require("net");
var JSONStream = require('JSONStream');

var Logger = require("./logger.js");
var Race = require("./race.js");

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

Logger.log("I'm", botName, "and connect to", serverHost + ":" + serverPort);

jsonStream = client.pipe(JSONStream.parse());
jsonStream.on('data', function(data) {
    try {
        race.message[data.msgType](data);
    }
    catch(e) {
        race.message["error"](data, e);
    }
});

jsonStream.on('error', function() {
    Logger.log("Disconnected!");
});
