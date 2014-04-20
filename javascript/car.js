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
	this.currentPiece = null;
	this.inPieceDistance = null;
	this.lane = null;
	this.lap = null;
	
	this.lastPiece = null;
	this.lastInPieceDistance = 0.0;
	this.lastSpeed = 0.0;
	this.acceleration = 0.0;
	
	this.driver = new Driver();
}

Car.prototype.updateCarPosition = function(positionInfoArray) {
	var positionInfo = getCarPositionInfo(this, positionInfoArray);
  
	this.angle = positionInfo.angle;
	var piecePosition = positionInfo.piecePosition;
	
	this.currentPiece = this.track.pieces[piecePosition.pieceIndex];
	this.lane = this.track.lanes[piecePosition.lane.endLaneIndex];
	
	this.inPieceDistance = piecePosition.inPieceDistance;
	this.lap = piecePosition.lap;
};

Car.prototype.getThrottle = function() {
	return this.driver.drive(this);
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
		if(nextPiece.type == "B")
			break;
		
		// Increment the next Straight length and loop again;
		toNextBendDistance += nextPiece.length;
		nextPieceIndex++;
	}
	
	return toNextBendDistance;
}

module.exports = Car;