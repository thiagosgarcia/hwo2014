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

        race = gameInitData.race;
        track = race.track;
        pieces = track.pieces;
        lanes = track.lanes;
    }

    if(data.msgType === 'lapFinished')
        log("Lap Finished");

  if (data.msgType === 'carPositions') {
      //console.log(data);
      //console.log(info);

      var carAngle = parseFloat(info[0].angle + "");
      var piecePosition = info[0].piecePosition;
      var carLane = piecePosition.lane;

      //speed(piecePosition);

      log("tick " + data.gameTick + "" +
          //" | carAngle " + carAngle +
          " | pieceLength " + pieceLength(piecePosition.pieceIndex, carLane) +
          //" | isSwitch " + isSwitch(piecePosition.pieceIndex) +
          " | " + pieceDirectionString(piecePosition.pieceIndex) +
          " | speed " + speed(piecePosition));

      if(carAngle >40 || carAngle<-20){
          send({
              msgType: "throttle",
              data: -1
          });
      }else if(carAngle >30 || carAngle<-15){
          send({
              msgType: "throttle",
              data: -0.7
          });
      }else if(carAngle >20 || carAngle<-5){
          send({
              msgType: "throttle",
              data: -0.3
          });
      }else if(carAngle > 10 || carAngle < -1){
          send({
              msgType: "throttle",
              data: 0.4
          });
      }else{
        send({
          msgType: "throttle",
          data: 0.8
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
  return log("disconnected");
});



// Funções para serem movidas para as classes correspondentes

var DEBUG = true;
function log(log){
    if(DEBUG)
        console.log(log);
}

var gameInitData = null;
var race = null;
var track = null;
var pieces = null;
var lanes = null;


var lastPieceIndex = 0;
var lastPieceDistance = 0;
function speed(piecePosition){
    var pieceIndex = piecePosition.pieceIndex;
    var pieceDistance = piecePosition.inPieceDistance;
    var carLane = piecePosition.lane;
    var speed = 0;

    speed = pieceDistance - lastPieceDistance;
    if(lastPieceIndex != pieceIndex)
        speed += pieceLength(lastPieceIndex, carLane);

    log("LPD " + lastPieceDistance + " PD " + pieceDistance + " Speed " + speed);

    lastPieceDistance = pieceDistance;
    lastPieceIndex = pieceIndex;
    return speed;
}

// Fiz essa com calcLength, mas acho que vai ser melhor usarmos a inLaneLength
// por que aí sim daria a real distância que o carro vai percorrer
function pieceLength(pieceIndex, carLane){
    if(pieceIndex == null || pieceIndex == undefined || pieces == null)
        return 0;

    var piece = pieces [pieceIndex];

    if(piece.length != undefined)
        return inLaneLength(piece.length, 0);
    if(piece.radius != undefined)
        return inLaneLength(piece.radius, piece.angle, pieceIndex, carLane);
}

function inLaneLength(radius, angle, pieceIndex, carLane){
    if(angle === 0 )
        return radius;
    return Math.abs(Math.PI * (radius + normalizedDistanceFromCenter(pieceIndex, carLane.endLaneIndex))  * angle ) / 180;
}

// Tem que inverter o sinal da distanceFromCenter quando for pra right
// e desconsiderar o valor quando vai straight
function normalizedDistanceFromCenter(pieceIndex, carLaneIndex){
    var distanceFromCenter = lanes[carLaneIndex].distanceFromCenter;
    return distanceFromCenter * pieceDirection(pieceIndex);
}

// fator multiplicador para calcular a distãncia a percorrer numa piece.
// left é positivo, right, negativo; straight desconsidera o distanceFromCenter
function pieceDirection(pieceIndex){
    var piece = pieces [pieceIndex];
    if(piece.angle < 0)
        return 1;
    if(piece.angle > 0)
        return -1;
    return 0;
}

function pieceDirectionString(pieceIndex){
    var direction = pieceDirection(pieceIndex);
    if(direction > 0)
        return "left";
    if(direction < 0)
        return "right";
    return "straight";
}

function isSwitch(pieceIndex){
    if(pieces == null)
       return false;
    return pieces [pieceIndex].switch === true;
}


