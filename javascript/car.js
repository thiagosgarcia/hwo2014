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

    // It is used for correct speed calculation when the car is switching lanes
    this.laneInlastPiece = null;
    this.laneInPieceBefore = null;

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
	this.turboDurationTicks = 0;
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

    var i = piecePosition.pieceIndex;
    var bendAheadFlag = 0;
    // If it is true, it means that the loop has passed in a straight and the next bend, is another bend
    var inStraight = false;
    while(true){
        if(++ i >= this.track.pieces.length)
            i = 0;
        var pieceToVerify = this.track.pieces[i];
        if(pieceToVerify.type === "S")
            inStraight = true;
        else {
            if(bendAheadFlag == 0){
                this.nextBendPiece = pieceToVerify;
                bendAheadFlag++;
            }else if(bendAheadFlag == 1 &&
                    ((pieceToVerify.angle !== this.nextBendPiece.angle || pieceToVerify.radius !== this.nextBendPiece.radius)
                    || inStraight)){
                // The easiest way to see the bend after the next
                this.bendPieceAhead = pieceToVerify;
                bendAheadFlag++;
            }else if(bendAheadFlag == 2 &&
                    ((pieceToVerify.angle !== this.bendPieceAhead.angle || pieceToVerify.radius !== this.bendPieceAhead.radius)
                    || inStraight)){
                // The easiest way to see the next 2 bends after
                this.bendPiece2TimesAhead = pieceToVerify;
                break;
            }
            inStraight = false;
        }
        // to prevent infinite loop, if it gets to the beginning again, it stops
        if(i == piecePosition.pieceIndex)
            break;
    }
    // Prevent null objects on circular, or almost circular circuits
    if(this.bendPieceAhead == null)
        this.bendPieceAhead = this.nextBendPiece;
    if(this.bendPiece2TimesAhead == null)
        this.bendPiece2TimesAhead = this.bendPieceAhead;

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

module.exports = Car;
