var Piece = require('./piece.js');
var Driver = require('./driver.js');

var BENDS_AHEAD_TO_VERIFY = 3;

function getCarPositionInfo(car, positionInfoArray) {
    var positionInfo = {};

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

    //Angle Acceleration #added
    this.angleAcceleration = 0.0;
    this.lastAngleAcceleration = 0.0;
    this.angleAccelerationFactor = 0.0;

    this.angle = null;
    this.lastAngle = null;
    this.angleSpeed = 0.0;
    this.currentPiece = null;
    this.inPieceDistance = null;

    this.lap = null;
    this.bendsAhead = [];
    this.nextSwitchPiece = null;

    this.lastLane = null;
    this.lane = null;
    this.nextLane = null;
    this.lastPiece = null;
    this.lastInPieceDistance = 0.0;
    this.currentSpeed = 0.0;
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

    this.currentPiece = this.track.pieces[piecePosition.pieceIndex];
    this.lane = this.track.lanes[piecePosition.lane.endLaneIndex];
    this.inPieceDistance = piecePosition.inPieceDistance;
    this.lap = piecePosition.lap;

    this.lastAngle = this.angle;
    this.angle = positionInfo.angle;

    this.lastAngleSpeed = this.angleSpeed;
    this.angleSpeed = this.updateAngleSpeed();

    //Angle Acceleration #added
    this.lastAngleAcceleration = this.angleAcceleration;
    this.angleAcceleration = Math.abs(this.angleSpeed - this.lastAngleSpeed);
    if(this.angleAcceleration > 0)
        this.angleAccelerationFactor = Math.abs(this.angleAcceleration - this.lastAngleAcceleration);

    this.updateCurrentSpeed();
    this.acceleration = this.currentSpeed - this.lastSpeed;

    this.updateCheckSwitchFlag();
    this.getBendsAhead();
    this.getNextSwitchPiece();

    this.lastPiece = this.currentPiece;
    this.lastInPieceDistance = this.inPieceDistance;
    this.lastSpeed = this.currentSpeed;
};

Car.prototype.rechargeTurbo = function(turboInfo) {
    this.turboDurationTicks = turboInfo.turboDurationTicks;
    this.turboFactor = turboInfo.turboFactor;
    this.turboAvailable = true;
};

Car.prototype.distanceInCurrentBend = function() {
    if(this.currentPiece.type == "S")
        return 0.0;

    var currentBendIndex = this.currentPiece.bendIndex;
    var firstPieceInBend = this.currentPiece;
    while(firstPieceInBend.previousPiece.bendIndex == currentBendIndex) {
        firstPieceInBend = firstPieceInBend.previousPiece;
    }

    var distance = Piece.distanceFromPieceToPiece(firstPieceInBend, this.currentPiece, this.lane);
    distance -= this.inPieceDistance;

    return distance;
};

Car.prototype.distanceToBend = function() {
    var nextBend = this.bendsAhead[0];

    return this.distanceToPiece(nextBend);
};

Car.prototype.distanceToPiece = function(nextPiece, laneFrom, laneTo) {
    if(!laneFrom)
        laneFrom = this.lane;

    if(!laneTo)
        laneTo = this.lane;

    var distance = Piece.distanceFromPieceToPiece(this.currentPiece, nextPiece, laneFrom, laneTo);
    distance -= this.inPieceDistance;

    return distance;
};

Car.prototype.inLastStraight = function() {
    // To see when the car is in last straight and never stop throttling
    if(this.track.lastStraightIndex <= this.currentPiece.index &&
        this.lap >= this.track.laps - 1) {

        console.log("Last straight! Step on it!");
        return true;
    }
    return false;
};

Car.prototype.laneInNextBend = function(){
    // Calculates the lane that the car will be in next bend
    if(this.nextSwitchPiece.index <= this.bendsAhead[0].index)
        return this.nextLane;
    return this.lane;
};

function declarePrivateMethods() {

    this.updateCurrentSpeed = function() {
        var currentSpeed = this.inPieceDistance - this.lastInPieceDistance;

        // A piece transition occurred, the last piece length must be summed to the currentSpeed
        // for the right calculation of the distance passed in this tick, because the current inPieceDistance is reset;
        if(!!this.lastPiece &&
            this.lastPiece.index !== this.currentPiece.index){
            currentSpeed += this.lastPieceDistance();
        }

        this.currentSpeed = currentSpeed;
    };

    this.updateAngleSpeed = function() {
        var angleSpeed = Math.abs(this.angle - this.lastAngle);
        if(this.currentPiece.type == "S")
            return angleSpeed;

        var pieceAngle = this.currentPiece.angle;
        var distanceToPieceAngle = Math.abs(pieceAngle - this.angle);
        var lastDistanceToPieceAngle = Math.abs(pieceAngle - this.lastAngle);

        if(distanceToPieceAngle > lastDistanceToPieceAngle)
            angleSpeed *= -1;

        return angleSpeed;
    };

    this.lastPieceDistance = function() {
        if(this.lastPiece.hasSwitch &&
           !!this.lastLane && this.lastLane.index != this.lane.index)
            return this.lastPiece.lengthInLane(this.lastLane, this.lane);

        return this.lastPiece.lengthInLane(this.lane);
    };

    // If the car entered in a piece that is a switch,
    // i'll enable the checkSwitch flag to verify for the possible next switch;
    this.updateCheckSwitchFlag = function() {
        if (!!this.lastPiece &&
            (this.lastPiece.index != this.currentPiece.index) &&
            (this.currentPiece.hasSwitch)) {

            console.log("The driver will check for the next switch again!!!");
            this.driver.checkSwitch = true;
            this.nextSwitchPiece = null;
        }
    };

    this.getBendsAhead = function() {
        this.bendsAhead = [];

        var bendsAheadCounter = BENDS_AHEAD_TO_VERIFY;
        var pieceToVerify = this.currentPiece;
        var currentBendIndex = pieceToVerify.bendIndex;

        while(bendsAheadCounter > 0) {
            pieceToVerify = pieceToVerify.nextPiece;

            // Skip straight pieces
            if(pieceToVerify.type === "S" || pieceToVerify.bendIndex == currentBendIndex) {
                continue;
            }

            this.bendsAhead.push(pieceToVerify);
            bendsAheadCounter--;
            currentBendIndex = pieceToVerify.bendIndex;
        }
    };

    this.getNextSwitchPiece = function() {
        var pieceToVerify = this.currentPiece;

        while(this.nextSwitchPiece === null) {
            pieceToVerify = pieceToVerify.nextPiece;

            if(pieceToVerify.hasSwitch) {
                this.nextSwitchPiece = pieceToVerify;
            }
        }
    };
}

module.exports = Car;
