var Piece = require('./piece.js');
var Track = require('./track.js');
var Driver = require('./driver.js');

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
    this.angleAcceleration = 0.0;
    this.currentPiece = null;
	this.inPieceDistance = null;
	this.lane = null;
	this.lap = null;

    this.nextBendPiece = null;
    this.bendPieceAhead = null;
    this.bendPiece2TimesAhead = null;
    this.nextDifferentPiece = null;
    this.nextSwitchPiece = null;

	this.lastPiece = null;
	this.lastInPieceDistance = 0.0;
	this.lastSpeed = 0.0;
	this.acceleration = 0.0;

	this.turboAvailable = false;
	this.turboDuration = 0;
	this.turboFactor = 1.0;
	
	this.driver = new Driver(this);
}

Car.prototype.updateCarPosition = function(positionInfoArray) {
	var positionInfo = getCarPositionInfo(this, positionInfoArray);

    this.lastAngle = this.angle;
	this.angle = positionInfo.angle;
    this.angleAcceleration = this.angle - this.lastAngle;

	var piecePosition = positionInfo.piecePosition;

	this.currentPiece = this.track.pieces[piecePosition.pieceIndex];
	this.lane = this.track.lanes[piecePosition.lane.endLaneIndex];
	this.inPieceDistance = piecePosition.inPieceDistance;
	this.lap = piecePosition.lap;
	
	// If the car entered in a piece that is a switch or bend, 
	// i'll enable the checkSwitch flag to verify for the possible next switch;
	if(!!this.lastPiece && (this.lastPiece.index != this.currentPiece.index) && (this.currentPiece.switch || this.currentPiece.type == "B")) {
		this.driver.checkSwitch = true;
	}

	this.inPieceDistance = piecePosition.inPieceDistance;
	this.lap = piecePosition.lap;

    var i = piecePosition.pieceIndex;
    var bendAheadFlag = 0;
    while(true){
        if(++ i >= this.track.pieces.length)
            i = 0;
        var pieceToVerify = this.track.pieces[i];
        if(pieceToVerify.type !== "S"){
            if(bendAheadFlag == 0){
                this.nextBendPiece = pieceToVerify;
                bendAheadFlag++;
            }else if(bendAheadFlag == 1 && (pieceToVerify.angle !== this.nextBendPiece.angle || pieceToVerify.radius !== this.nextBendPiece.radius)){
                // THe easiest way to see the bend after the next
                this.bendPieceAhead = pieceToVerify;
                bendAheadFlag++;
            }else if(bendAheadFlag == 2 && (pieceToVerify.angle !== this.bendPieceAhead.angle || pieceToVerify.radius !== this.bendPieceAhead.radius)){
                // THe easiest way to see the next 2 bends after
                this.bendPiece2TimesAhead = pieceToVerify;
                break;
            }
        }
        // to prevent infinite loop, if it gets to the beginning again, it stops
        if(i == piecePosition.pieceIndex)
            break;
    }
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
    this.turboDuration = turboInfo.turboDurationTicks;
    this.turboFactor = turboInfo.turboFactor;

    // If the factor is less than 1, then we can say the turbo will get the car slower, right?
    // So, even just for now, I'll make sure we don't get into jokes and only go turbo if
    // multiplier is equal to or greater than 1
    if(this.turboFactor >= 1)
        this.turboAvailable = true;
}

// Speed in distance per tick;
Car.prototype.speed = function() {   
    var currentSpeed = this.inPieceDistance - this.lastInPieceDistance;

	// A piece transition occurred, the last piece length must be summed to the currentSpeed
	// for the right calculation of the distance passed in this tick, because the current inPieceDistance is reset;
    if(!!this.lastPiece && this.lastPiece.index != this.currentPiece.index)
    	currentSpeed += this.lastPiece.lengthInLane(this.lane);

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

Car.prototype.distanceToPiece = function(aPiece, lane) {
    if(lane === undefined)
        lane = this.lane;

    var toNextPieceDistance = this.currentPiece.lengthInLane(lane) - this.inPieceDistance;
    var toPieceDistance = toNextPieceDistance;

    var nextPieceIndex = this.currentPiece.index + 1;
    while(true) {
        if(this.track.pieces.length <= nextPieceIndex)
            nextPieceIndex = 0;

        var nextPiece = this.track.pieces[nextPieceIndex];

        // Found required piece
        if(nextPiece.index == aPiece.index) {
            break;
        }

        // Increment the next Straight length and loop again;
        toPieceDistance += nextPiece.lengthInLane(lane);
        nextPieceIndex++;
    }

    return toPieceDistance;
}

Car.prototype.inLastStraight = function(){
    // To see when the car is in last straight and never stop throttling
    if(this.track.lastStraightIndex <= this.currentPiece.index && this.lap >= this.track.laps - 1){
        console.log("Last straight! Step on it!")
        return true;
    }
    return false;
}

module.exports = Car;
