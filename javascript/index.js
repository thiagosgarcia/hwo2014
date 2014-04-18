var net = require("net");
var JSONStream = require('JSONStream');

var serverHost = "testserver.helloworldopen.com";
var serverPort = 8091;
var botName = "Working Minds";
var botKey = "rSOwFpIm+ddrdQ";

console.log("I'm", botName, "and connect to", serverHost + ":" + serverPort);

client = net.connect(serverPort, serverHost, function() {
  return send({
    msgType: "join",
    data: {
      name: botName,
      key: botKey
    }
  });
});

function send(json) {
  client.write(JSON.stringify(json));
  return client.write('\n');
};

jsonStream = client.pipe(JSONStream.parse());

jsonStream.on('data', function(data) {
    var info = data['data'];

    if(data.msgType === 'gameInit'){
        gameInitData = info;
    }
    if(data.msgType === 'lapFinished')
        console.log("Lap Finished");

  if (data.msgType === 'carPositions') {
      //console.log(data);
      //console.log(info);

      var angle = parseFloat(info[0].angle + "");
      var piecePosition = info[0].piecePosition;
      console.log("tick " + data.gameTick + "" +
          " | angle " + angle + " | pieceLength " + pieceLength(piecePosition.pieceIndex))

      if(angle >40 || angle<-20){
          send({
              msgType: "throttle",
              data: -1
          });
      }else if(angle >30 || angle<-15){
          send({
              msgType: "throttle",
              data: -0.7
          });
      }else if(angle >20 || angle<-5){
          send({
              msgType: "throttle",
              data: -0.3
          });
      }else if(angle > 10 || angle < -1){
          send({
              msgType: "throttle",
              data: 0.4
          });
      }else{
        send({
          msgType: "throttle",
          data: 1
        });
      }
  } else {
    if (data.msgType === 'join') {
      console.log('Joined')
    } else if (data.msgType === 'gameStart') {
      console.log('Race started');
    } else if (data.msgType === 'gameEnd') {
      console.log('Race ended');
    }

      send({
          msgType: "ping",
          data: {}
      });
  }
});

jsonStream.on('error', function() {
  return console.log("disconnected");
});



// Funções para serem movidas para as classes correspondentes
function speed(data){

}

var gameInitData = null;
function pieceLength(index){
    if(gameInitData == null)
        return 0;

    console.log("index " + index);
    console.log("gameInitData " + gameInitData);

    var race = gameInitData.race;
    console.log("race " + race);
    var track = race.track;
    var pieces = track.pieces;
    var piece = pieces [index];

    if(piece.length != undefined)
        return calcLength(piece.length, 0);
    if(piece.radius != undefined)
        return calcLength(piece.radius, piece.angle);
}

function calcLength(radius, angle){
    if(angle === 0)
        return radius;
    return (Math.PI * radius * angle) / 180;
}


