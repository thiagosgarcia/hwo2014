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
var driver = null;

// ***** Race events functions ***** //
function createCar(info) {
	myCar = new Car(info);
	driver = myCar.driver;
}

function drive(piecePosition) {

    var leftToTurn = leftToNextTurn(piecePosition.pieceIndex, piecePosition.lane, piecePosition);
    var spd = speed(piecePosition);
    var acc = Acceleration;
    if (!isInTurn(piecePosition.pieceIndex)) {
        if (leftToTurn > Math.pow(spd, 2)) {
            throttle(1);
        } else if (spd < 7.5) {
            throttle((1 / spd) * 3);
        } else {
            throttle(0);
        }
    } else {
        if (spd < 7) {
            if (acc < 0 || spd < 6.5)
                throttle(1);
            else
                throttle(0);
        } else if (acc > 0) {
            throttle((1 / spd) * 1, 7);
        } else {
            throttle(1);
        }

    }
}
function gameInit(info) {
	track = new Track(info.race.track, info.race.raceSession);
	myCar.track = track;
}

function race(info, gameTick) {
	myCar.updateCarPosition(info);
	
	// Only check for turbo and switch sends if the game is already started
	if(!!gameTick) {	
		checkTurbo();
		checkSwitch();
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

function checkTurbo() {
    if(myCar.turboAvailable && driver.canTurbo()) {
		myCar.turboAvailable = false;
		turbo();
	}
}

function checkSwitch() {
	if(driver.checkSwitch) {
		var switchDirection = driver.determineSwitchDirection();
		driver.checkSwitch = false;
		
		if(switchDirection != null) {
			switchLane(switchDirection);
		}
	}
}

function rechargeTurbo(info){
    myCar.rechargeTurbo(info);
    
    log("Turbo Recharged! " +
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
            rechargeTurbo(info);
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
