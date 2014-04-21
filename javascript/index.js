// ***** Client connection imports and creation ***** //
var net = require("net");
var JSONStream = require('JSONStream');

var serverHost = "senna.helloworldopen.com";
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
    }, tackName : "usa", carCount: 1.0
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
function createCar(info) {
	myCar = new Car(info);
}

function gameInit(info) {
	track = new Track(info.race.track, info.race.raceSession);
	myCar.track = track;
	
	pieces = info.race.track.pieces;
	lanes = info.race.track.lanes;
}

function race(info, gameTick) {
	myCar.updateCarPosition(info);
	throttle(myCar.getThrottle());
	
	log("tick " + gameTick + ""
		+" | speed " + myCar.lastSpeed
		+" | acc " + myCar.acceleration
		+" | lap " + myCar.lap
		+" | nextBend " + myCar.distanceToBend()
		//+" | nextSwitch " + leftToNextSwitch(piecePosition.pieceIndex, carLane, piecePosition)
	);
	
}

function updateTurboInfo(info){
    myCar.updateTurboInfo(info);
    log("Turbo Available! " +
        " | turboDurationMilliseconds " + myCar.turboDurationMilliseconds +
        " | turboDurationTicks " + myCar.turboDurationTicks +
        " | turboFactor " + myCar.turboFactor
    );
}

// ***** Server communication functions ***** //
function ping() {
	send({
		msgType: "ping",
		data: {}
	});
}

function throttle(val){
    // If throttle == 2 means that turbo was activated
    if(val == 2.0){
        log("Turbo activated!")
        send({
            msgType: "turbo",
            "data": "Geronimoooooo!!!"
        });
        return;
    }

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

var test = 0;
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
            test ++;
    		break;
    	case 'yourCar':
    		createCar(info);
    		ping();
    		break;
    	case 'gameStart':
			console.log('Race started!');
			ping();
            test ++;
			break;
    	case 'carPositions':
            if(test == 2){
                send({"msgType": "switchLane", "data": "Right"})
                test = 0;
                break;
            }
            race(info, data['gameTick']);
    		break;
    	case 'turboAvailable':
            updateTurboInfo(info);
            ping();
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


var DEBUG = true;
function log(log){
    if(DEBUG)
        console.log(log);
}

// coisas para AI

// Para calcular o switch, ainda nao foi finalizado e utilizado;
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
