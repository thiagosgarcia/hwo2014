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
    this.bendsAhead = [];
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
    this.getNextSwitchPiece();
};

Car.prototype.rechargeTurbo = function(turboInfo) {
    this.turboDurationTicks = turboInfo.turboDurationTicks;
    this.turboFactor = turboInfo.turboFactor;
    this.turboAvailable = true;
};

Car.prototype.speed = function() {
    var currentSpeed = this.inPieceDistance - this.lastInPieceDistance;

    // A piece transition occurred, the last piece length must be summed to the currentSpeed
    // for the right calculation of the distance passed in this tick, because the current inPieceDistance is reset;
    if(!!this.lastPiece && this.lastPiece.index !== this.currentPiece.index){

        if(!!this.laneInPieceBefore && this.laneInPieceBefore.index !== this.lane.index && !!this.lastPiece.hasSwitch){
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

    var toPieceDistance = this.currentPiece.lengthInLane(laneFrom) - this.inPieceDistance;
    var pieceToVerify = this.currentPiece;

    while(pieceToVerify.index != nextPiece.index) {
        pieceToVerify = pieceToVerify.nextPiece;

        if(pieceToVerify.index != nextPiece.index)
            toPieceDistance += pieceToVerify.lengthInLane(laneFrom, laneTo);
    }

    return toPieceDistance;
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

function declarePrivateMethods() {

    // If the car entered in a piece that is a switch or bend,
    // i'll enable the checkSwitch flag to verify for the possible next switch;
    this.updateCheckSwitchFlag = function() {
        if (!!this.lastPiece &&
            (this.lastPiece.index != this.currentPiece.index) &&
            (this.currentPiece.hasSwitch)) {

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
