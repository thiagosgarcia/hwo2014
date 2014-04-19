// ***** Client connection imports and creation ***** //
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

// ***** Class imports ***** //
var Piece = require("./piece.js");
var Track = require("./track.js");
var Car = require("./car.js");

// ***** Race information objects ***** //
var track = null;
var myCar = null;


// ***** Race events functions ***** //
function gameInit(info) {
	track = new Track(info.race.track);
	
	pieces = info.race.track.pieces;
	lanes = info.race.track.lanes;
}

function createCar(info) {
	myCar = new Car(info);
	console.log(myCar);
}

function ping() {
	send({
		msgType: "ping",
		data: {}
	});
}

function race(info, gameTick) {
	myCar.updateCarPosition();

	var carAngle = parseFloat(info[0].angle + "");
	var piecePosition = info[0].piecePosition;
	var carLane = piecePosition.lane;

	//speed(piecePosition);
	var direction = pieceDirectionString(piecePosition.pieceIndex);
	log("tick " + gameTick + ""
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
}

// ***** Race events listener ***** //
jsonStream.on('data', function(data) {
    var info = data['data'];
    
    switch(data.msgType) {
    	case 'join':
    		console.log('Joined race!');
    		ping();
    		break;
    	case 'gameInit':
    		gameInit(info);
    		ping();
    		break;
    	case 'yourCar':
    		createCar(info);
    		ping();
    		break;
    	case 'gameStart':
			console.log('Race started!');
			ping();
			break;
    	case 'carPositions':
    		race(info, data['gameTick']);
    		break;
    	case 'lapFinished':
    		console.log('Lap Finished');
    		ping();
    		break;
    	case 'gameEnd':
			console.log('Race ended!');
			ping();
			break;
		default:
			break;
    }
});

jsonStream.on('error', function() {
	return log("disconnected");
});

function throttle(val){
    if(val > 1.0)
        val = 1.0;
    if(val < 0.0)
        val = 0.0;
        
    log("throttle " + val);
    send({
        msgType: "throttle",
        data: val
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
            if (acc < 0 || spd < 6.9)
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

// Funções para serem movidas para as classes correspondentes

var DEBUG = true;
function log(log){
    if(DEBUG)
        console.log(log);
}

var pieces = null;
var lanes = null;


var lastPieceIndex = 0;
var lastPieceDistance = 0;
var LastSpeed = 0;
var Acceleration = 0;

function speed(piecePosition) {
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
    if(pieceIndex == null || pieceIndex == undefined)
        return 0;
    if(pieceIndex >= track.pieces.length)
        pieceIndex = 0;

    var piece = pieces[pieceIndex];

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
