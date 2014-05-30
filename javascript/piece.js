function Piece(data, index, track) {
    this.index = index;
    this.track = track;

    this.nextPiece = null;
    this.bendIndex = null;

    this.length = data.length;
    this.radius = data.radius;
    this.angle = data.angle;

    this.targetSpeeds = [];
    this.lastBreakingFactor = 49;

    declarePrivateMethods.call(this);

    this.angleInRadians = this.getAngleInRadians(this.angle);
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

Piece.prototype.targetSpeed = function(lane, breakingFactor){
    if(!lane)
        return Infinity;
    console.log("targetSpeed: " , this.targetSpeeds, " lane ", lane.index);
    if(!!this.targetSpeeds[lane.index] &&
            (this.lastBreakingFactor < breakingFactor * 1.0025
            && this.lastBreakingFactor > breakingFactor * 0.9975) )
        return this.targetSpeeds[lane.index];

    this.calculateTargetSpeeds(breakingFactor);

    this.lastBreakingFactor = breakingFactor;
    return this.targetSpeeds[lane.index];
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

Piece.prototype.bendLength = function(sameDirection, lane){
    if(!!sameDirection){
        return this.sameDirectionBendLength(lane);
    }
    return this.chicaneBendLength(lane);
};

function declarePrivateMethods() {

    this.getPieceType = function(data) {
        // S for Straight
        if(data.length !== undefined) return "S";

        // B for Bend
        if(data.radius !== undefined) return "B";

        return "";
    };

    this.getAngleInRadians = function(angle) {
        return angle * Math.PI / 180.0;
    };

    this.lengthInSwitchLane = function(laneFrom, laneTo) {
        var laneToDistance = laneTo.distanceFromCenter;
        var laneFromDistance = laneFrom.distanceFromCenter;

        var cathetus = Math.abs(laneToDistance - laneFromDistance);
        var hypothenuse = Math.sqrt( Math.pow( cathetus, 2 ) + Math.pow( this.lengthInLane(laneTo), 2 ) );

        return hypothenuse;
    };

    this.lengthInBendLane = function(lane) {
        var angleInRadians = (Math.PI * this.angle) / 180;
        var distanceToCenter = this.radius + this.laneDistanceFromCenter(lane);

        return Math.abs(angleInRadians * distanceToCenter);
    };

    this.laneDistanceFromCenter = function(lane) {
        var distanceFromCenter = lane.distanceFromCenter;

        // Multiplying factor to determine the correct lane distance to the center of a bend;
        // left is positive, don't change, right is negative, to invert the lane distanceFromCenter;
        var directionMultiplier = (this.angle > 0) ? -1 : 1;

        return distanceFromCenter * directionMultiplier;
    };

    this.calculateTargetSpeeds = function (breakingFactor) {

        var lanes = this.track.lanes;

        for( var i = 0; i < lanes.length; i++ ){
            this.targetSpeeds[i] =
                this.calculateTargetSpeedForLane(lanes[i], breakingFactor);
        }
        //console.log("targetSpeed: " , this.targetSpeeds);
    };

    this.calculateTargetSpeedForLane = function (lane, breakingFactor){
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

    this.sameDirectionBendLength = function(lane){
        var bendLength = this.lengthInBendLane(lane);
        var pieceToVerify = this.nextPiece;

        while(pieceToVerify.bendIndex == this.bendIndex){
            bendLength += pieceToVerify.lengthInBendLane(lane);
            pieceToVerify = pieceToVerify.nextPiece;
        }
        console.log("bend length ahead: ", bendLength);

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
        console.log("chicane length ahead: ", bendLength);
        return bendLength;
    }

    this.bendAngle = function(){
        var bendAngle = this.angle;
        var pieceToVerify = this.nextPiece;

        while(pieceToVerify.bendIndex == this.bendIndex){
            bendAngle += pieceToVerify.angle;
            pieceToVerify = pieceToVerify.nextPiece;
        }

        return bendAngle;
    };
}

module.exports = Piece;
