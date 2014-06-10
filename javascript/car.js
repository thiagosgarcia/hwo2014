var Logger = require("./logger.js");
var Piece = require('./piece.js');
var Driver = require('./driver.js');

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
    this.nextSwitchPiece = null;

    this.lastLane = null;
    this.lane = null;
    this.nextLane = null;

    this.lastPiece = null;
    this.lastInPieceDistance = 0.0;

    this.ticksPassed = 0;
    this.currentSpeed = 0.0;
    this.lastSpeed = 0.0;
    this.averageSpeed = 0.0;
    this.acceleration = 0.0;

    this.turboAvailable = false;
    this.turboDurationTicks = 0;
    this.turboFactor = 1.0;

    this.bendMaxAngle = [];

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
    if(this.currentSpeed > 0.0)
        this.updateAverageSpeed();

    this.acceleration = this.currentSpeed - this.lastSpeed;

    this.updateCheckSwitchFlag();
    this.getNextSwitchPiece();

    if(!!this.currentPiece && this.currentPiece.bendIndex != null)
        this.updateCurrentBendMaxAngle();

    if(!!this.lastPiece && this.lastPiece.bendIndex != null && this.currentPiece.bendIndex != this.lastPiece.bendIndex)
        this.setLastBendMaxAngle();

    this.lastPiece = this.currentPiece;
    this.lastInPieceDistance = this.inPieceDistance;
    this.lastSpeed = this.currentSpeed;
};

Car.prototype.updateCurrentBendMaxAngle = function() {
    if(this.bendMaxAngle[this.currentPiece.bendIndex] == undefined)
        this.bendMaxAngle[this.currentPiece.bendIndex] = 0.0;

    var currentBendMaxAngle = this.bendMaxAngle[this.currentPiece.bendIndex];
    if(Math.abs(this.angle) > currentBendMaxAngle && Math.abs(this.angle) < ANGLE_TO_CRASH) {
        this.bendMaxAngle[this.currentPiece.bendIndex] = Math.abs(this.angle);
        console.log(" maxAngle " + Math.abs(this.angle));
    }
};

Car.prototype.setLastBendMaxAngle = function() {
    if(this.lastPiece.bendIndex < 3 && ( this.lap == null || this.lap == 0))
        return;
    var currentBendMaxAngle = this.bendMaxAngle[this.lastPiece.bendIndex];
    var piecesInBend = this.lastPiece.piecesInBend();
    for(var i = 0; i < piecesInBend.length; i++) {
        var pieceInBend = piecesInBend[i];
        var lastBendMaxAngle = pieceInBend.bendMaxAngle;
        pieceInBend.bendMaxAngle = currentBendMaxAngle;
        pieceInBend.lastBendMaxAngle = lastBendMaxAngle;
    }
};

Car.prototype.setCrashAngle = function () {
    this.currentPiece.setCrashAngle(this.angle);
};

Car.prototype.rechargeTurbo = function(turboInfo) {
    this.turboDurationTicks = turboInfo.turboDurationTicks;
    this.turboFactor = turboInfo.turboFactor;
    this.turboAvailable = true;
};

Car.prototype.distanceInCurrentBend = function() {
    if(this.currentPiece.type == "S")
        return 0.0;

    var firstPieceInBend = this.currentPiece.firstPieceInBend();

    var distance = Piece.distanceFromPieceToPiece(firstPieceInBend, this.currentPiece, this.lane);
    distance -= this.inPieceDistance;

    return distance;
};

Car.prototype.distanceToBend = function() {
    return this.distanceToPiece(this.currentPiece.firstPieceInBendAhead());
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

        Logger.log("Last straight! Step on it!");
        return true;
    }
    return false;
};

Car.prototype.laneInNextBend = function(){
    // Calculates the lane that the car will be in the next bend
    if(this.nextSwitchPiece.index <= this.currentPiece.firstPieceInBendAhead().index)
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

    this.updateAverageSpeed = function() {
        this.ticksPassed++;
        this.averageSpeed = ((this.averageSpeed * (this.ticksPassed-1)) + this.currentSpeed) / this.ticksPassed;
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

            Logger.log("The driver will check for the next switch again!!!");
            this.driver.checkSwitch = true;
            this.nextSwitchPiece = null;
        }
    };

    this.getNextSwitchPiece = function() {
        var pieceToVerify = this.currentPiece;
        var counter = 0;
        while(this.nextSwitchPiece === null || counter++ > 1000) {
            pieceToVerify = pieceToVerify.nextPiece;

            if(pieceToVerify.hasSwitch) {
                this.nextSwitchPiece = pieceToVerify;
            }
        }
    };
}

module.exports = Car;
