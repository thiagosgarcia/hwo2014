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
        var direction = pieceDirectionString(piecePosition.pieceIndex);
      log("tick " + data.gameTick + ""
          //+" | carAngle " + carAngle
          //+" | pieceLength " + pieceLength(piecePosition.pieceIndex, carLane)
          //+" | isSwitch " + isSwitch(piecePosition.pieceIndex)
          //+" | " + pieceDirectionString(piecePosition.pieceIndex)
          +" | speed " + LastSpeed
          +" | acc " + Acceleration
          //+" | nextSwitch " + leftToNextSwitch(piecePosition.pieceIndex, carLane, piecePosition)
          +" | nexTurn " + leftToNextTurn(piecePosition.pieceIndex, carLane, piecePosition)
          +" " + ( direction  )
          //+" " + isInTurn(piecePosition.pieceIndex))
      );

      drive(piecePosition);
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

function throttle(val){
    if(val > 1)
        val = 1;
    if(val < 1)
        val = 0;
    log("thottle " + val);
    send({
        msgType: "throttle",
        data: val
    });
}
function ping(){
    log("thottle " + val);
    send({
        msgType: "ping",
        data: {}
    });
}

function drive(piecePosition) {

    var leftToTurn = leftToNextTurn(piecePosition.pieceIndex, piecePosition.lane, piecePosition);
    var spd = speed(piecePosition);
    var acc = Acceleration;
    if (!isInTurn(piecePosition.pieceIndex)) {
        if (leftToTurn > Math.pow(spd, 2)) {
            throttle(1);
        } else if (spd < 7.5) {
            throttle( (1 / spd) * 3 );
        }else{
            throttle(0);
        }
    } else {
        if (spd < 7) {
            if (acc < 0 || spd < 6.5)
                throttle(1);
            else
                throttle(0);
        } else if (acc > 0) {
            throttle((1 / spd) * 1,7 );
        } else {
            throttle(1);
        }

    }
}


/*
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
*/


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
var LastSpeed = 0;
var Acceleration = 0;
function speed(piecePosition){
    var pieceIndex = piecePosition.pieceIndex;
    var pieceDistance = piecePosition.inPieceDistance;
    var carLane = piecePosition.lane;
    var speed = 0;

    speed = pieceDistance - lastPieceDistance;
    if(lastPieceIndex != pieceIndex)
        speed += pieceLength(lastPieceIndex, carLane);

    //log("LPD " + lastPieceDistance + " PD " + pieceDistance + " Speed " + speed);

    lastPieceDistance = pieceDistance;
    lastPieceIndex = pieceIndex;

    Acceleration =  speed - LastSpeed;
    LastSpeed = speed;
    return speed;
}

// Fiz essa com calcLength, mas acho que vai ser melhor usarmos a inLaneLength
// por que aí sim daria a real distância que o carro vai percorrer
function pieceLength(pieceIndex, carLane){
    if(pieceIndex == null || pieceIndex == undefined || pieces == null)
        return 0;
    if(pieceIndex >= pieces.length)
        pieceIndex = 0;

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
    if(pieceIndex === undefined)
        return 0;
    if(pieceIndex >= pieces.length)
        pieceIndex = 0;
    var piece = pieces [pieceIndex];
    if(piece === undefined)
        log(pieceIndex);
    if(piece.angle < 0)
        return 1;
    if(piece.angle > 0)
        return -1;
    return 0;
}

function pieceDirectionString(pieceIndex){
    if(pieceIndex === undefined)
        return 0;
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
    if(pieceIndex === undefined)
        return false;
    if(pieceIndex >= pieces.length)
        pieceIndex = 0;
    return pieces [pieceIndex].switch === true;
}


// coisas para AI
function inPieceLeft(pieceIndex, carLane, piecePosition){
    return pieceLength(pieceIndex, carLane) - piecePosition.inPieceDistance;
}

function leftToNextSwitch(pieceIndex, carLane, piecePosition){
    var count = inPieceLeft(pieceIndex, carLane, piecePosition);
    var i = pieceIndex + 1;
    while(pieces[i].switch !== true){
        count += pieceLength(i++, carLane);
        if(i >= pieces.length)
            i = 0;
    }
    return count;
}

// 2 whiles porque se os unir em um e tiver duas curvas para o mesmo lado separados por uma reta,
// durante a curva o calculo vai ser errado
function leftToNextTurn(pieceIndex, carLane, piecePosition){
    var turnEnds = inPieceLeft(pieceIndex, carLane, piecePosition);
    var i = pieceIndex + 1;

    while(pieceDirection(i) === pieceDirection(pieceIndex)){
        turnEnds += pieceLength(i++, carLane);
        if(i >= pieces.length)
            i = 0;
    }
    count = turnEnds;
    while( pieceDirection(i) === 0 ){
        count += pieceLength(i++, carLane);
        if(i >= pieces.length)
            i = 0;
    }
    return count;
}

function isInTurn(pieceIndex){
    return pieceDirection(pieceIndex) !== 0;
}

function nextTurnDirection(pieceIndex){
    var i = pieceIndex + 1;
    while(pieceDirection(i) === pieceDirection(pieceIndex)){
        i++;
        if(i >= pieces.length)
            i = 0;
    }
    while(pieceDirection(i) === 0){
        i++;
        if(i >= pieces.length)
            i = 0;
    }
    return pieceDirection(i);
}