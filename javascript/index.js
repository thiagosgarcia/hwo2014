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
function createCar(info) {
	myCar = new Car(info);
}

function gameInit(info) {
	track = new Track(info.race.track, info.race.raceSession);
	myCar.track = track;
}

function race(info, gameTick) {
	myCar.updateCarPosition(info);
	var driver = myCar.driver;
	
	if(driver.checkSwitch && !!gameTick) {
		var switchDirection = driver.determineSwitchDirection();
		driver.checkSwitch = false;
		
		if(switchDirection != null) {
			switchLane(switchDirection);
		}
	}
	throttle(driver.drive());
	
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

function throttle(val) {
    // If throttle == 2 means that turbo was activated
    if(val == 2.0){
		turbo();
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

function switchLane(val) {
	console.log('will switch to ' + val + ' lane');

	send({
		msgType: "switchLane",
		data: val
	});
}

function turbo() {
	console.log("Turbo activated!");
	
	send({
		msgType: "turbo",
		data: "Geronimoooooo!!!"
	});
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
