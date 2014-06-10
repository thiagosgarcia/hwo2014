require("./constants.js");
var Logger = require("./logger.js");

function Piece(data, index, track) {
    this.index = index;
    this.track = track;

    this.nextPiece = null;
    this.previousPiece = null;
    this.bendIndex = null;

    this.length = data.length;
    this.radius = data.radius;
    this.angle = data.angle;

    this.targetSpeeds = [];
    this.maintenanceSpeeds = [];
    this.lastBreakingFactor = 49.0;

    declarePrivateMethods.call(this);

    this.angleInRadians = Piece.angleInRadians(this.angle);
    this.type = this.getPieceType(data);

    this.hasSwitch = !!data.switch;
    this.isInChicane = false;

    this.timesCrashedInBend = 0;
    this.angleToCrash = 60.0;
    this.naivePhysicsFactor = 9.0;
    this.calculatedPhysicsFactor = this.naivePhysicsFactor;

    this.lastBendMaxAngle = 0.0;
    this.bendMaxAngle = 0.0;
    this.angleAdjustFactor = 0.0;

}

Piece.prototype.setCrashAngle = function(angle){
    var crashPiece = this;
    if(this.type == "S") {
        if(this.previousPiece == "S")
            return;
        crashPiece = this.previousPiece;
    }

    angle = Math.abs(angle);
    var crashAngleDifference = this.angleToCrash - angle;
    if( crashAngleDifference < 0.0 ) {
        crashAngleDifference = 0.0;
    }

    crashAngleDifference *= 2.0;

    if( crashAngleDifference > 6.0)
        crashAngleDifference = 6.0;
    crashPiece.angleToCrash -= crashAngleDifference;
    crashPiece.incrementCrashCounter(crashPiece.angleToCrash);
};

Piece.prototype.incrementCrashCounter = function(maxAngle) {
    var piecesInCrashBend = this.piecesInBend();
    for(var i = 0; i < piecesInCrashBend.length; i++) {
        var crashPiece = piecesInCrashBend[i];
        crashPiece.timesCrashedInBend++;
        crashPiece.angleToCrash = maxAngle;
    }
};

Piece.prototype.lengthInLane = function(laneFrom, laneTo) {
    if(!!laneTo && (laneTo.index !== laneFrom.index)) {
        return this.lengthInSwitchLane(laneFrom, laneTo);
    }

    if (this.type == "B") {
        return this.lengthInBendLane(laneFrom);
    }

    return this.length;
};

Piece.prototype.radiusInLane = function(lane) {
    if(this.type == "S")
        return 0.0;

    return this.radius + lane.distanceFromCenter;
};

Piece.prototype.firstPieceInBend = function () {
    var firstPieceInBend = this;
    while(firstPieceInBend.previousPiece.bendIndex == this.bendIndex) {
        firstPieceInBend = firstPieceInBend.previousPiece;
    }
    return firstPieceInBend;
};

Piece.prototype.firstPieceInBendAhead = function() {
    var currentBendIndex = this.bendIndex;
    var pieceToVerify = this.nextPiece;

    while(pieceToVerify.type === "S" || pieceToVerify.bendIndex == currentBendIndex) {
        pieceToVerify = pieceToVerify.nextPiece;
    }

    return pieceToVerify;
};

Piece.prototype.piecesInBend = function() {
    var pieceToVerify = this.firstPieceInBend();
    var piecesInBend = [];

    while(pieceToVerify.bendIndex == this.bendIndex) {
        piecesInBend.push(pieceToVerify);

        pieceToVerify = pieceToVerify.nextPiece;
    }

    return piecesInBend;
};

Piece.prototype.distanceToNextSwitch = function(laneFrom, laneTo) {
    var distance = this["distanceToNextSwitchForLanes" + laneFrom.index + "-" + laneTo.index];
    if(!!distance)
        return distance;

    var nextSwitchPiece = this.nextPiece;
    while(!nextSwitchPiece.hasSwitch) {
        nextSwitchPiece = nextSwitchPiece.nextPiece;
    }

    distance = Piece.distanceFromPieceToPiece(this, nextSwitchPiece, laneFrom, laneTo);
    this["distanceToNextSwitchForLanes" + laneFrom.index + "-" + laneTo.index] = distance;
    return distance;
};

Piece.prototype.targetSpeed = function (lane, breakingFactor) {
    if(!lane)
        return Infinity;

    var lanes = this.track.lanes;
    for( var i = 0; i < lanes.length; i++ ){
        this.targetSpeeds[i] = this.targetSpeedForLane(lanes[i]);
    }

    this.lastBreakingFactor = breakingFactor;
    var targetSpeed = this.targetSpeeds[lane.index];

    var calculatedTargetSpeed = (targetSpeed - (targetSpeed * (this.timesCrashedInBend / 10.0)));
    var maintenanceSpeed = this.maintenanceSpeed(lane);
    // If target speed is greater than maintenance, then we have to bring it down
    calculatedTargetSpeed = maintenanceSpeed >= calculatedTargetSpeed ? maintenanceSpeed + 0.1 : calculatedTargetSpeed;

    return calculatedTargetSpeed;
};

Piece.prototype.maintenanceSpeed = function (lane){
    if(!lane)
        return Infinity;

    if(!!this.maintenanceSpeeds[lane.index])
        return this.maintenanceSpeeds[lane.index];

    var lanes = this.track.lanes;
    for( var i = 0; i < lanes.length; i++ ){
        this.maintenanceSpeeds[i] = this.calculateMaintenanceSpeedForLane(lanes[i]);
    }

    return this.maintenanceSpeeds[lane.index];
};

Piece.prototype.bendLength = function(lane) {
    if(this.type == "S")
        return 0.0;

    var bendLength = this.lengthInBendLane(lane);
    var pieceToVerify = this.nextPiece;

    while(pieceToVerify.bendIndex == this.bendIndex){
        bendLength += pieceToVerify.lengthInBendLane(lane);
        pieceToVerify = pieceToVerify.nextPiece;
    }

    return bendLength;
};

Piece.distanceFromPieceToPiece = function(pieceFrom, pieceTo, laneFrom, laneTo) {
    var toPieceDistance = 0;
    var pieceToVerify = pieceFrom;

    while(pieceToVerify.index != pieceTo.index) {
        if(pieceToVerify.index != pieceTo.index)
            toPieceDistance += pieceToVerify.lengthInLane(laneFrom, laneTo);

        pieceToVerify = pieceToVerify.nextPiece;
    }

    return toPieceDistance;
};

Piece.angleInRadians = function(angle) {
    return (angle * Math.PI) / 180.0;
};

function declarePrivateMethods() {

    this.getPieceType = function(data) {
        // S for Straight
        if(data.length !== undefined) return "S";

        // B for Bend
        if(data.radius !== undefined) return "B";

        return "";
    };

    this.lengthInSwitchLane = function(laneFrom, laneTo) {
        var laneToDistance = laneTo.distanceFromCenter;
        var laneFromDistance = laneFrom.distanceFromCenter;

        var cathetus = Math.abs(laneToDistance - laneFromDistance);
        var hypothenuse = Math.sqrt( Math.pow( cathetus, 2 ) + Math.pow( this.lengthInLane(laneTo), 2 ) );

        return hypothenuse;
    };

    this.lengthInBendLane = function(lane) {
        var distanceToCenter = this.radius + this.laneDistanceFromCenter(lane);

        return Math.abs(this.angleInRadians * distanceToCenter);
    };

    this.laneDistanceFromCenter = function(lane) {
        var distanceFromCenter = lane.distanceFromCenter;

        // Multiplying factor to determine the correct lane distance to the center of a bend;
        // left is positive, don't change, right is negative, to invert the lane distanceFromCenter;
        var directionMultiplier = (this.angle > 0) ? -1 : 1;

        return distanceFromCenter * directionMultiplier;
    };

    this.breakingFactorHasChanged = function (breakingFactor){
        return (this.lastBreakingFactor > breakingFactor * 1.0025
                || this.lastBreakingFactor < breakingFactor * 0.9975);
    };

    this.targetSpeedForLane = function(lane) {
        var thisBendTargetSpeed = this.calculateBendTargetSpeed(lane);

        var pieceToVerify = this.bendExitPiece();
        if(pieceToVerify.type == "S")
            return thisBendTargetSpeed;

        var pieceToVerifyTargetSpeed = pieceToVerify.calculateBendTargetSpeed(lane);

        while (pieceToVerify.type == "B" &&
               thisBendTargetSpeed > pieceToVerifyTargetSpeed) {

            thisBendTargetSpeed = pieceToVerifyTargetSpeed;

            pieceToVerifyTargetSpeed = pieceToVerify.calculateBendTargetSpeed(lane);
            pieceToVerify = pieceToVerify.bendExitPiece();
        }

        return thisBendTargetSpeed;
    };

    this.calculateBendTargetSpeed = function (lane) {
        var targetSpeed = this.calculatePhysicsBendTargetSpeed(lane);

        return targetSpeed;
    };

    this.calculatePhysicsBendTargetSpeed = function(lane) {
        var laneDistanceFromCenter = this.laneDistanceFromCenter(lane);
        var radiusInLane = this.radius + laneDistanceFromCenter;
        var physicsFactor = this.getPhysicsFactor();

        return ( Math.sqrt( 2 * GRAVITY_ACCELERATION * radiusInLane * physicsFactor));
    };

    this.getPhysicsFactor = function() {
        if(this.bendMaxAngle == 0.0 || this.timesCrashedInBend > 0)
            return this.naivePhysicsFactor;

        if(this.bendMaxAngle < 40.0 && (this.lastBendMaxAngle == 0.0 ))//|| this.bendMaxAngle < this.lastBendMaxAngle))
            return this.recalculatePhysicsFactor();

        return this.calculatedPhysicsFactor;
    };

    this.recalculatePhysicsFactor = function() {
        var angleDifferenceFactor = (60.0 - this.bendMaxAngle) / 12.0;
        this.calculatedPhysicsFactor = this.naivePhysicsFactor + Math.abs(angleDifferenceFactor);
        return this.calculatedPhysicsFactor;
    };

    this.calculateMaintenanceSpeedForLane = function (lane) {
        var radiusInLane = this.radiusInLane(lane);
        var maintenanceSpeed = Math.sqrt(radiusInLane / this.lastBreakingFactor * 9.78);

        return maintenanceSpeed;
    };

    this.bendExitPiece = function () {
        if(this.type == "S") return null;

        var pieceToVerify = this.nextPiece;
        while(pieceToVerify.bendIndex == this.bendIndex) {
            pieceToVerify = pieceToVerify.nextPiece;
        }

        return pieceToVerify;
    };

    this.sameDirectionBendLength = function (lane){
        var bendLength = this.lengthInBendLane(lane);
        var pieceToVerify = this.nextPiece;
        var bendSameDirection =
            (this.angle > 0 && pieceToVerify.angle > 0)
            || this.angle < 0 && pieceToVerify.angle < 0;

        while (pieceToVerify.type == "B"
            && bendSameDirection ){

            bendLength+= pieceToVerify.length;

            pieceToVerify = pieceToVerify.nextPiece;
            bendSameDirection =
                (this.angle > 0 && pieceToVerify.angle > 0)
                || this.angle < 0 && pieceToVerify.angle < 0;
        }

        return bendLength;
    };

    this.chicaneBendLength = function(lane){
        var bendLength = this.lengthInBendLane(lane);
        var pieceToVerify = this.nextPiece;

        while(pieceToVerify.type == "B"
            && Math.abs(pieceToVerify.angle) == Math.abs(this.angle)){
            bendLength += pieceToVerify.lengthInBendLane(lane);
            pieceToVerify = pieceToVerify.nextPiece;
        }
        Logger.log("chicane length ahead: ", bendLength);
        return bendLength;
    };

    this.bendAngle = function() {
        var bendIndex = this.bendIndex;
        var firstBendPiece = null;

        for(var i = 0; i < this.track.pieces.length; i++) {
            var piece = this.track.pieces[i];

            if(piece.bendIndex == bendIndex) {
                firstBendPiece = piece;
                break;
            }
        }

        var bendAngle = firstBendPiece.angle;
        var pieceToVerify = firstBendPiece.nextPiece;
        while(pieceToVerify.bendIndex == firstBendPiece.bendIndex){
            bendAngle += pieceToVerify.angle;
            pieceToVerify = pieceToVerify.nextPiece;
        }

        return bendAngle;
    };
}

module.exports = Piece;
