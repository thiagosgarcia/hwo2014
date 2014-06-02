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
    this.lastBreakingFactor = 49;

    declarePrivateMethods.call(this);

    this.angleInRadians = Piece.angleInRadians(this.angle);
    this.type = this.getPieceType(data);

    this.hasSwitch = !!data.switch;
}

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

    var targetSpeedAverage = this.calculateBendTargetSpeed(lane, breakingFactor);
    var currentBendLength = this.bendLength(lane);
    var totalBendLength = 0;

    totalBendLength += currentBendLength;
    var pieceToVerify = this.bendExitPiece();
    var pieceToVerifyTargetSpeed = pieceToVerify.calculateBendTargetSpeed(lane, breakingFactor);
    var bendSameDirection =
        (this.angle > 0 && pieceToVerify.angle > 0)
        || this.angle < 0 && pieceToVerify.angle < 0;

    while (pieceToVerify.type == "B"
        && bendSameDirection
        //&& targetSpeedAverage > pieceToVerifyTargetSpeed
        ) {

        currentBendLength = pieceToVerify.bendLength(lane);
        targetSpeedAverage = pieceToVerifyTargetSpeed;
            //((targetSpeedAverage * totalBendLength) + (pieceToVerifyTargetSpeed * currentBendLength)) /
            //(totalBendLength + currentBendLength);

        totalBendLength += currentBendLength;
        pieceToVerifyTargetSpeed = pieceToVerify.calculateBendTargetSpeed(lane, breakingFactor);
        pieceToVerify = pieceToVerify.bendExitPiece();
        bendSameDirection =
            (this.angle > 0 && pieceToVerify.angle > 0)
            || this.angle < 0 && pieceToVerify.angle < 0;
    }

    return targetSpeedAverage;
};

Piece.prototype.bendLength = function(sameDirection, lane){
    if(!!sameDirection){
        return this.bendLength(lane);
    }

    return this.chicaneBendLength(lane);
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

    this.calculateBendTargetSpeed = function(lane, breakingFactor){
        if(!!this.targetSpeeds[lane.index] &&
            (this.lastBreakingFactor < breakingFactor * 1.0025
                && this.lastBreakingFactor > breakingFactor * 0.9975) )
            return this.targetSpeeds[lane.index];

        var lanes = this.track.lanes;
        for( var i = 0; i < lanes.length; i++ ){
            this.targetSpeeds[i] = this.calculateBendTargetSpeedForLane(lanes[i], breakingFactor);
        }

        this.lastBreakingFactor = breakingFactor;
        return this.targetSpeeds[lane.index];
    };

    // TODO: conta doida. Refazer da seguinte forma:
    // Descobrir a velocidade de entrada na qual o tempo de desacelerar até a maintenanceSpeed (ticksToSpeed)
    // seja menor que o tempo de bater (ticksToAngle(60));
    this.calculateBendTargetSpeedForLane = function (lane, breakingFactor){






        const gravity = 9.78 ;
        const millisecondsPerTick = 50/3;

        var laneDistanceFromCenter = this.laneDistanceFromCenter(lane);
        var radiusInLane = this.radius + laneDistanceFromCenter;

        var maxFriction = Math.sqrt( radiusInLane * (Math.abs(this.angle ) / gravity ));
        var targetSpeed = ( Math.sqrt( maxFriction * radiusInLane * gravity) / millisecondsPerTick );

        // 50% of the factor is defined by the bend and 50% by the friction factor
        var factor = Math.abs( targetSpeed  / (this.radius * this.angle )) * 50;
        targetSpeed -= targetSpeed * (factor * ( breakingFactor / 50)) ;

        return targetSpeed;
    };

    this.bendExitPiece = function () {
        if(this.type == "S") return null;

        var pieceToVerify = this.nextPiece;
        while(pieceToVerify.bendIndex == this.bendIndex) {
            pieceToVerify = pieceToVerify.nextPiece;
        }

        return pieceToVerify;
    };

    this.bendLength = function(lane) {
        if(this.type == "S")
            return 0.0;

        var bendLength = this.lengthInBendLane(lane);
        var pieceToVerify = this.nextPiece;

        while(pieceToVerify.bendIndex == this.bendIndex){
            bendLength += pieceToVerify.lengthInBendLane(lane);
            pieceToVerify = pieceToVerify.nextPiece;
        }

        Logger.log("bend length ahead: ", bendLength);
        return bendLength;
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
