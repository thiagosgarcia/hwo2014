function Piece(data, index, track) {
    this.index = index;
    this.track = track;

    this.nextPiece = null;
    this.bendIndex = null;

    this.length = data.length;
    this.radius = data.radius;
    this.angle = data.angle;

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
}

module.exports = Piece;
