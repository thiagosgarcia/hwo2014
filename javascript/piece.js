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
    this.lastBreakingFactor = 49;

    declarePrivateMethods.call(this);

    this.angleInRadians = Piece.angleInRadians(this.angle);
    this.type = this.getPieceType(data);

    this.hasSwitch = !!data.switch;
    this.isInChicane = false;

    this.timesCrashedInBends = 0;
    this.bendMaxAngle = 0;
    this.angleAdjustFactor = 0;
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

Piece.prototype.firstPieceInBend = function () {
    var firstPieceInBend = this;
    while(firstPieceInBend.previousPiece.bendIndex == this.index) {
        firstPieceInBend = firstPieceInBend.previousPiece;
    }
    return firstPieceInBend;
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

Piece.prototype.targetSpeed = function (lane, breakingFactor, timesCrashedInBend) {
    if(!lane)
        return Infinity;

 /*   if(!!this.targetSpeeds[lane.index] &&
        !this.breakingFactorHasChanged(breakingFactor))
        return this.targetSpeeds[lane.index];*/

    var lanes = this.track.lanes;
    for( var i = 0; i < lanes.length; i++ ){
        this.targetSpeeds[i] = this.targetSpeedForLane(lanes[i], breakingFactor);
    }

    this.lastBreakingFactor = breakingFactor;
    return this.targetSpeeds[lane.index];
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

    this.targetSpeedForLane = function(lane, breakingFactor) {
        var thisBendTargetSpeed = this.calculateBendTargetSpeed(lane, breakingFactor);

        var extraLengthToDecrement = this.bendLength(lane);
        var pieceToVerify = this.bendExitPiece();
        if(pieceToVerify.type == "S")
            return thisBendTargetSpeed;

        var pieceToVerifyTargetSpeed = pieceToVerify.calculateBendTargetSpeed(lane, breakingFactor, extraLengthToDecrement);
        var bendInSameDirection = (this.angle > 0 && pieceToVerify.angle > 0) ||
                                  (this.angle < 0 && pieceToVerify.angle < 0);

        while (pieceToVerify.type == "B" &&
               thisBendTargetSpeed > pieceToVerifyTargetSpeed) {

            thisBendTargetSpeed = pieceToVerifyTargetSpeed;

            extraLengthToDecrement += pieceToVerify.bendLength(lane);
            pieceToVerifyTargetSpeed = pieceToVerify.calculateBendTargetSpeed(lane, breakingFactor, extraLengthToDecrement);
            pieceToVerify = pieceToVerify.bendExitPiece();
            bendInSameDirection = (this.angle > 0 && pieceToVerify.angle > 0) ||
                                  (this.angle < 0 && pieceToVerify.angle < 0);
        }

        return thisBendTargetSpeed;
    };

    // TODO: conta doida. Refazer da seguinte forma:
    // Descobrir a velocidade de entrada na qual o tempo de desacelerar até a maintenanceSpeed (ticksToSpeed)
    // seja menor que o tempo de bater (ticksToAngle(60));
    this.calculateBendTargetSpeed = function (lane, breakingFactor, extraLengthToDecrement) {

        var targetSpeed = this.calculatePhysicsBendTargetSpeed(lane);

        if(this.isInChicane)
            targetSpeed *= 1.09;
        return targetSpeed;
        // TODO CONTINUE FROM HERE
        // temos que jogar o calculo de velocidade para voltar até a bend anterior em caso de duas bends coladas.
        // A menor targetSpeed será a utilizada.
        //
        /// Quando a velocidade radial = velocidade angular então estamos na iminencia de derrapar

        // Codigo de segurança
        if(!extraLengthToDecrement)
            extraLengthToDecrement = 0.0;

        var bendLengthFactor = this.radiusInLane(lane) / 400.0;
        var lengthToDecrement = (this.bendLength(lane) * bendLengthFactor) + extraLengthToDecrement;
        var maintenanceSpeed = this.maintenanceSpeed(lane, breakingFactor);

        var breakingAcceleration = maintenanceSpeed / breakingFactor;
        var targetSpeed = 0.0;
        var counter = 0.0;

        while(lengthToDecrement > 0.0){
            targetSpeed = maintenanceSpeed + (breakingAcceleration * counter++);
            lengthToDecrement -= targetSpeed;

            breakingAcceleration = targetSpeed / breakingFactor;
        }

        return targetSpeed;

/*  Codigo antigo
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
*/
    };

    /* //atual
    this.calculatePhysicsBendTargetSpeed = function(lane) {

        var laneDistanceFromCenter = this.laneDistanceFromCenter(lane);
        var radiusInLane = this.radius + laneDistanceFromCenter;

        return ( Math.sqrt( 2 * GRAVITY_ACCELERATION * radiusInLane * 9));
    };
*/
     //teste
     this.calculatePhysicsBendTargetSpeed = function(lane) {
     var laneDistanceFromCenter = this.laneDistanceFromCenter(lane);
     var radiusInLane = this.radius + laneDistanceFromCenter;
     var maxAngle = !this.bendMaxAngle ? 45.0 : this.bendMaxAngle;

     var angleDifferenceFactor = 8.0 * (( (60.0 - maxAngle) / 60.0 )) ;
     var physicsFactor = 4 + Math.abs(angleDifferenceFactor);

     var crashFactor = physicsFactor * (this.timesCrashedInBends / 100.0);

     physicsFactor = physicsFactor - crashFactor;

     return ( Math.sqrt( 2 * GRAVITY_ACCELERATION * radiusInLane * physicsFactor));
     //return ( Math.sqrt( 2 * GRAVITY_ACCELERATION * radiusInLane * 9));
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
