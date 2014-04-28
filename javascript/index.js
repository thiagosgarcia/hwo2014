// ***** Client connection imports and creation ***** //
var net = require("net");
var JSONStream = require('JSONStream');

var serverHost = "senna.helloworldopen.com";
var serverPort = 8091;
var botName = "WKM";
var botKey = "rSOwFpIm+ddrdQ";

console.log("I'm", botName, "and connect to", serverHost + ":" + serverPort);

client = net.connect(serverPort, serverHost, function() {
  return send({
    msgType: "joinRace",
    data: {
        botId: {
          name: botName
          ,key: botKey
          ,color: "green"
        }
        , trackName: "keimola"
        , carCount: 1
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

function gameInit(info) {
	track = new Track(info.race.track, info.race.raceSession);
	myCar.track = track;
}

function race(info, gameTick) {
	myCar.updateCarPosition(info);
	
	// Only check for turbo and switch sends if the game is already started
	if(!!gameTick && !!myCar.acceleration) {	
		checkTurbo();
		checkSwitch();
	}
	throttle(driver.drive());
	
	log("tick " + gameTick + " : " + (Math.floor((gameTick / (60) % 100)*100) /100)  + " s"
		+" | speed " + myCar.lastSpeed
		+" | acc " + myCar.acceleration
		+" | lap " + myCar.lap
		+" | nextBend " + myCar.distanceToBend()
		//+" | lane " + myCar.lane.index
		//+" | switch " + myCar.currentPiece.switch
        //+" | Piece: lenght " + myCar.currentPiece.lengthInLane(myCar.track.lanes[0], myCar.track.lanes[1])
        //+" . radius " + myCar.currentPiece.radius
        //+" . angle " + myCar.currentPiece.angle
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
    if(val == 2.0)
        turbo();

    if(val > 1.0)
        val = 1.0;
    if(val < 0.0)
        val = 0.0;
        
    log("throttle " + val);
    send({
        msgType: "throttle",
        data: val
    });

    end = new Date();

    if(start !== undefined && end !== undefined){
        var executionTime = end.getUTCMilliseconds() - start.getUTCMilliseconds();
        // If it took more than 60% of the time available, there's an alert
        if(executionTime > (50 / 3) * 0.6)
            console.log( "Execution time alert: " + (executionTime) + " ms of "
                + (Math.floor((50 / (3) % 100)*100) /100) + " available for each tick!")
    }
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
var start;
var end;
// ***** Race events listener ***** //
jsonStream.on('data', function(data) {

    start = new Date();
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
            ping();
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
