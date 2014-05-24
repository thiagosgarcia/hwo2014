var Piece = require('./piece.js');
var Track = require('./track.js');
var Driver = require('./driver.js');

var BENDS_AHEAD_TO_VERIFY = 3;

function getCarPositionInfo(car, positionInfoArray) {
	var positionInfo = {}
	
	for(var i = 0; i < positionInfoArray.length; i++) {
		positionInfo = positionInfoArray[i];
		
		if(!!positionInfo.id && positionInfo.id.color == car.color)
			break;
	}

	return positionInfo;
}

function Car(data, track) {
	this.name = data.name;
	this.color = data.color;
	
	this.track = track;

    this.angle = null;
    this.lastAngle = null;
    this.angleSpeed = 0.0;
    this.currentPiece = null;
	this.inPieceDistance = null;
	this.lane = null;

    // It is used for correct speed calculation when the car is switching lanes
    this.laneInlastPiece = null;
    this.laneInPieceBefore = null;

	this.lap = null;

    // TODO: Continuar o refactor daqui. Existiam 3 variaveis que continham as curvas a seguir. Agora
    //       Temos um array com essas curvas. Do jeito que está vai quebrar.
    this.bendsAhead = [];

    this.nextDifferentPiece = null;
    this.nextSwitchPiece = null;

    this.lastPiece = null;
	this.lastInPieceDistance = 0.0;
	this.lastSpeed = 0.0;
	this.acceleration = 0.0;

	this.turboAvailable = false;
	this.turboDurationTicks = 0;
	this.turboFactor = 1.0;
	
	this.driver = new Driver(this);

    declarePrivateMethods.call(this);
}

Car.prototype.updateCarPosition = function(positionInfoArray) {
	var positionInfo = getCarPositionInfo(this, positionInfoArray);
    var piecePosition = positionInfo.piecePosition;

    this.lastAngle = this.angle;
	this.angle = positionInfo.angle;

    this.angleSpeed = this.angle - this.lastAngle;

	this.currentPiece = this.track.pieces[piecePosition.pieceIndex];
	this.lane = this.track.lanes[piecePosition.lane.endLaneIndex];
	this.inPieceDistance = piecePosition.inPieceDistance;
	this.lap = piecePosition.lap;

	this.updateCheckSwitchFlag();
    this.getBendsAhead();

    //TODO continuar daqui o Refactor 1
    // Different loops for different types to prevent confusing (getting nothing if the loop ends earlier
    // or getting wrong data if it does not stop for one variable when should have been stopped for another)
    i = piecePosition.pieceIndex;
    while(true){
        if(++ i >= this.track.pieces.length)
            i = 0;
        if(!!this.track.pieces[i].switch){
            this.nextSwitchPiece = this.track.pieces[i];
            break;
        }
        // to prevent infinite loop, if it gets to the beginning again, it stops
        if(i == piecePosition.pieceIndex)
            break;
    }
    // nextDifferentPiece indicates when the car arrives to a bend that the angle or radius, or even direction
    // is different than current
    i = piecePosition.pieceIndex;
    while(true){
        if(++ i >= this.track.pieces.length)
            i = 0;
        var pieceToVerify = this.track.pieces[i];
        if(pieceToVerify.angle !== this.currentPiece ||
            pieceToVerify.radius !== this.currentPiece){
            this.nextDifferentPiece = pieceToVerify;
            break;
        }
        // to prevent infinite loop, if it gets to the beginning again, it stops
        if(i == piecePosition.pieceIndex)
            break;
    }
};

Car.prototype.rechargeTurbo = function(turboInfo) {
    this.turboDurationTicks = turboInfo.turboDurationTicks;
    this.turboFactor = turboInfo.turboFactor;
    this.turboAvailable = true;
}

// Speed in distance per tick;
Car.prototype.speed = function() {
    var currentSpeed = this.inPieceDistance - this.lastInPieceDistance;

	// A piece transition occurred, the last piece length must be summed to the currentSpeed
	// for the right calculation of the distance passed in this tick, because the current inPieceDistance is reset;
    if(!!this.lastPiece && this.lastPiece.index !== this.currentPiece.index){

        if(!!this.laneInPieceBefore && this.laneInPieceBefore.index !== this.lane.index && !!this.lastPiece.switch){
            // It means I've changed lanes
            currentSpeed += this.lastPiece.lengthInLane(this.laneInPieceBefore, this.lane);
        }else{
    	    currentSpeed += this.lastPiece.lengthInLane(this.lane);
        }

        this.laneInPieceBefore = this.laneInlastPiece;
        this.laneInlastPiece = this.lane;
    }

    this.acceleration = currentSpeed - this.lastSpeed;
    this.lastSpeed = currentSpeed;
    this.lastInPieceDistance = this.inPieceDistance;
    this.lastPiece = this.currentPiece;

    return currentSpeed;
}

Car.prototype.distanceToBend = function() {
    var toNextPieceDistance = this.currentPiece.lengthInLane(this.lane) - this.inPieceDistance;
    var toNextBendDistance = toNextPieceDistance;

    var nextPieceIndex = this.currentPiece.index + 1;
    while(true) {
        if(this.track.pieces.length <= nextPieceIndex)
            nextPieceIndex = 0;

        var nextPiece = this.track.pieces[nextPieceIndex];

        // Found the next Bend, stop the loop;
        if(nextPiece.type == "B") {
            break;
        }

        // Increment the next Straight length and loop again;
        toNextBendDistance += nextPiece.lengthInLane(this.lane);
        nextPieceIndex++;
    }

    return toNextBendDistance;
}

Car.prototype.distanceToPiece = function(aPiece, laneFrom, laneTo) {
    if(! !!laneFrom)
        laneFrom = this.lane;

    var toNextPieceDistance = this.currentPiece.lengthInLane(laneFrom) - this.inPieceDistance;
    var toPieceDistance = toNextPieceDistance;

    var nextPieceIndex = this.currentPiece.index + 1;
    var switchAlreadyCounted = false;
    while(true) {
        if(this.track.pieces.length <= nextPieceIndex)
            nextPieceIndex = 0;

        var nextPiece = this.track.pieces[nextPieceIndex];

        // Found required piece
        if(nextPiece.index == aPiece.index) {
            break;
        }

        // Increment the next Straight length and loop again;
        // laneTo is for if its a switch and it is switching lanes
        toPieceDistance += nextPiece.lengthInLane(laneFrom, laneTo);
        nextPieceIndex++;
    }

    return toPieceDistance;
}

Car.prototype.inLastStraight = function(){
    // To see when the car is in last straight and never stop throttling
    if(this.track.lastStraightIndex <= this.currentPiece.index && this.lap >= this.track.laps - 1
            || this.lap == this.track.laps){
        console.log("Last straight! Step on it!")
        return true;
    }
    return false;
}

function declarePrivateMethods() {

    // If the car entered in a piece that is a switch or bend,
    // i'll enable the checkSwitch flag to verify for the possible next switch;
    this.updateCheckSwitchFlag = function() {
        if (!!this.lastPiece &&
            (this.lastPiece.index != this.currentPiece.index) &&
            (this.currentPiece.switch)) {

            this.driver.checkSwitch = true;
        }
    };

    this.getBendsAhead = function() {
        var bendsAheadCounter = BENDS_AHEAD_TO_VERIFY;
        var currentBendIndex = this.currentPiece.bendIndex;

        while(bendsAheadCounter > 0) {
            var pieceToVerify = this.currentPiece.nextPiece;

            // Skip straight pieces
            if(pieceToVerify.type === "S" || pieceToVerify.bendIndex == currentBendIndex) {
                continue;
            }

            this.bendsAhead.push(pieceToVerify);
            bendsAheadCounter--;
            currentBendIndex = pieceToVerify.bendIndex;
        }
    }
}

module.exports = Car;
